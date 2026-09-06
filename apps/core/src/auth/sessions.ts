import { createHash, randomBytes } from "node:crypto";
import type { AuthMethod, Person } from "@woven/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "../db/index.ts";
import { people, sessions } from "../db/schema.ts";
import type { Ledger } from "../ledger.ts";

const nextId = monotonicFactory();
export const SESSION_COOKIE = "woven_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export type IssuedSession = { token: string; id: string; expiresAt: string };
export type ResolvedSession = {
  id: string;
  personId: string;
  method: AuthMethod;
  createdAt: string;
  expiresAt: string;
  person: Person;
};

/** The token itself only ever lives in the cookie; the database holds its hash. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Device sessions (phase 8). A session is a random token bound to one
 * person, one device label and one sign-in method, revocable at any time.
 * Every start and end is a ledger row.
 */
export class SessionService {
  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  issue(person: Person, method: AuthMethod, deviceLabel: string | null): IssuedSession {
    const token = randomBytes(32).toString("base64url");
    const id = nextId();
    const created = this.now();
    const expiresAt = new Date(created.getTime() + THIRTY_DAYS).toISOString();
    this.db.transaction((tx) => {
      tx.insert(sessions)
        .values({ id, personId: person.id, tokenHash: hashToken(token), deviceLabel, method, createdAt: created.toISOString(), expiresAt })
        .run();
      this.ledger.append({
        type: "session.started",
        householdId: person.householdId,
        actor: { kind: "person", id: person.id },
        where: "inside",
        sensitivity: "low",
        payload: { method, device: deviceLabel ?? "unknown device" },
      });
    });
    return { token, id, expiresAt };
  }

  resolve(token: string | undefined): ResolvedSession | null {
    if (!token || token.length < 32) return null;
    const nowIso = this.now().toISOString();
    const row = this.db
      .select({ s: sessions, p: people })
      .from(sessions)
      .innerJoin(people, eq(people.id, sessions.personId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, nowIso), isNull(people.removedAt)))
      .get();
    if (!row) return null;
    if (row.p.expiresAt && row.p.expiresAt <= nowIso) return null; // a guest whose stay has ended
    return {
      id: row.s.id,
      personId: row.s.personId,
      method: row.s.method,
      createdAt: row.s.createdAt,
      expiresAt: row.s.expiresAt,
      person: row.p,
    };
  }

  revoke(token: string): boolean {
    const found = this.resolve(token);
    if (!found) return false;
    this.db.transaction((tx) => {
      tx.update(sessions).set({ revokedAt: this.now().toISOString() }).where(eq(sessions.id, found.id)).run();
      this.ledger.append({
        type: "session.ended",
        householdId: found.person.householdId,
        actor: { kind: "person", id: found.personId },
        where: "inside",
        sensitivity: "low",
        payload: { reason: "signed out" },
      });
    });
    return true;
  }

  /** Every other device signs out; the current one stays. */
  revokeOthers(person: Person, keepSessionId: string): number {
    const nowIso = this.now().toISOString();
    const open = this.db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.personId, person.id), isNull(sessions.revokedAt))).all();
    let n = 0;
    for (const s of open) {
      if (s.id === keepSessionId) continue;
      this.db.update(sessions).set({ revokedAt: nowIso }).where(eq(sessions.id, s.id)).run();
      n += 1;
    }
    if (n) {
      this.ledger.append({ type: "session.ended", householdId: person.householdId, actor: { kind: "person", id: person.id }, where: "inside", sensitivity: "low", payload: { reason: "other devices signed out", count: n } });
    }
    return n;
  }
}

/** Set-Cookie attributes for the session. Secure everywhere a browser will accept it; SameSite=None so the dashboard on another port can send it. */
export function sessionCookie(token: string, expiresAt: string, opts: { secure: boolean }): { name: string; value: string; options: CookieOptions } {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: { path: "/", httpOnly: true, secure: opts.secure, sameSite: opts.secure ? "none" : "lax", expires: new Date(expiresAt) },
  };
}

export type CookieOptions = { path: string; httpOnly: boolean; secure: boolean; sameSite: "none" | "lax" | "strict"; expires: Date };
