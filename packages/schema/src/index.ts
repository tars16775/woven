/**
 * @woven/schema
 *
 * Every boundary in Woven is described here once: the core validates input
 * against these, the site types its client from them, and the ledger records
 * shapes that these define. If a shape is not here, it does not cross a
 * boundary.
 */
import { z } from "zod";

/* Identifiers -------------------------------------------------------------- */

/** ULIDs: sortable, 26 chars, Crockford base32. */
export const Ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "expected a ULID");
export type Ulid = z.infer<typeof Ulid>;

/* Household ---------------------------------------------------------------- */

export const Role = z.enum(["owner", "adult", "child", "guest"]);
export type Role = z.infer<typeof Role>;

/**
 * Data namespaces. Retrieval and action authorisation are evaluated per
 * namespace; nothing crosses one implicitly.
 */
export const Namespace = z.enum([
  "household",
  "personal",
  "security",
  "financial",
  "health",
  "work",
  "children",
  "guest",
]);
export type Namespace = z.infer<typeof Namespace>;

export const Household = z.object({
  id: Ulid,
  name: z.string().min(1).max(80),
  createdAt: z.iso.datetime(),
});
export type Household = z.infer<typeof Household>;

/** A member of the household. Email is null for children without one; removedAt is set instead of deleting. */
export const Person = z.object({
  id: Ulid,
  householdId: Ulid,
  name: z.string().min(1).max(80),
  email: z.email().nullable(),
  role: Role,
  createdAt: z.iso.datetime(),
  removedAt: z.iso.datetime().nullable(),
  /** Guests: when their access ends. */
  expiresAt: z.iso.datetime().nullable().optional(),
});
export type Person = z.infer<typeof Person>;

export const Invitation = z.object({
  id: Ulid,
  person: Person,
  createdBy: Ulid,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  acceptedAt: z.iso.datetime().nullable(),
  /** Only present in the response that created it; the link the owner passes on. */
  token: z.string().optional(),
});
export type Invitation = z.infer<typeof Invitation>;

export const NewInvitation = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase().optional(),
  role: Role.exclude(["owner"]),
  /** Guests only: days of access. */
  guestDays: z.number().int().min(1).max(90).optional(),
});
export type NewInvitation = z.infer<typeof NewInvitation>;

/* Risk and capabilities ---------------------------------------------------- */

/** Action risk classes. F and G are unsupported in v1 by design. */
export const RiskClass = z.enum(["A", "B", "C", "D", "E", "F", "G", "H"]);
export type RiskClass = z.infer<typeof RiskClass>;

/** Where something ran or was decided. Mirrors the receipts on the screen. */
export const Where = z.enum(["inside", "device", "policy", "gate"]);
export type Where = z.infer<typeof Where>;

/** A capability name: `domain.action`, e.g. `light.set_brightness`. */
export const CapabilityName = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, "expected domain.action");
export type CapabilityName = z.infer<typeof CapabilityName>;

export const Capability = z.object({
  name: CapabilityName,
  riskClass: RiskClass,
  /** Whether repeating the same call with the same key is safe. */
  idempotent: z.boolean(),
  /** Which state to read back to verify the action, if any. */
  readback: z.string().optional(),
  latency: z.enum(["realtime", "interactive", "background"]),
  description: z.string().max(200),
});
export type Capability = z.infer<typeof Capability>;

/* Actions: prepare → (approve) → execute → verify → receipt ---------------- */

export const ActorRef = z.object({
  kind: z.enum(["person", "agent", "routine", "core"]),
  id: z.string().min(1),
});
export type ActorRef = z.infer<typeof ActorRef>;

export const PrepareAction = z.object({
  actor: ActorRef,
  capability: CapabilityName,
  target: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
  /** Version of the world the caller saw, to detect stale plans. */
  contextVersion: z.number().int().nonnegative().optional(),
});
export type PrepareAction = z.infer<typeof PrepareAction>;

export const PreparedAction = z.object({
  actionId: Ulid,
  riskClass: RiskClass,
  approvalRequired: z.boolean(),
  /** One plain sentence the person will read before approving. */
  preview: z.string().max(280),
  expiresAt: z.iso.datetime(),
});
export type PreparedAction = z.infer<typeof PreparedAction>;

export const ExecutionStatus = z.enum(["pending", "running", "succeeded", "partial", "failed", "rolled_back"]);
export type ExecutionStatus = z.infer<typeof ExecutionStatus>;

/* Ledger ------------------------------------------------------------------- */

