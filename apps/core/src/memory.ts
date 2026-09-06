import { Memory, type MemorySettings, type NewMemory, type Person } from "@woven/schema";
import { and, eq, isNull } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "./db/index.ts";
import { memories, settings } from "./db/schema.ts";
import { HouseholdError } from "./household.ts";
import type { Ledger } from "./ledger.ts";

const nextId = monotonicFactory();
const DEFAULTS: MemorySettings = { retentionDays: 365, candidateDays: 7 };

/**
 * Per-person memory (phase 36). The person owns it outright: view, edit,
 * delete, and decide how long anything is kept. A remark Tandem noticed is a
 * candidate; it becomes durable only when the person says so or it comes up
 * again. Nobody else in the household can read it, the owner included.
 */
export class MemoryService {
  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  settingsFor(person: Person): MemorySettings {
    const row = this.db.select().from(settings).where(eq(settings.key, `memory.${person.id}`)).get();
    if (!row) return DEFAULTS;
    try {
      return { ...DEFAULTS, ...(JSON.parse(row.value) as Partial<MemorySettings>) };
    } catch {
      return DEFAULTS;
    }
  }

  setSettings(person: Person, next: MemorySettings): MemorySettings {
    const now = this.now().toISOString();
    this.db.insert(settings).values({ key: `memory.${person.id}`, value: JSON.stringify(next), updatedAt: now }).onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(next), updatedAt: now } }).run();
    // Retention applies to what is already there.
    for (const m of this.list(person, { includeCandidates: true })) {
      const expiresAt = this.expiry(m.status, next, m.createdAt);
      this.db.update(memories).set({ expiresAt }).where(eq(memories.id, m.id)).run();
    }
    return next;
  }

  private expiry(status: "candidate" | "durable", s: MemorySettings, from: string): string | null {
    const base = new Date(from).getTime();
    if (status === "candidate") return new Date(base + s.candidateDays * 86400_000).toISOString();
    return s.retentionDays === null ? null : new Date(base + s.retentionDays * 86400_000).toISOString();
  }

  list(person: Person, opts: { includeCandidates?: boolean } = {}): Memory[] {
    this.sweep(person);
    return this.db
      .select()
      .from(memories)
      .where(and(eq(memories.personId, person.id), isNull(memories.deletedAt)))
      .orderBy(memories.createdAt)
      .all()
      .filter((m) => opts.includeCandidates || m.status === "durable")
      .map((m) => Memory.parse(m));
  }

  /** The person says it themselves: durable at once. */
  remember(person: Person, input: NewMemory): Memory {
    return this.insert(person, input, "person", "durable");
  }

  /**
   * Tandem noticed something. A passing remark is a candidate; the same thing
   * noticed twice becomes durable, because it was not passing after all.
   */
  notice(person: Person, input: NewMemory): Memory {
    const same = this.db
      .select()
      .from(memories)
      .where(and(eq(memories.personId, person.id), isNull(memories.deletedAt), eq(memories.text, input.text)))
      .get();
    if (same) {
      const s = this.settingsFor(person);
      const status = "durable" as const;
      const now = this.now().toISOString();
      this.db.update(memories).set({ seen: same.seen + 1, status, expiresAt: this.expiry(status, s, now), updatedAt: now }).where(eq(memories.id, same.id)).run();
      if (same.status === "candidate") this.ledger.append({ type: "memory.created", householdId: person.householdId, actor: { kind: "agent", id: "tandem" }, where: "inside", target: same.id, sensitivity: "high", payload: { kind: same.kind, becameDurable: true, seen: same.seen + 1 } });
      return Memory.parse(this.db.select().from(memories).where(eq(memories.id, same.id)).get());
    }
    return this.insert(person, input, "tandem", "candidate");
  }

  confirm(person: Person, id: string): Memory {
    const m = this.mine(person, id);
    const now = this.now().toISOString();
    this.db.update(memories).set({ status: "durable", expiresAt: this.expiry("durable", this.settingsFor(person), now), updatedAt: now }).where(eq(memories.id, id)).run();
    this.ledger.append({ type: "memory.created", householdId: person.householdId, actor: { kind: "person", id: person.id }, where: "inside", target: id, sensitivity: "high", payload: { kind: m.kind, confirmed: true } });
    return Memory.parse(this.db.select().from(memories).where(eq(memories.id, id)).get());
  }

  edit(person: Person, id: string, text: string): Memory {
    this.mine(person, id);
    this.db.update(memories).set({ text, updatedAt: this.now().toISOString() }).where(eq(memories.id, id)).run();
    return Memory.parse(this.db.select().from(memories).where(eq(memories.id, id)).get());
  }

  /** Gone: the row is tombstoned and the text blanked, so not even a backup of the database keeps it after the next snapshot. */
  forget(person: Person, id: string): void {
    const m = this.mine(person, id);
    this.db.update(memories).set({ deletedAt: this.now().toISOString(), text: "" }).where(eq(memories.id, id)).run();
    this.ledger.append({ type: "memory.deleted", householdId: person.householdId, actor: { kind: "person", id: person.id }, where: "inside", target: id, sensitivity: "high", payload: { kind: m.kind, wasDurable: m.status === "durable" } });
  }

  forgetAll(person: Person): number {
    const all = this.list(person, { includeCandidates: true });
    for (const m of all) this.forget(person, m.id);
    return all.length;
  }

  /** Expired memories are forgotten quietly; runs on every list and nightly. */
  sweep(person?: Person): number {
    const now = this.now().toISOString();
    const rows = this.db.select().from(memories).where(person ? and(eq(memories.personId, person.id), isNull(memories.deletedAt)) : isNull(memories.deletedAt)).all();
    let n = 0;
    for (const m of rows) {
      if (m.expiresAt && m.expiresAt <= now) {
        this.db.update(memories).set({ deletedAt: now, text: "" }).where(eq(memories.id, m.id)).run();
        this.ledger.append({ type: "memory.deleted", householdId: m.householdId, actor: { kind: "core", id: "core" }, where: "inside", target: m.id, sensitivity: "high", payload: { kind: m.kind, reason: m.status === "candidate" ? "never confirmed" : "retention" } });
        n += 1;
      }
    }
    return n;
  }

  private insert(person: Person, input: NewMemory, source: "person" | "tandem", status: "candidate" | "durable"): Memory {
    const now = this.now().toISOString();
    const id = nextId();
    const s = this.settingsFor(person);
    this.db.insert(memories).values({ id, householdId: person.householdId, personId: person.id, text: input.text, kind: input.kind, status, source, seen: 1, createdAt: now, updatedAt: now, expiresAt: this.expiry(status, s, now) }).run();
    if (status === "durable") this.ledger.append({ type: "memory.created", householdId: person.householdId, actor: source === "person" ? { kind: "person", id: person.id } : { kind: "agent", id: "tandem" }, where: "inside", target: id, sensitivity: "high", payload: { kind: input.kind, source } });
    return Memory.parse(this.db.select().from(memories).where(eq(memories.id, id)).get());
  }

  private mine(person: Person, id: string) {
    const m = this.db.select().from(memories).where(and(eq(memories.id, id), isNull(memories.deletedAt))).get();
    if (!m || m.personId !== person.id) throw new HouseholdError(404, "No such memory of yours.");
    return m;
  }
}
