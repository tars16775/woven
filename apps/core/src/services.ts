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
};

export function buildServices(data: Data, config: Config, gate: GateClient, home: HomeAdapter = new SimulatedAdapter()): Services {
  const { db } = data.database;
  const passkeys = new PasskeyService(db, config.origins);
  const presence = new Presence();
  const household = new HouseholdService(db, data.ledger);
  const rights = new RightsService(db, data.ledger, household, data.store, join(data.paths.root, "exports"));
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
    transferOwnership: (fromId, toId) => {
      const from = household.person(fromId);
      if (!from) throw new Error("no such person");
      const r = rights.transferOwnership(from, toId);
      return { from: r.from.id, to: r.to.id };
    },
  });
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
  };
}