export const EventType = z.enum([
  "household.created",
  "person.created",
  "person.removed",
  "session.started",
  "session.ended",
  "action.prepared",
  "action.approved",
  "action.declined",
  "action.executed",
  "action.verified",
  "action.failed",
  "gate.crossing",
  "gate.closed",
  "gate.opened",
  "update.verified",
  "update.installed",
  "memory.created",
  "memory.deleted",
  "core.started",
  "core.integrity_checked",
]);
export type EventType = z.infer<typeof EventType>;

/**
 * The event envelope. Payloads are typed per event elsewhere; the envelope is
 * what the ledger stores and hashes. `sent` describes exactly what crossed
 * the Gate, if anything, in words a person can read.
 */
export const EventEnvelope = z.object({
  id: Ulid,
  type: EventType,
  occurredAt: z.iso.datetime(),
  householdId: Ulid,
  actor: ActorRef,
  target: z.string().optional(),
  where: Where,
  namespace: Namespace.optional(),
  sensitivity: z.enum(["low", "normal", "high"]).default("normal"),
  causationId: Ulid.optional(),
  correlationId: Ulid.optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  sent: z.string().max(500).optional(),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;

/** A stored ledger row: the envelope plus its place in the chain. */
export const LedgerRow = EventEnvelope.extend({
  seq: z.number().int().positive(),
  prevHash: z.string().length(64),
  hash: z.string().length(64),
});
export type LedgerRow = z.infer<typeof LedgerRow>;

/** What the dashboard shows. Never contains secrets or raw content. */
export const Receipt = z.object({
  id: Ulid,
  time: z.iso.datetime(),
  title: z.string().max(80),
  detail: z.string().max(280),
  where: Where,
  actor: z.string().max(80),
  sent: z.string().max(500).optional(),
});
export type Receipt = z.infer<typeof Receipt>;

/* Hardware ----------------------------------------------------------------- */

export const HardwareKind = z.enum(["macos", "linux-box", "linux-generic"]);
export type HardwareKind = z.infer<typeof HardwareKind>;

export const RadioKind = z.enum(["thread", "zigbee", "zwave", "bluetooth", "wifi"]);
export type RadioKind = z.infer<typeof RadioKind>;

export const HardwareIdentity = z.object({
  kind: HardwareKind,
  /** Stable per machine; derived from hardware identifiers, never a serial in the clear. */
  machineId: z.string().length(32),
  model: z.string().max(120),
  memoryBytes: z.number().int().nonnegative(),
  cpu: z.string().max(120),
  os: z.string().max(80),
  features: z.object({
    radios: z.array(RadioKind),
    screen: z.boolean(),
    router: z.boolean(),
    gate: z.enum(["process", "processor"]),
  }),
});
export type HardwareIdentity = z.infer<typeof HardwareIdentity>;

export const Metrics = z.object({
  at: z.iso.datetime(),
  cpuLoad1m: z.number().nonnegative(),
  cpuCount: z.number().int().positive(),
  memoryUsedBytes: z.number().int().nonnegative(),
  memoryTotalBytes: z.number().int().nonnegative(),
  diskUsedBytes: z.number().int().nonnegative(),
  diskTotalBytes: z.number().int().nonnegative(),
  /** Degrees Celsius, or null where the platform does not report it. */
  temperatureC: z.number().nullable(),
  uptimeSeconds: z.number().nonnegative(),
});
export type Metrics = z.infer<typeof Metrics>;

/* Core status -------------------------------------------------------------- */

export const CoreStatus = z.object({
  version: z.string(),
  startedAt: z.iso.datetime(),
  hardware: HardwareIdentity,
  metrics: Metrics,
  gate: z.enum(["open", "closed", "absent"]),
  dataRoot: z.string(),
});
export type CoreStatus = z.infer<typeof CoreStatus>;

/** Non-secret runtime configuration, shown on the Core page. */
export const CoreConfig = z.object({
  version: z.string(),
  name: z.string(),
  port: z.number().int(),
  origins: z.array(z.string()),
  mdns: z.boolean(),
  tls: z.discriminatedUnion("enabled", [
    z.object({
      enabled: z.literal(true),
      caFingerprint: z.string(),
      caNotAfter: z.iso.datetime(),
      serverNotAfter: z.iso.datetime(),
      names: z.array(z.string()),
      addresses: z.array(z.string()),
      trustUrl: z.url(),
    }),
    z.object({ enabled: z.literal(false) }),
  ]),
});
export type CoreConfig = z.infer<typeof CoreConfig>;

/** GET /v1/household: the household and its living members, or `setup: false` on a fresh box. */
export const HouseholdView = z.discriminatedUnion("setup", [
  z.object({ setup: z.literal(false) }),
  z.object({ setup: z.literal(true), household: Household, people: z.array(Person) }),
]);
export type HouseholdView = z.infer<typeof HouseholdView>;

export const NewPerson = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase().optional(),
  role: Role.exclude(["owner"]),
});
export type NewPerson = z.infer<typeof NewPerson>;

