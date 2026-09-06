import { createHash, randomBytes } from "node:crypto";
import { Invitation, Person, type NewInvitation } from "@woven/schema";
import { and, eq, isNull } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "./db/index.ts";
import { invitations, people } from "./db/schema.ts";
import { HouseholdError, type HouseholdService } from "./household.ts";
import type { Ledger } from "./ledger.ts";

const nextId = monotonicFactory();
const INVITE_DAYS = 7;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Invitations (phase 10). An owner or adult creates the person and a link;
 * whoever opens the link registers a passkey and becomes that person. Guests
 * get an expiry; their sessions stop working when it passes.
 */
export class InvitationService {
  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly household: HouseholdService,
  ) {}

  create(input: NewInvitation, by: Person): Invitation {
    if (by.role !== "owner" && by.role !== "adult") throw new HouseholdError(400, "Only an owner or adult can invite people.");
    if (input.role === "guest" && !input.guestDays) throw new HouseholdError(400, "Say how many days the guest may stay.");
    const person = this.household.addPerson({ name: input.name, ...(input.email ? { email: input.email } : {}), role: input.role }, by);
    const now = new Date();
    const token = randomBytes(24).toString("base64url");
    const id = nextId();
    const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86400_000).toISOString();
    this.db.transaction((tx) => {
      if (input.role === "guest") {
        tx.update(people).set({ expiresAt: new Date(now.getTime() + input.guestDays! * 86400_000).toISOString() }).where(eq(people.id, person.id)).run();
      }
      tx.insert(invitations).values({ id, householdId: person.householdId, personId: person.id, tokenHash: hash(token), createdBy: by.id, createdAt: now.toISOString(), expiresAt }).run();
    });
    return { ...this.view(id)!, token };
  }

  pending(householdId: string): Invitation[] {
    return this.db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.householdId, householdId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
      .all()
      .map((r) => this.view(r.id)!)
      .filter((i) => i.expiresAt > new Date().toISOString());
  }

  /** Exchange the link's token for the person it names, once. */
  accept(token: string): Person {
    const row = this.db.select().from(invitations).where(eq(invitations.tokenHash, hash(token))).get();
    const now = new Date().toISOString();
    if (!row || row.acceptedAt || row.revokedAt || row.expiresAt <= now) throw new HouseholdError(404, "That invitation is no longer valid. Ask for a new one.");
    const person = this.household.person(row.personId);
    if (!person || person.removedAt) throw new HouseholdError(404, "That person is no longer in the household.");
    this.db.update(invitations).set({ acceptedAt: now }).where(eq(invitations.id, row.id)).run();
    return person;
  }

  revoke(id: string, by: Person): boolean {
    const row = this.db.select().from(invitations).where(and(eq(invitations.id, id), isNull(invitations.acceptedAt), isNull(invitations.revokedAt))).get();
    if (!row) return false;
    if (by.role !== "owner" && by.id !== row.createdBy) throw new HouseholdError(400, "Only the owner or whoever sent it can withdraw an invitation.");
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      tx.update(invitations).set({ revokedAt: now }).where(eq(invitations.id, id)).run();
      tx.update(people).set({ removedAt: now }).where(eq(people.id, row.personId)).run();
      this.ledger.append({ type: "person.removed", householdId: row.householdId, actor: { kind: "person", id: by.id }, where: "inside", target: row.personId, payload: { reason: "invitation withdrawn" } });
    });
    return true;
  }

  private view(id: string): Invitation | null {
    const row = this.db.select().from(invitations).where(eq(invitations.id, id)).get();
    if (!row) return null;
    const person = this.db.select().from(people).where(eq(people.id, row.personId)).get();
    return Invitation.parse({ id: row.id, person: Person.parse(person), createdBy: row.createdBy, createdAt: row.createdAt, expiresAt: row.expiresAt, acceptedAt: row.acceptedAt });
  }
}
