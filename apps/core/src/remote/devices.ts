import { randomBytes } from "node:crypto";
import type { Person, RemoteDevice } from "@woven/schema";
import { and, eq, isNull } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { SessionService } from "../auth/sessions.ts";
import type { Db } from "../db/index.ts";
import { remoteDevices, sessions } from "../db/schema.ts";
import type { Ledger } from "../ledger.ts";
import { openSecret, sealSecret } from "./frames.ts";

const nextId = monotonicFactory();

/**
 * Devices paired for remote access (gap 21). Pairing happens at home, over
 * the home network: the browser gets a fresh 32-byte frame key and a
 * year-long token; the Core keeps the key sealed under the household key
 * and the token's hash. Away from home the browser reaches the relay,
 * encrypts every request under the key, and the token inside the frame
 * signs it in. Revoking a device drops both.
 */
export class RemoteDevices {
  private readonly cache = new Map<string, { key: Buffer; touched: number }>();

  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly sessions: SessionService,
    private readonly sealKey: Buffer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  pair(person: Person, label: string): { device: RemoteDevice; key: string; token: string; expiresAt: string } {
    if (person.role === "guest" || person.role === "child") throw Object.assign(new Error("Only adults pair devices for remote access."), { statusCode: 403 });
    const issued = this.sessions.issue(person, "token", `remote: ${label}`);
    const key = randomBytes(32);
    const id = nextId();
    const now = this.now().toISOString();
    this.db.transaction((tx) => {
      tx.insert(remoteDevices).values({ id, householdId: person.householdId, personId: person.id, label, keySealed: sealSecret(this.sealKey, key), sessionId: issued.id, createdAt: now }).run();
      this.ledger.append({ type: "remote.paired", householdId: person.householdId, actor: { kind: "person", id: person.id }, where: "inside", sensitivity: "high", payload: { deviceId: id, label } });
    });
    return { device: this.get(id)!, key: key.toString("base64"), token: `${issued.token}.${issued.deviceSecret}`, expiresAt: issued.expiresAt };
  }

  list(person: Person): RemoteDevice[] {
    return this.db
      .select()
      .from(remoteDevices)
      .where(and(eq(remoteDevices.householdId, person.householdId), isNull(remoteDevices.revokedAt)))
      .all()
      .filter((d) => person.role === "owner" || d.personId === person.id)
      .map(toDevice);
  }

  count(): number {
    return this.db.select({ id: remoteDevices.id }).from(remoteDevices).where(isNull(remoteDevices.revokedAt)).all().length;
  }

  revoke(person: Person, id: string): RemoteDevice {
    const row = this.db.select().from(remoteDevices).where(and(eq(remoteDevices.id, id), isNull(remoteDevices.revokedAt))).get();
    if (!row || row.householdId !== person.householdId) throw Object.assign(new Error("No such device."), { statusCode: 404 });
    if (row.personId !== person.id && person.role !== "owner") throw Object.assign(new Error("Only the device's person, or the owner, can remove it."), { statusCode: 403 });
    const now = this.now().toISOString();
    this.db.transaction((tx) => {
      tx.update(remoteDevices).set({ revokedAt: now }).where(eq(remoteDevices.id, id)).run();
      tx.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, row.sessionId)).run();
      this.ledger.append({ type: "remote.revoked", householdId: row.householdId, actor: { kind: "person", id: person.id }, where: "inside", sensitivity: "high", payload: { deviceId: id, label: row.label } });
    });
    this.cache.delete(id);
    return this.get(id)!;
  }

  /** The frame key for a live device, or null. Unsealed once and kept in memory; last-seen is written at most once a minute. */
  keyFor(id: string): Buffer | null {
    const cached = this.cache.get(id);
    const nowMs = this.now().getTime();
    if (cached && nowMs - cached.touched < 60_000) return cached.key;
    const row = this.db.select().from(remoteDevices).where(and(eq(remoteDevices.id, id), isNull(remoteDevices.revokedAt))).get();
    if (!row) {
      this.cache.delete(id);
      return null;
    }
    const key = cached?.key ?? openSecret(this.sealKey, row.keySealed);
    this.cache.set(id, { key, touched: nowMs });
    this.db.update(remoteDevices).set({ lastSeenAt: this.now().toISOString() }).where(eq(remoteDevices.id, id)).run();
    return key;
  }

  private get(id: string): RemoteDevice | null {
    const row = this.db.select().from(remoteDevices).where(eq(remoteDevices.id, id)).get();
    return row ? toDevice(row) : null;
  }
}

function toDevice(row: typeof remoteDevices.$inferSelect): RemoteDevice {
  return { id: row.id, personId: row.personId, label: row.label, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, revokedAt: row.revokedAt };
}
