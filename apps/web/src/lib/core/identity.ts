"use client";

import { HouseholdView, SessionView, type Person } from "@woven/schema";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { z } from "zod";
import { CoreError } from "./client";
import { coreClient } from "./store";

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
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
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

  passkeys: () => call("/v1/auth/passkeys", z.object({ passkeys: z.array(Passkey), recoveryCodesLeft: z.number() })),
  removePasskey: (id: string) => call(`/v1/auth/passkeys/${id}`, z.object({ removed: z.boolean() }), { method: "DELETE" }),
  newRecoveryCodes: () => call("/v1/auth/recovery-codes", z.object({ recoveryCodes: z.array(z.string()) }), { method: "POST" }),
  logoutOthers: () => call("/v1/auth/logout-others", z.object({ signedOut: z.number() }), { method: "POST" }),

  async logout(): Promise<void> {
    try {
      await call("/v1/auth/logout", z.object({ ok: z.literal(true) }), { method: "POST" });
    } catch {
      // Signing out locally still happens; the session expires on the box regardless.
    }
  },
};

/** "Safari on Mac", "Chrome on Android": a label the person recognises in their passkey list. */
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
