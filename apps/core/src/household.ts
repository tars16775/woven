import { Namespace, Person, type Household, type HouseholdView, type NewPerson, type Role, type SetupHousehold } from "@woven/schema";
import { namespaceAccess } from "@woven/policy";
import { and, eq, isNull } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "./db/index.ts";
import { households, people } from "./db/schema.ts";
import type { Ledger } from "./ledger.ts";

const nextId = monotonicFactory();

export class HouseholdError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "HouseholdError";
  }
}

/**
 * The household model (phase 7). One household per box; people with roles;
 * every change is a ledger row. Namespaces are not rows: a namespace is a
 * label on data, and who may read it follows from role (packages/policy)
 * plus ownership, so two people's `personal` data never meet.
 */
export class HouseholdService {
  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
  ) {}

  view(): HouseholdView {
    const h = this.db.select().from(households).limit(1).get();
    if (!h) return { setup: false };
    return { setup: true, household: h, people: this.people(h.id) };
  }

  household(): Household | null {
    return this.db.select().from(households).limit(1).get() ?? null;
  }

  people(householdId: string, opts: { includeRemoved?: boolean } = {}): Person[] {
    const rows = this.db
      .select()
      .from(people)
      .where(opts.includeRemoved ? eq(people.householdId, householdId) : and(eq(people.householdId, householdId), isNull(people.removedAt)))
      .orderBy(people.createdAt)
      .all();
    return rows.map((r) => Person.parse(r));
  }

  person(id: string): Person | null {
    const row = this.db.select().from(people).where(eq(people.id, id)).get();
    return row ? Person.parse(row) : null;
  }

  personByEmail(email: string): Person | null {
    const row = this.db.select().from(people).where(and(eq(people.email, email.toLowerCase()), isNull(people.removedAt))).get();
    return row ? Person.parse(row) : null;
  }

  /** First run: the household and its owner, together. Refuses if one exists. */
  setup(input: SetupHousehold): { household: Household; owner: Person } {
    if (this.household()) throw new HouseholdError(409, "This box already has a household.");
    const now = new Date().toISOString();
    const householdId = nextId();
    const ownerId = nextId();
    return this.db.transaction((tx) => {
      tx.insert(households).values({ id: householdId, name: input.household, createdAt: now }).run();
      tx.insert(people).values({ id: ownerId, householdId, name: input.owner.name, email: input.owner.email, role: "owner", createdAt: now }).run();
      const core = { kind: "core" as const, id: "core" };
      this.ledger.append({ type: "household.created", householdId, actor: core, where: "inside", payload: { name: input.household } });
      this.ledger.append({ type: "person.created", householdId, actor: core, where: "inside", target: ownerId, payload: { role: "owner" } });
      const household = tx.select().from(households).where(eq(households.id, householdId)).get()!;
      const owner = Person.parse(tx.select().from(people).where(eq(people.id, ownerId)).get());
      return { household, owner };
    });
  }

  addPerson(input: NewPerson, by: { id: string; role: Role }): Person {
    const h = this.household();
    if (!h) throw new HouseholdError(404, "No household yet.");
    if (by.role !== "owner" && by.role !== "adult") throw new HouseholdError(400, "Only an owner or adult can add people.");
    if (input.email && this.personByEmail(input.email)) throw new HouseholdError(409, "Someone with that email is already in the household.");
    const id = nextId();
    const now = new Date().toISOString();
    return this.db.transaction((tx) => {
      tx.insert(people).values({ id, householdId: h.id, name: input.name, email: input.email ?? null, role: input.role, createdAt: now }).run();
      this.ledger.append({ type: "person.created", householdId: h.id, actor: { kind: "person", id: by.id }, where: "inside", target: id, payload: { role: input.role } });
      return Person.parse(tx.select().from(people).where(eq(people.id, id)).get());
    });
  }

  /** Soft removal: the row stays so receipts keep their author; the ledger records who removed whom. */
  removePerson(id: string, by: { id: string; role: Role }): Person {
    const target = this.person(id);
    if (!target || target.removedAt) throw new HouseholdError(404, "No such person.");
    if (by.role !== "owner") throw new HouseholdError(400, "Only the owner can remove people.");
    if (target.role === "owner") throw new HouseholdError(400, "The owner cannot be removed; transfer ownership first.");
    const now = new Date().toISOString();
    return this.db.transaction((tx) => {
      tx.update(people).set({ removedAt: now }).where(eq(people.id, id)).run();
      this.ledger.append({ type: "person.removed", householdId: target.householdId, actor: { kind: "person", id: by.id }, where: "inside", target: id, payload: { role: target.role } });
      return Person.parse(tx.select().from(people).where(eq(people.id, id)).get());
    });
  }

  /**
   * Which namespaces a person may read, and whether a piece of data in a
   * namespace belongs to them. `personal` (and health, financial, work) are
   * private to their owner even among adults; `household` is shared.
   */
  canRead(reader: Person, namespace: Namespace, ownerId: string): boolean {
    if (!namespaceAccess[reader.role].has(namespace)) return false;
    if (PRIVATE_NAMESPACES.has(namespace)) return reader.id === ownerId;
    return true;
  }

  namespacesFor(role: Role): Namespace[] {
    return Namespace.options.filter((n) => namespaceAccess[role].has(n));
  }
}

/** Data in these namespaces is one person's, whatever the reader's role. */
export const PRIVATE_NAMESPACES: ReadonlySet<Namespace> = new Set<Namespace>(["personal", "health", "financial", "work"]);
