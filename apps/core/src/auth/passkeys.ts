import type { Person } from "@woven/schema";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq, isNull } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "../db/index.ts";
import { credentials } from "../db/schema.ts";
import { OneTimeStore } from "./challenges.ts";

const nextId = monotonicFactory();
const RP_NAME = "Woven";

export class PasskeyError extends Error {
  constructor(
    readonly status: 400 | 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "PasskeyError";
  }
}

type RegistrationPending = { personId: string; challenge: string; rpID: string; origin: string };
type AuthenticationPending = { personId: string | null; challenge: string; rpID: string; origin: string };

export type StoredPasskey = { id: string; credentialId: string; label: string | null; createdAt: string; lastUsedAt: string | null; transports: string[] };

/**
 * Passkeys (phase 8) with SimpleWebAuthn. The relying party is whatever
 * origin the dashboard is served from, as long as the core was told to trust
 * it (WOVEN_ORIGINS); the rpID is that origin's host. Challenges live in the
 * one-time store for five minutes.
 */
export class PasskeyService {
  private readonly registrations = new OneTimeStore<RegistrationPending>(5 * 60 * 1000);
  private readonly authentications = new OneTimeStore<AuthenticationPending>(5 * 60 * 1000);

  constructor(
    private readonly db: Db,
    private readonly allowedOrigins: string[],
  ) {}

  /** The origin header must be one the core trusts; the rpID follows from it. */
  relyingParty(origin: string | undefined): { origin: string; rpID: string } {
    if (!origin || !this.allowedOrigins.includes(origin)) throw new PasskeyError(403, "This origin is not allowed to sign in to the core.");
    return { origin, rpID: new URL(origin).hostname };
  }

  list(personId: string): StoredPasskey[] {
    return this.db
      .select()
      .from(credentials)
      .where(and(eq(credentials.personId, personId), eq(credentials.kind, "passkey"), isNull(credentials.revokedAt)))
      .all()
      .map((c) => ({ id: c.id, credentialId: c.credentialId, label: c.label, createdAt: c.createdAt, lastUsedAt: c.lastUsedAt, transports: parseTransports(c.transports) }));
  }

  count(personId: string): number {
    return this.list(personId).length;
  }

  async registrationOptions(person: Person, origin: string | undefined): Promise<{ key: string; options: PublicKeyCredentialCreationOptionsJSON }> {
    const rp = this.relyingParty(origin);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rp.rpID,
      userName: person.email ?? person.name,
      userDisplayName: person.name,
      userID: new TextEncoder().encode(person.id),
      attestationType: "none",
      excludeCredentials: this.list(person.id).map((c) => ({ id: c.credentialId, transports: c.transports })),
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    const key = this.registrations.put({ personId: person.id, challenge: options.challenge, rpID: rp.rpID, origin: rp.origin });
    return { key, options };
  }

  async verifyRegistration(key: string | undefined, response: RegistrationResponseJSON, label: string | null): Promise<{ personId: string; passkey: StoredPasskey }> {
    const pending = this.registrations.take(key);
    if (!pending) throw new PasskeyError(400, "That registration expired. Start again.");
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: pending.origin,
      expectedRPID: pending.rpID,
      requireUserVerification: false,
    }).catch((err: unknown) => {
      throw new PasskeyError(400, err instanceof Error ? err.message : "The passkey could not be verified.");
    });
    if (!result.verified) throw new PasskeyError(400, "The passkey could not be verified.");
    const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
    const now = new Date().toISOString();
    const id = nextId();
    this.db
      .insert(credentials)
      .values({
        id,
        personId: pending.personId,
        kind: "passkey",
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: JSON.stringify(credential.transports ?? []),
        label: label ?? `${credentialDeviceType === "multiDevice" ? "Synced passkey" : "Device passkey"}${credentialBackedUp ? " (backed up)" : ""}`,
        createdAt: now,
      })
      .run();
    const passkey = this.list(pending.personId).find((p) => p.id === id)!;
    return { personId: pending.personId, passkey };
  }

  /** With a person: their credentials are listed. Without: any discoverable passkey for this rpID. */
  async authenticationOptions(person: Person | null, origin: string | undefined): Promise<{ key: string; options: PublicKeyCredentialRequestOptionsJSON }> {
    const rp = this.relyingParty(origin);
    const options = await generateAuthenticationOptions({
      rpID: rp.rpID,
      userVerification: "preferred",
      ...(person ? { allowCredentials: this.list(person.id).map((c) => ({ id: c.credentialId, transports: c.transports })) } : {}),
    });
    const key = this.authentications.put({ personId: person?.id ?? null, challenge: options.challenge, rpID: rp.rpID, origin: rp.origin });
    return { key, options };
  }

  /** Returns the person id the credential belongs to. */
  async verifyAuthentication(key: string | undefined, response: AuthenticationResponseJSON): Promise<string> {
    const pending = this.authentications.take(key);
    if (!pending) throw new PasskeyError(400, "That sign-in expired. Try again.");
    const row = this.db
      .select()
      .from(credentials)
      .where(and(eq(credentials.credentialId, response.id), eq(credentials.kind, "passkey"), isNull(credentials.revokedAt)))
      .get();
    if (!row || (pending.personId && row.personId !== pending.personId)) throw new PasskeyError(401, "No passkey on this box matches that device.");
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: pending.origin,
      expectedRPID: pending.rpID,
      credential: { id: row.credentialId, publicKey: new Uint8Array(Buffer.from(row.publicKey, "base64url")), counter: row.counter, transports: parseTransports(row.transports) },
      requireUserVerification: false,
    }).catch((err: unknown) => {
      throw new PasskeyError(401, err instanceof Error ? err.message : "The passkey could not be verified.");
    });
    if (!result.verified) throw new PasskeyError(401, "The passkey could not be verified.");
    this.db
      .update(credentials)
      .set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() })
      .where(eq(credentials.id, row.id))
      .run();
    return row.personId;
  }

  revoke(personId: string, passkeyId: string): boolean {
    const row = this.db.select().from(credentials).where(and(eq(credentials.id, passkeyId), eq(credentials.personId, personId), eq(credentials.kind, "passkey"), isNull(credentials.revokedAt))).get();
    if (!row) return false;
    this.db.update(credentials).set({ revokedAt: new Date().toISOString() }).where(eq(credentials.id, row.id)).run();
    return true;
  }
}

function parseTransports(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