export const SetupHousehold = z.object({
  household: z.string().trim().min(1).max(80),
  owner: z.object({ name: z.string().trim().min(1).max(80), email: z.email().trim().toLowerCase() }),
});
export type SetupHousehold = z.infer<typeof SetupHousehold>;

export const AuthMethod = z.enum(["passkey", "code", "recovery"]);
export type AuthMethod = z.infer<typeof AuthMethod>;

/** GET /v1/auth/session: who is signed in on this device. */
export const SessionView = z.object({
  person: Person,
  household: Household,
  method: AuthMethod,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  /** How many passkeys this person has; zero means "add one now". */
  passkeys: z.number().int().nonnegative(),
});
export type SessionView = z.infer<typeof SessionView>;

/* Actions, approvals, the Gate (phases 12 to 15) ---------------------------- */

export const ActionStatus = z.enum(["prepared", "approved", "declined", "executing", "succeeded", "failed", "expired"]);
export type ActionStatus = z.infer<typeof ActionStatus>;

/** An action as the dashboard sees it, from prepare to receipt. */
export const ActionRecord = z.object({
  id: Ulid,
  householdId: Ulid,
  actor: ActorRef,
  capability: CapabilityName,
  target: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  riskClass: RiskClass,
  namespace: Namespace,
  status: ActionStatus,
  /** One plain sentence the person reads before approving. */
  preview: z.string().max(280),
  decision: z.object({ outcome: z.enum(["allow", "approve", "deny"]), reason: z.string() }),
  approval: z
    .object({ by: z.enum(["self", "adult", "owner"]), factors: z.array(z.enum(["presence", "strong_auth"])), approvedBy: Ulid.nullable(), approvedAt: z.iso.datetime().nullable() })
    .nullable(),
  planned: z.record(z.string(), z.unknown()).nullable(),
  observed: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ActionRecord = z.infer<typeof ActionRecord>;

/** POST /v1/actions/prepare */
export const PrepareRequest = z.object({
  capability: CapabilityName,
  target: z.string().min(1).max(120),
  parameters: z.record(z.string(), z.unknown()).default({}),
  /** Same key, same action: a retried call returns the earlier record instead of acting twice. */
  idempotencyKey: z.string().min(8).max(120).optional(),
});
export type PrepareRequest = z.infer<typeof PrepareRequest>;

/** Class H approvals carry a fresh passkey assertion (strong authentication). */
export const ApproveRequest = z.object({
  assertion: z.object({ key: z.string(), credential: z.record(z.string(), z.unknown()) }).optional(),
});

/** A device as the Home page shows it, from whichever adapter owns it. */
export const DeviceKind = z.enum(["light", "plug", "thermostat", "lock", "sensor", "camera", "robot", "speaker"]);
export const HomeDevice = z.object({
  id: z.string(),
  roomId: z.string(),
  name: z.string(),
  kind: DeviceKind,
  protocol: z.string(),
  reachable: z.boolean(),
  riskClass: RiskClass,
  /** The adapter's current reading: on/off, brightness, setpoint, locked, a sensor value. */
  state: z.record(z.string(), z.unknown()),
  updatedAt: z.iso.datetime(),
});
export type HomeDevice = z.infer<typeof HomeDevice>;
export const HomeRoom = z.object({ id: z.string(), name: z.string(), occupied: z.boolean() });
export type HomeRoom = z.infer<typeof HomeRoom>;
export const HomeState = z.object({
  adapter: z.string(),
  rooms: z.array(HomeRoom),
  devices: z.array(HomeDevice),
  /** Whether an adult is known to be home. Presence satisfies class D. */
  presence: z.object({ adultsHome: z.boolean(), since: z.iso.datetime().nullable(), source: z.string() }),
});
export type HomeState = z.infer<typeof HomeState>;

/** What the dashboard knows about the Gate. */
export const GateStatus = z.object({
  state: z.enum(["open", "closed", "absent"]),
  changedAt: z.iso.datetime().nullable(),
  changedBy: z.string().nullable(),
  allowList: z.array(z.string()),
  crossingsToday: z.number().int().nonnegative(),
  bytesOutToday: z.number().int().nonnegative(),
});
export type GateStatus = z.infer<typeof GateStatus>;

/* Files (phases 18 and 19) --------------------------------------------------- */

export const FileEntry = z.object({
  id: Ulid,
  ownerId: Ulid,
  namespace: Namespace,
  /** Folder, always starting with "/" and never ending with one except the root. */
  path: z.string(),
  name: z.string(),
  sha256: z.string().length(64),
  size: z.number().int().nonnegative(),
  mime: z.string().nullable(),
  source: z.string().nullable(),
  createdAt: z.iso.datetime(),
  modifiedAt: z.iso.datetime(),
});
export type FileEntry = z.infer<typeof FileEntry>;

export const FolderEntry = z.object({ name: z.string(), path: z.string(), items: z.number().int(), bytes: z.number().int() });
export type FolderEntry = z.infer<typeof FolderEntry>;

/** One folder's listing: subfolders (derived from paths) and the files directly in it. */
export const FileListing = z.object({
  namespace: Namespace,
  path: z.string(),
  folders: z.array(FolderEntry),
  files: z.array(FileEntry),
});
export type FileListing = z.infer<typeof FileListing>;

/** Totals the Files and Overview pages show. */
export const FilesSummary = z.object({
  byNamespace: z.array(z.object({ namespace: Namespace, items: z.number().int(), bytes: z.number().int() })),
  sources: z.array(z.object({ source: z.string(), items: z.number().int(), bytes: z.number().int(), lastAt: z.iso.datetime() })),
  totalBytes: z.number().int(),
  uniqueBytes: z.number().int(),
  disk: z.object({ usedBytes: z.number().int(), totalBytes: z.number().int() }),
});
export type FilesSummary = z.infer<typeof FilesSummary>;

export const UploadSession = z.object({
  id: Ulid,
  chunkSize: z.number().int().positive(),
  chunks: z.number().int().nonnegative(),
  received: z.array(z.number().int()),
  /** True when the box already holds these bytes: no chunks needed, just complete. */
  alreadyStored: z.boolean(),
});
export type UploadSession = z.infer<typeof UploadSession>;

export const StartUpload = z.object({
  name: z.string().trim().min(1).max(255),
  path: z.string().default("/"),
  namespace: Namespace.default("personal"),
  size: z.number().int().nonnegative().max(64 * 1024 ** 3),
  mime: z.string().max(120).optional(),
  sha256: z.string().length(64).optional(),
  source: z.string().max(80).optional(),
});
export type StartUpload = z.infer<typeof StartUpload>;

/* Photos (phase 20) ---------------------------------------------------------- */

export const Photo = z.object({
  id: Ulid,
  fileId: Ulid,
  ownerId: Ulid,
  namespace: Namespace,
  name: z.string(),
  takenAt: z.iso.datetime(),
  width: z.number().int(),
  height: z.number().int(),
  camera: z.string().nullable(),
  place: z.object({ lat: z.number(), lon: z.number() }).nullable(),
});
export type Photo = z.infer<typeof Photo>;

export const PhotoTimeline = z.object({
  photos: z.array(Photo),
  /** Pass back to get older photos; null at the end. */
  cursor: z.string().nullable(),
  total: z.number().int(),
});
export type PhotoTimeline = z.infer<typeof PhotoTimeline>;

export const PhotoStats = z.object({
  total: z.number().int(),
  newThisWeek: z.number().int(),
  withPlace: z.number().int(),
  months: z.array(z.object({ month: z.string(), count: z.number().int() })),
});
export type PhotoStats = z.infer<typeof PhotoStats>;

/* Backups and the restore drill (phase 23) ---------------------------------- */

export const SnapshotInfo = z.object({ name: z.string(), takenAt: z.iso.datetime(), objects: z.number().int(), bytes: z.number().int(), mirrored: z.boolean() });
export const BackupStatus = z.object({
  snapshots: z.array(SnapshotInfo),
  mirror: z.string().nullable(),
  /** The last drill, if one ran since the core started. */
  lastDrill: z
    .object({ snapshot: z.string(), takenAt: z.iso.datetime(), ok: z.boolean(), ledger: z.object({ ok: z.boolean(), rows: z.number().int() }), objects: z.object({ checked: z.number().int(), total: z.number().int(), corrupt: z.array(z.string()), missing: z.array(z.string()), sampled: z.boolean() }), durationMs: z.number().int(), problem: z.string().nullable(), at: z.iso.datetime() })
    .nullable(),
});
export type BackupStatus = z.infer<typeof BackupStatus>;

/* Media (phase 22) ----------------------------------------------------------- */

export const MediaItem = z.object({
  fileId: Ulid,
  name: z.string(),
  kind: z.enum(["video", "audio"]),
  size: z.number().int(),
  durationS: z.number().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  codec: z.string().nullable(),
  /** False means the box transcodes on the fly; seeking is limited. */
  playable: z.boolean(),
  modifiedAt: z.iso.datetime(),
  namespace: Namespace,
});
export type MediaItem = z.infer<typeof MediaItem>;

