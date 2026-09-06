import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Person } from "@woven/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "./db/index.ts";
import { actions, credentials, events, files, households, invitations, memories, people, sessions } from "./db/schema.ts";
import { HouseholdError, type HouseholdService } from "./household.ts";
import type { Ledger } from "./ledger.ts";
import type { ContentStore } from "./store/index.ts";

export type ExportManifest = { dir: string; takenAt: string; person: string | null; counts: Record<string, number> };

/**
 * Data rights (phase 11). Export everything as a folder on the volume;
 * delete an account so nothing of theirs remains but the ledger's record
 * that it happened; transfer ownership under strong authentication.
 */
export class RightsService {
  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly household: HouseholdService,
    private readonly store: ContentStore,
    private readonly exportsDir: string,
  ) {}

  /** A person's own data (or the whole household for the owner) as JSON files plus their objects. */
  async exportData(by: Person, scope: "me" | "household"): Promise<ExportManifest> {
    if (scope === "household" && by.role !== "owner") throw new HouseholdError(400, "Only the owner can export the whole household.");
    const takenAt = new Date();
    const stamp = takenAt.toISOString().replace(/[:.]/g, "-");
    const dir = join(this.exportsDir, `${scope === "me" ? by.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "household"}-${stamp}`);
    await mkdir(join(dir, "objects"), { recursive: true, mode: 0o700 });

    const h = this.db.select().from(households).where(eq(households.id, by.householdId)).get();
    const peopleRows = scope === "me" ? [this.db.select().from(people).where(eq(people.id, by.id)).get()!] : this.db.select().from(people).where(eq(people.householdId, by.householdId)).all();
    const fileRows = scope === "me" ? this.db.select().from(files).where(and(eq(files.ownerId, by.id), isNull(files.deletedAt))).all() : this.db.select().from(files).where(and(eq(files.householdId, by.householdId), isNull(files.deletedAt))).all();
    const actionRows = (scope === "me" ? this.db.select().from(actions).where(eq(actions.actorId, by.id)) : this.db.select().from(actions).where(eq(actions.householdId, by.householdId))).all();
    const eventRows = (scope === "me" ? this.db.select().from(events).where(eq(events.actorId, by.id)) : this.db.select().from(events).where(eq(events.householdId, by.householdId))).all();

    const memoryRows = (scope === "me" ? this.db.select().from(memories).where(and(eq(memories.personId, by.id), isNull(memories.deletedAt))) : this.db.select().from(memories).where(and(eq(memories.householdId, by.householdId), isNull(memories.deletedAt)))).all();
    const write = (name: string, value: unknown) => writeFile(join(dir, name), JSON.stringify(value, null, 2), { mode: 0o600 });
    await write("household.json", h);
    await write("memory.json", scope === "me" ? memoryRows : memoryRows.filter((m) => m.personId === by.id)); // the owner's export never carries anyone else's memory
    await write("people.json", peopleRows);
    await write("files.json", fileRows);
    await write("actions.json", actionRows);
    await write("receipts.json", eventRows);
    let objects = 0;
    for (const f of fileRows) {
      if (!(await this.store.has(f.sha256))) continue;
      const chunks: Buffer[] = [];
      for await (const c of this.store.open(f.sha256)) chunks.push(c as Buffer);
      await writeFile(join(dir, "objects", `${f.sha256}${extOf(f.name)}`), Buffer.concat(chunks), { mode: 0o600 });
      objects += 1;
    }
    const counts = { people: peopleRows.length, files: fileRows.length, objects, actions: actionRows.length, receipts: eventRows.length };
    const manifest = { takenAt: takenAt.toISOString(), scope, person: scope === "me" ? by.id : null, counts, checksum: createHash("sha256").update(JSON.stringify(counts)).digest("hex") };
    await write("manifest.json", manifest);
    this.ledger.append({ type: "action.executed", householdId: by.householdId, actor: { kind: "person", id: by.id }, where: "inside", target: scope, sensitivity: "high", payload: { capability: "data.export", planned: { scope }, observed: counts } });
    return { dir, takenAt: takenAt.toISOString(), person: manifest.person, counts };
  }

  /**
   * Delete an account: sessions and passkeys revoked, files tombstoned and
   * their objects removed when nothing else references them, the person row
   * marked removed. The ledger keeps that it happened, not what was there.
   */
  async deleteAccount(target: Person, by: Person): Promise<{ files: number; objects: number }> {
    if (target.role === "owner") throw new HouseholdError(400, "The owner's account cannot be deleted; transfer ownership first.");
    if (by.id !== target.id && by.role !== "owner") throw new HouseholdError(400, "Only the owner can delete someone else's account.");
    const now = new Date().toISOString();
    const owned = this.db.select().from(files).where(and(eq(files.ownerId, target.id), isNull(files.deletedAt))).all();
    const hashes = new Set(owned.map((f) => f.sha256));
    this.db.transaction((tx) => {
      tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.personId, target.id), isNull(sessions.revokedAt))).run();
      tx.update(credentials).set({ revokedAt: now }).where(and(eq(credentials.personId, target.id), isNull(credentials.revokedAt))).run();
      tx.update(invitations).set({ revokedAt: now }).where(and(eq(invitations.personId, target.id), isNull(invitations.acceptedAt))).run();
      tx.update(files).set({ deletedAt: now }).where(and(eq(files.ownerId, target.id), isNull(files.deletedAt))).run();
      tx.update(memories).set({ deletedAt: now, text: "" }).where(and(eq(memories.personId, target.id), isNull(memories.deletedAt))).run();
      tx.update(people).set({ removedAt: now, email: null }).where(eq(people.id, target.id)).run();
      this.ledger.append({ type: "person.removed", householdId: target.householdId, actor: { kind: "person", id: by.id }, where: "inside", target: target.id, sensitivity: "high", payload: { reason: "account deleted", files: owned.length } });
    });
    let objects = 0;
    for (const sha of hashes) {
      const stillUsed = this.db.select({ id: files.id }).from(files).where(and(eq(files.sha256, sha), isNull(files.deletedAt))).get();
      if (stillUsed) continue;
      await this.store.remove(sha);
      objects += 1;
    }
    return { files: owned.length, objects };
  }

  /** Make another adult the owner; the previous owner becomes an adult. Called by the class H executor after strong authentication. */
  transferOwnership(from: Person, toPersonId: string): { from: Person; to: Person } {
    if (from.role !== "owner") throw new HouseholdError(400, "Only the owner can transfer ownership.");
    const to = this.household.person(toPersonId);
    if (!to || to.removedAt || to.householdId !== from.householdId) throw new HouseholdError(404, "No such person in this household.");
    if (to.role !== "adult") throw new HouseholdError(400, "Ownership can only pass to an adult.");
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      tx.update(people).set({ role: "adult" }).where(eq(people.id, from.id)).run();
      tx.update(people).set({ role: "owner" }).where(eq(people.id, to.id)).run();
      // Recovery codes belong to the role of owner; the old set stops working.
      tx.update(credentials).set({ revokedAt: now }).where(and(eq(credentials.personId, from.id), eq(credentials.kind, "recovery"), isNull(credentials.revokedAt))).run();
    });
    return { from: this.household.person(from.id)!, to: this.household.person(to.id)! };
  }
}

function extOf(name: string): string {
  const m = /\.[a-z0-9]{1,8}$/i.exec(name);
  return m ? m[0].toLowerCase() : "";
}
