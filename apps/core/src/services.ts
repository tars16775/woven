import type { Config } from "./config.ts";
import type { Data } from "./data.ts";
import { OneTimeStore } from "./auth/challenges.ts";
import { PasskeyService } from "./auth/passkeys.ts";
import { RecoveryService } from "./auth/recovery.ts";
import { SessionService } from "./auth/sessions.ts";
import { HouseholdService } from "./household.ts";

/** A first passkey may be registered by whoever holds one of these (setup, invitations). */
export type Enrolment = { personId: string; reason: "setup" | "invitation" | "recovery" };

export type Services = {
  household: HouseholdService;
  sessions: SessionService;
  passkeys: PasskeyService;
  recovery: RecoveryService;
  enrolments: OneTimeStore<Enrolment>;
};

export function buildServices(data: Data, config: Config): Services {
  const { db } = data.database;
  return {
    household: new HouseholdService(db, data.ledger),
    sessions: new SessionService(db, data.ledger),
    passkeys: new PasskeyService(db, config.origins),
    recovery: new RecoveryService(db),
    enrolments: new OneTimeStore<Enrolment>(15 * 60 * 1000),
  };
}
