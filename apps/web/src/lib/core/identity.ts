"use client";

import { ActionRecord, Alert, HouseholdView, Invitation, Memory, MemorySettings, SessionView, type NewInvitation, type Person, DeviceToken } from "@woven/schema";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { z } from "zod";
import { CoreError } from "./client";
import { coreClient } from "./store";
import { deviceHeaders, rememberDevice } from "./device";

/**
 * Identity against the connected Core (phase 8): setting up the house,
 * passkeys, recovery codes and the device session. Every call sends the
 * session cookie; nothing here is used when no Core is connected.
 */
export class NoCoreError extends Error {
  constructor() {
    super("No Core is connected.");
    this.name = "NoCoreError";
  }
}

function base(): string {
  const c = coreClient();
  if (!c) throw new NoCoreError();
  return c.base;
}

async function call<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...deviceHeaders(), ...(init.headers ?? {}) },
  });
  // A fresh session comes with the device secret, once; keep it outside the cookie jar.
  const secret = res.headers.get("x-woven-device-secret");
  if (secret) rememberDevice(secret);
  if (!res.ok) {
    let message = "";
    try {
      message = ((await res.json()) as { error?: string }).error ?? "";
    } catch {}
    throw new CoreError(res.status, message);
  }
  return schema.parse(await res.json());
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const Options = z.object({ key: z.string(), options: z.record(z.string(), z.unknown()) });
const Setup = z.object({ household: z.object({ id: z.string(), name: z.string() }), owner: z.custom<Person>(), enrolment: z.string(), recoveryCodes: z.array(z.string()) });
const Passkey = z.object({ id: z.string(), credentialId: z.string(), label: z.string().nullable(), createdAt: z.string(), lastUsedAt: z.string().nullable(), transports: z.array(z.string()) });
export type Passkey = z.infer<typeof Passkey>;

