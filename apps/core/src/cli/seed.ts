/**
 * `pnpm seed`: a demo household for development and the live end-to-end
 * suite. Idempotent: running it twice changes nothing. Never run against a
 * household that people actually live in; it refuses if one exists.
 */
import { detectHardware } from "@woven/hal";
import { eq } from "drizzle-orm";
import { loadConfig } from "../config.ts";
import { openData } from "../data.ts";
import { households, people } from "../db/schema.ts";

export const DEMO_HOUSEHOLD_ID = "01J9Z0DEM0H0ME000000000001";

const config = loadConfig();
const { paths } = detectHardware({ dataRoot: config.dataRoot });
const data = await openData(paths);
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
  console.log(`Seeded "Alex's house" with 3 people and ${data.ledger.head()?.seq ?? 0} ledger rows.`);
} finally {
  data.close();
}
