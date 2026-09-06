import { createHash, randomInt } from "node:crypto";
import type { Person } from "@woven/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "../db/index.ts";
import { credentials } from "../db/schema.ts";

const nextId = monotonicFactory();
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i
export const RESCUE_MINUTES = 30;
/** Below this many unused recovery codes the household hears about it. */
export const LOW_CODES = 3;

/** "kq7m-v3xz": two groups, lower case, unambiguous letters; written on paper. */
export function formatCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function normalizeCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hashCode(personId: string, code: string): string {
  return createHash("sha256").update(`${personId}:${normalizeCode(code)}`).digest("hex");
}

/**
 * Recovery codes (phase 8): eight single-use codes shown once when the
 * household is set up, so losing every device does not mean losing the
 * house. Stored hashed; a used code is revoked, never deleted.
 */
export class RecoveryService {
  constructor(private readonly db: Db) {}

  issue(person: Person, count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i += 1) {
      let raw = "";
      for (let j = 0; j < 8; j += 1) raw += ALPHABET[randomInt(ALPHABET.length)];
      codes.push(formatCode(raw));
    }
    this.store(person, codes);
    return codes;
  }

  /** Replace a person's codes with exactly these. The seed uses it for the demo household; nothing else should. */
  store(person: Person, codes: string[]): void {
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      // Fresh set replaces any earlier one.
      tx.update(credentials)
        .set({ revokedAt: now })
        .where(and(eq(credentials.personId, person.id), eq(credentials.kind, "recovery"), isNull(credentials.revokedAt)))
        .run();
      codes.forEach((code, i) => {
        tx.insert(credentials)
          .values({ id: nextId(), personId: person.id, kind: "recovery", credentialId: hashCode(person.id, code), publicKey: "", counter: 0, label: `recovery ${i + 1}`, createdAt: now })
          .run();
      });
    });
  }

  /**
   * A rescue code (gap 4): one code, good for thirty minutes, that a trusted
   * adult hands to someone who lost every device and their paper codes. It
   * signs them in once, like a recovery code, so they can add a passkey.
   */
  rescue(person: Person, byPersonId: string, now = new Date()): { code: string; expiresAt: string } {
    let raw = "";
    for (let j = 0; j < 8; j += 1) raw += ALPHABET[randomInt(ALPHABET.length)];
    const code = formatCode(raw);
    const expiresAt = new Date(now.getTime() + RESCUE_MINUTES * 60_000).toISOString();
    this.db.transaction((tx) => {
      tx.update(credentials)
        .set({ revokedAt: now.toISOString() })
        .where(and(eq(credentials.personId, person.id), eq(credentials.kind, "rescue"), isNull(credentials.revokedAt)))
        .run();
      tx.insert(credentials)
        .values({ id: nextId(), personId: person.id, kind: "rescue", credentialId: hashCode(person.id, code), publicKey: "", counter: 0, label: `rescue by ${byPersonId}`, createdAt: now.toISOString(), expiresAt })
        .run();
    });
    return { code, expiresAt };
  }

  /** Consume a code; true when it was one of this person's unused recovery codes or their live rescue code. */
  redeem(person: Person, code: string, now = new Date()): boolean {
    const nowIso = now.toISOString();
    const row = this.db
      .select({ id: credentials.id, kind: credentials.kind, expiresAt: credentials.expiresAt })
      .from(credentials)
      .where(and(eq(credentials.personId, person.id), inArray(credentials.kind, ["recovery", "rescue"]), eq(credentials.credentialId, hashCode(person.id, code)), isNull(credentials.revokedAt)))
      .get();
    if (!row) return false;
    if (row.kind === "rescue" && (!row.expiresAt || row.expiresAt <= nowIso)) return false;
    this.db.update(credentials).set({ revokedAt: nowIso, lastUsedAt: nowIso }).where(eq(credentials.id, row.id)).run();
    return true;
  }

  remaining(person: Person): number {
    return this.db
      .select({ id: credentials.id })
      .from(credentials)
      .where(and(eq(credentials.personId, person.id), eq(credentials.kind, "recovery"), isNull(credentials.revokedAt)))
      .all().length;
  }
}