export const identity = {
  household: () => call("/v1/household", HouseholdView),
  /** Whether the box has a house yet: the one thing the sign-in pages may ask without a session. */
  setupState: () => call("/v1/household/setup", z.object({ setup: z.boolean(), name: z.string().nullable() })),

  /** null when this device has no live session. */
  async session(): Promise<SessionView | null> {
    try {
      return await call("/v1/auth/session", SessionView);
    } catch (err) {
      if (err instanceof CoreError && err.status === 401) return null;
      throw err;
    }
  },

  /** Create the house and register the owner's first passkey on this device. Recovery codes come back once. */
  async setup(input: { household: string; owner: { name: string; email: string } }): Promise<{ session: SessionView; recoveryCodes: string[] }> {
    const created = await call("/v1/household/setup", Setup, post(input));
    const session = await this.registerPasskey({ enrolment: created.enrolment, label: deviceLabel() });
    return { session, recoveryCodes: created.recoveryCodes };
  },

  /** Register a passkey for the signed-in person, or for the person an enrolment key names. */
  async registerPasskey(opts: { enrolment?: string; label?: string } = {}): Promise<SessionView> {
    const { key, options } = await call("/v1/auth/passkeys/register/options", Options, post({ enrolment: opts.enrolment }));
    const credential = await startRegistration({ optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON });
    const result = await call("/v1/auth/passkeys/register/verify", z.object({ passkey: Passkey, session: SessionView }), post({ key, credential, enrolment: opts.enrolment, label: opts.label }));
    return result.session;
  },

  async loginWithPasskey(email?: string): Promise<SessionView> {
    const { key, options } = await call("/v1/auth/passkeys/login/options", Options, post({ email: email || undefined }));
    const credential = await startAuthentication({ optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON });
    return call("/v1/auth/passkeys/login/verify", SessionView, post({ key, credential }));
  },

  recover: (email: string, code: string) => call("/v1/auth/recover", SessionView, post({ email, code })),

  /** The six digits on the box's screen plus your name: pairs this device as you. */
  loginWithCode: (name: string, code: string) => call("/v1/auth/code/login", SessionView, post({ name, code })),

  /** A fresh passkey assertion for class H approvals (strong authentication). Not a sign-in. */
  async assert(email?: string): Promise<{ key: string; credential: Record<string, unknown> }> {
    const { key, options } = await call("/v1/auth/passkeys/login/options", Options, post({ email: email || undefined }));
    const credential = await startAuthentication({ optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON });
    return { key, credential: credential as unknown as Record<string, unknown> };
  },

  /* Invitations (phase 10) */
  invite: (input: NewInvitation) => call("/v1/household/invitations", Invitation, post(input)),
  invitations: () => call("/v1/household/invitations", z.object({ invitations: z.array(Invitation) })).then((r) => r.invitations),
  withdrawInvitation: (id: string) => call(`/v1/household/invitations/${id}`, z.object({ withdrawn: z.boolean() }), { method: "DELETE" }),
  /** Whoever opens the link: become that person by registering a passkey on this device. */
  async join(token: string): Promise<{ session: SessionView; household: string }> {
    const accepted = await call("/v1/household/invitations/accept", z.object({ person: z.custom<Person>(), household: z.string(), enrolment: z.string() }), post({ token }));
    const session = await this.registerPasskey({ enrolment: accepted.enrolment, label: deviceLabel() });
    return { session, household: accepted.household };
  },
  addPerson: (input: { name: string; email?: string; role: "adult" | "child" | "guest" }) => call("/v1/household/people", z.custom<Person>(), post(input)),
  removePerson: (id: string) => call(`/v1/household/people/${id}`, z.custom<Person>(), { method: "DELETE" }),

  /* Memory (phase 36) */
  memories: () => call("/v1/memory?candidates=true", z.object({ memories: z.array(Memory), settings: MemorySettings })),
  remember: (text: string, kind: "fact" | "preference" | "event" | "routine" = "fact") => call("/v1/memory", Memory, post({ text, kind })),
  confirmMemory: (id: string) => call(`/v1/memory/${id}/confirm`, Memory, post({})),
  editMemory: (id: string, text: string) => call(`/v1/memory/${id}`, Memory, { method: "PATCH", body: JSON.stringify({ text }) }),
  forgetMemory: (id: string) => call(`/v1/memory/${id}`, z.object({ forgotten: z.literal(true) }), { method: "DELETE" }),
  forgetAllMemories: () => call("/v1/memory", z.object({ forgotten: z.number() }), { method: "DELETE" }),
  memorySettings: (s: MemorySettings) => call("/v1/memory/settings", MemorySettings, { method: "PUT", body: JSON.stringify(s) }),
  alerts: () => call("/v1/system/alerts", z.object({ alerts: z.array(Alert) })).then((r) => r.alerts),

  /* Data rights (phase 11) */
  exportData: (scope: "me" | "household") => call("/v1/household/export", z.object({ dir: z.string(), takenAt: z.string(), counts: z.record(z.string(), z.number()) }), post({ scope })),
  deleteAccount: (personId: string) => call(`/v1/household/people/${personId}/account`, z.object({ files: z.number(), objects: z.number() }), { method: "DELETE" }),
  /** Class H: prepare, confirm with this device's passkey, execute. */
  async transferOwnership(toPersonId: string, ownerEmail: string): Promise<ActionRecord> {
    const prepared = await call("/v1/actions/prepare", ActionRecord, post({ capability: "household.transfer_ownership", target: "household", parameters: { toPersonId } }));
    if (prepared.status !== "prepared") return prepared;
    const assertion = await this.assert(ownerEmail);
    const approved = await call(`/v1/actions/${prepared.id}/approve`, ActionRecord, post({ assertion }));
    if (approved.status !== "approved") return approved;
    return call(`/v1/actions/${prepared.id}/execute`, ActionRecord, post({}));
  },

  passkeys: () => call("/v1/auth/passkeys", z.object({ passkeys: z.array(Passkey), recoveryCodesLeft: z.number() })),
  removePasskey: (id: string) => call(`/v1/auth/passkeys/${id}`, z.object({ removed: z.boolean() }), { method: "DELETE" }),
  newRecoveryCodes: () => call("/v1/auth/recovery-codes", z.object({ recoveryCodes: z.array(z.string()) }), { method: "POST" }),
  logoutOthers: () => call("/v1/auth/logout-others", z.object({ signedOut: z.number() }), { method: "POST" }),
  /* Device tokens for backup clients (gap 20) */
  tokens: () => call("/v1/auth/tokens", z.object({ tokens: z.array(DeviceToken) })).then((r) => r.tokens),
  newToken: (label: string) => call("/v1/auth/tokens", DeviceToken.extend({ token: z.string() }), post({ label })),
  revokeToken: (id: string) => call(`/v1/auth/tokens/${id}`, z.object({ revoked: z.boolean() }), { method: "DELETE" }),

  async logout(): Promise<void> {
    try {
      await call("/v1/auth/logout", z.object({ ok: z.literal(true) }), { method: "POST" });
    } catch {
      // Signing out locally still happens; the session expires on the box regardless.
    }
    rememberDevice(null);
  },
};

/** "Safari on Mac", "Chrome on Android": a label the person recognises in their passkey list. */
export type { Memory, MemorySettings, Alert };

export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

/** What a failed WebAuthn call should say to a person. */
export function explain(err: unknown): string {
  if (err instanceof NoCoreError) return "Your Core is not reachable right now.";
  if (err instanceof CoreError) return err.message || "The Core refused that.";
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") return "The device prompt was cancelled or timed out.";
    if (err.name === "InvalidStateError") return "This device already has a passkey for this house.";
    if (err.name === "SecurityError") return "Passkeys need a secure page. Open the dashboard over HTTPS or on localhost.";
    return err.message;
  }
  return "Something went wrong.";
}

/** A local session record from what the Core said. */
export function sessionRecord(view: SessionView, method: "passkey" | "code" | "recovery") {
  return {
    household: view.household.name,
    name: view.person.name,
    email: view.person.email ?? "",
    method,
    personId: view.person.id,
    role: view.person.role,
    simulated: false as const,
  };
}

export type { DeviceToken };
