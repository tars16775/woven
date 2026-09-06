/**
 * `pnpm seed`: a demo household for development and the live end-to-end
 * suite. Idempotent: running it twice changes nothing. Never run against a
 * household that people actually live in; it refuses if one exists.
 */
import { detectHardware } from "@woven/hal";
import { eq } from "drizzle-orm";
import { loadConfig } from "../config.ts";
import { openData } from "../data.ts";
import { KeyStore } from "../keystore.ts";
import { households, people } from "../db/schema.ts";
import { RecoveryService } from "../auth/recovery.ts";
import { buildServices } from "../services.ts";
import { GateClient } from "../gate/client.ts";
import { Person } from "@woven/schema";

export const DEMO_HOUSEHOLD_ID = "01J9Z0DEM0H0ME000000000001";

const config = loadConfig();
const { paths } = detectHardware({ dataRoot: config.dataRoot });
const key = await new KeyStore(config.keyStore, paths.keys, config.dataRoot).load();
const data = await openData(paths, { key });
const services = buildServices(data, config, new GateClient(null, "seed"));
try {
  const existing = data.database.db.select().from(households).all();
  const other = existing.find((h) => h.id !== DEMO_HOUSEHOLD_ID);
  if (other) {
    console.error(`A real household ("${other.name}") already lives here; not seeding.`);
    process.exit(2);
  }
  if (existing.length) {
    console.log("Demo household already present; nothing to do.");
    process.exit(0);
  }
  const now = new Date().toISOString();
  // One transaction: the rows and their ledger entries appear together or not at all.
  data.database.db.transaction((tx) => {
    tx.insert(households).values({ id: DEMO_HOUSEHOLD_ID, name: "Alex's house", createdAt: now }).run();
    tx.insert(people)
      .values([
        { id: "01J9Z0DEM0PERS0N0A1EX00001", householdId: DEMO_HOUSEHOLD_ID, name: "Alex", email: "alex@example.com", role: "owner", createdAt: now },
        { id: "01J9Z0DEM0PERS0N0MAYA00002", householdId: DEMO_HOUSEHOLD_ID, name: "Maya", email: "maya@example.com", role: "adult", createdAt: now },
        { id: "01J9Z0DEM0PERS0N0SAM000003", householdId: DEMO_HOUSEHOLD_ID, name: "Sam", email: null, role: "child", createdAt: now },
      ])
      .run();
    const core = { kind: "core" as const, id: "core" };
    data.ledger.append({ type: "household.created", householdId: DEMO_HOUSEHOLD_ID, actor: core, where: "inside", payload: { name: "Alex's house" } });
    for (const p of tx.select().from(people).where(eq(people.householdId, DEMO_HOUSEHOLD_ID)).all()) {
      data.ledger.append({ type: "person.created", householdId: DEMO_HOUSEHOLD_ID, actor: core, where: "inside", target: p.id, payload: { role: p.role } });
    }
  });
  // The three starter routines every new house gets.
  const alexPerson = Person.parse(data.database.db.select().from(people).where(eq(people.id, "01J9Z0DEM0PERS0N0A1EX00001")).get());
  services.routines.ensureStarters(alexPerson);
  // WOVEN_DEMO_RECOVERY_CODE (comma-separated) gives the demo owner known
  // recovery codes so the end-to-end suite can sign in. Only the demo household ever gets them.
  const demoCode = process.env.WOVEN_DEMO_RECOVERY_CODE;
  if (demoCode) {
    const alex = Person.parse(data.database.db.select().from(people).where(eq(people.id, "01J9Z0DEM0PERS0N0A1EX00001")).get());
    new RecoveryService(data.database.db).store(alex, demoCode.split(",").map((c) => c.trim()).filter(Boolean));
  }
  console.log(`Seeded "Alex's house" with 3 people and ${data.ledger.head()?.seq ?? 0} ledger rows${demoCode ? ", with a demo recovery code" : ""}.`);
} finally {
  data.close();
}
