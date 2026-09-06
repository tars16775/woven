import type { Config } from "./config.ts";
import type { Data } from "./data.ts";
import { OneTimeStore } from "./auth/challenges.ts";
import { PasskeyService } from "./auth/passkeys.ts";
import { RecoveryService } from "./auth/recovery.ts";
import { SessionService } from "./auth/sessions.ts";
import { HouseholdService } from "./household.ts";
import { ActionEngine } from "./actions/engine.ts";
import { Presence, SimulatedAdapter, type HomeAdapter } from "./home/adapter.ts";
import type { GateClient } from "./gate/client.ts";
import { defaultContext } from "@woven/policy";
import { eq } from "drizzle-orm";
import { settings } from "./db/schema.ts";
import { ScreenCode } from "./auth/screen.ts";
import { InvitationService } from "./invitations.ts";
import { RightsService } from "./rights.ts";
import { FilesService } from "./files.ts";
import { PhotoService } from "./photos.ts";
import { ModelStore } from "./models.ts";
import { MediaService, mediaKind, type Tools } from "./media.ts";
import { NetworkScanner } from "./network-scan.ts";
import { RoutineService } from "./routines.ts";
import { MemoryService } from "./memory.ts";
import { Alerts } from "./alerts.ts";
import { Metrics } from "./metrics.ts";
import { detectHardware, type Hardware } from "@woven/hal";
import { PhotoIndex, loadClip, type Embedder } from "./photo-index.ts";
import type { Logger } from "./logger.ts";
import pino from "pino";
import { join } from "node:path";

/** A first passkey may be registered by whoever holds one of these (setup, invitations). */
export type Enrolment = { personId: string; reason: "setup" | "invitation" | "recovery" };

export type Services = {
  household: HouseholdService;
  sessions: SessionService;
  passkeys: PasskeyService;
  recovery: RecoveryService;
  enrolments: OneTimeStore<Enrolment>;
  home: HomeAdapter;
  presence: Presence;
  gate: GateClient;
  actions: ActionEngine;
  screen: ScreenCode;
  invitations: InvitationService;
  rights: RightsService;
  files: FilesService;
  photos: PhotoService;
  models: ModelStore;
  photoIndex: PhotoIndex;
  media: MediaService;
  network: NetworkScanner;
  routines: RoutineService;
  memory: MemoryService;
  alerts: Alerts;
  metrics: Metrics;
};

export type ServiceOptions = { home?: HomeAdapter; logger?: Logger; loadEmbedder?: (dir: string) => Promise<Embedder>; tools?: Tools; hardware?: Hardware; mdns?: boolean };

export function buildServices(data: Data, config: Config, gate: GateClient, opts: ServiceOptions = {}): Services {
  const home = opts.home ?? new SimulatedAdapter();
  const logger = opts.logger ?? (pino({ level: "silent" }));
  const { db } = data.database;
  const passkeys = new PasskeyService(db, config.origins);
  const presence = new Presence();
  const household = new HouseholdService(db, data.ledger);
  const rights = new RightsService(db, data.ledger, household, data.store, join(data.paths.root, "exports"));
  const files = new FilesService(db, data.ledger, data.store, household, data.paths.storeTmp);
  const photos = new PhotoService(db, data.ledger, data.store, household, files);
  const models = new ModelStore(join(data.paths.root, "models"), gate);
  const photoIndex = new PhotoIndex(db, data.store, household, models, logger, opts.loadEmbedder ?? loadClip);
  // An uploaded image becomes a photo as soon as it lands, then gets its search vector; a deleted file takes its photo with it.
  let embedTimer: NodeJS.Timeout | null = null;
  const embedSoon = () => {
    if (embedTimer) clearTimeout(embedTimer);
    embedTimer = setTimeout(() => void photoIndex.indexPending().catch(() => undefined), 1500);
    embedTimer.unref();
  };
  const mediaService = new MediaService(db, data.store, household, logger, opts.tools ?? { ffmpeg: null, ffprobe: null });
  photos.onIndexed = embedSoon;
  files.onAdded = (entry) => {
    void photos.index(entry.id).catch(() => undefined);
    if (mediaKind(entry.mime, entry.name)) void mediaService.probe(entry.id).catch(() => undefined);
  };
  files.onRemoved = async (fileId) => {
    await photos.forget(fileId);
    mediaService.forget(fileId);
  };
  const actions = new ActionEngine({
    db,
    ledger: data.ledger,
    home,
    presence,
    gate,
    policy: () => {
      const row = db.select().from(settings).where(eq(settings.key, "policy.autoApproveAmountUpTo")).get();
      const n = row ? Number(JSON.parse(row.value)) : NaN;
      return Number.isFinite(n) ? { autoApproveAmountUpTo: n } : defaultContext;
    },
    verifyAssertion: (key, credential) => passkeys.verifyAuthentication(key, credential as never),
    installModel: async (model, actionId) => {
      const spec = models.spec(model);
      if (!spec) throw new Error(`no model called ${model}`);
      const state = await models.install(model, actionId);
      embedSoon();
      return { bytes: state.bytes, files: Object.keys(spec.files).length };
    },
    transferOwnership: (fromId, toId) => {
      const from = household.person(fromId);
      if (!from) throw new Error("no such person");
      const r = rights.transferOwnership(from, toId);
      return { from: r.from.id, to: r.to.id };
    },
  });
  const routines = new RoutineService(db, data.ledger, household, actions, logger);
  // Presence changes run the routines that wait for them (Leaving, Arrive).
  presence.onChange = (adultsHome) => void routines.onPresence(adultsHome).catch(() => undefined);
  return {
    household,
    sessions: new SessionService(db, data.ledger),
    passkeys,
    recovery: new RecoveryService(db),
    enrolments: new OneTimeStore<Enrolment>(15 * 60 * 1000),
    home,
    presence,
    gate,
    actions,
    screen: new ScreenCode(),
    invitations: new InvitationService(db, data.ledger, household),
    rights,
    files,
    photos,
    models,
    photoIndex,
    media: mediaService,
    network: new NetworkScanner(opts.hardware ?? detectHardware({ dataRoot: config.dataRoot }), logger, { mdns: opts.mdns ?? config.mdns }),
    routines,
    memory: new MemoryService(db, data.ledger),
    alerts: new Alerts(),
    metrics: new Metrics(),
  };
}
