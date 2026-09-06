import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { OneTimeStore } from "../src/auth/challenges.ts";
import { formatCode, normalizeCode } from "../src/auth/recovery.ts";
import { SESSION_COOKIE } from "../src/auth/sessions.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-identity-`);
const ORIGIN = "http://localhost:3000";
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: ORIGIN });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  services = buildServices(data, config);
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers["set-cookie"] as string | string[] | undefined;
  const list: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const c = list.find((x) => x.startsWith(`${SESSION_COOKIE}=`));
  return c ? c.split(";")[0]! : "";
};

describe("household setup and members (phase 7)", () => {
  let cookie = "";
  let recoveryCodes: string[] = [];
  let enrolment = "";

  it("starts empty", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/household" });
    expect(res.json()).toEqual({ setup: false });
  });

  it("creates the household and owner once, with recovery codes shown once", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/household/setup", headers: { origin: ORIGIN }, payload: { household: "Alex's house", owner: { name: "Alex", email: "Alex@Example.com" } } });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ owner: { role: string; email: string }; recoveryCodes: string[]; enrolment: string }>();
    expect(body.owner.role).toBe("owner");
    expect(body.owner.email).toBe("alex@example.com");
    expect(body.recoveryCodes).toHaveLength(8);
    expect(body.recoveryCodes[0]).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    recoveryCodes = body.recoveryCodes;
    enrolment = body.enrolment;

    const again = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "Other", owner: { name: "B", email: "b@example.com" } } });
    expect(again.statusCode).toBe(409);
    const view = await app.inject({ method: "GET", url: "/v1/household" });
    expect(view.json()).toMatchObject({ setup: true, household: { name: "Alex's house" }, people: [{ name: "Alex", role: "owner" }] });
  });

  it("hands out registration options to the enrolment holder for the allowed origin only", async () => {
    const wrong = await app.inject({ method: "POST", url: "/v1/auth/passkeys/register/options", headers: { origin: "http://evil.example" }, payload: { enrolment } });
    expect(wrong.statusCode).toBe(403);
    const none = await app.inject({ method: "POST", url: "/v1/auth/passkeys/register/options", headers: { origin: ORIGIN }, payload: {} });
    expect(none.statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/v1/auth/passkeys/register/options", headers: { origin: ORIGIN }, payload: { enrolment } });
    expect(ok.statusCode).toBe(200);
    const body = ok.json<{ key: string; options: { rp: { id: string }; user: { name: string }; challenge: string } }>();
    expect(body.options.rp.id).toBe("localhost");
    expect(body.options.user.name).toBe("alex@example.com");
    expect(body.options.challenge.length).toBeGreaterThan(20);
    // A forged credential is refused and does not sign anyone in.
    const credential: Record<string, unknown> = { id: "x", rawId: "x", type: "public-key", response: { clientDataJSON: "e30", attestationObject: "e30" }, clientExtensionResults: {} };
    const forged = await app.inject({ method: "POST", url: "/v1/auth/passkeys/register/verify", headers: { origin: ORIGIN }, payload: { key: body.key, enrolment, credential } });
    expect(forged.statusCode).toBe(400);
  });

  it("signs in with a recovery code, once", async () => {
    const bad = await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: "zzzz-zzzz" } });
    expect(bad.statusCode).toBe(401);
    const res = await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: recoveryCodes[0]!.toUpperCase() } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ person: { name: "Alex" }, method: "recovery", passkeys: 0 });
    cookie = cookieOf(res);
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=.{40,}`));
    expect(String(res.headers["set-cookie"])).toMatch(/HttpOnly/);
    const reuse = await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: recoveryCodes[0]! } });
    expect(reuse.statusCode).toBe(401);
  });

  it("answers the session for the cookie and refuses without it", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/auth/session" })).statusCode).toBe(401);
    const res = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ household: { name: "Alex's house" }, person: { role: "owner" } });
    const keys = await app.inject({ method: "GET", url: "/v1/auth/passkeys", headers: { cookie } });
    expect(keys.json()).toEqual({ passkeys: [], recoveryCodesLeft: 7 });
  });

  it("adds and removes people with roles, refusing what the role forbids", async () => {
    const unauth = await app.inject({ method: "POST", url: "/v1/household/people", payload: { name: "Maya", email: "maya@example.com", role: "adult" } });
    expect(unauth.statusCode).toBe(401);
    const maya = await app.inject({ method: "POST", url: "/v1/household/people", headers: { cookie }, payload: { name: "Maya", email: "maya@example.com", role: "adult" } });
    expect(maya.statusCode).toBe(201);
    const sam = await app.inject({ method: "POST", url: "/v1/household/people", headers: { cookie }, payload: { name: "Sam", role: "child" } });
    expect(sam.statusCode).toBe(201);
    expect(sam.json()).toMatchObject({ email: null, role: "child" });
    const dup = await app.inject({ method: "POST", url: "/v1/household/people", headers: { cookie }, payload: { name: "M2", email: "maya@example.com", role: "guest" } });
    expect(dup.statusCode).toBe(409);
    const owner2 = await app.inject({ method: "POST", url: "/v1/household/people", headers: { cookie }, payload: { name: "X", role: "owner" } });
    expect(owner2.statusCode).toBe(400);

    const ns = await app.inject({ method: "GET", url: "/v1/household/namespaces", headers: { cookie } });
    expect(ns.json()).toMatchObject({ role: "owner" });
    expect(ns.json<{ namespaces: string[] }>().namespaces).toContain("guest");

    const removed = await app.inject({ method: "DELETE", url: `/v1/household/people/${sam.json<{ id: string }>().id}`, headers: { cookie } });
    expect(removed.statusCode).toBe(200);
    expect(removed.json<{ removedAt: string | null }>().removedAt).not.toBeNull();
    const people = (await app.inject({ method: "GET", url: "/v1/household" })).json<{ people: { name: string }[] }>().people;
    expect(people.map((p) => p.name)).toEqual(["Alex", "Maya"]);
    const me = (await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } })).json<{ person: { id: string } }>().person.id;
    const self = await app.inject({ method: "DELETE", url: `/v1/household/people/${me}`, headers: { cookie } });
    expect(self.statusCode).toBe(400);
  });

  it("keeps two people's private namespaces apart", () => {
    const [alex, maya] = services.household.people(services.household.household()!.id);
    expect(services.household.canRead(alex!, "personal", alex!.id)).toBe(true);
    expect(services.household.canRead(alex!, "personal", maya!.id)).toBe(false);
    expect(services.household.canRead(maya!, "household", alex!.id)).toBe(true);
    expect(services.household.canRead(maya!, "guest", maya!.id)).toBe(false);
    expect(services.household.canRead(alex!, "health", maya!.id)).toBe(false);
  });

  it("writes the receipts", () => {
    const types = data.ledger.recent(services.household.household()!.id, 20).map((r) => r.type);
    expect(types).toEqual(expect.arrayContaining(["household.created", "person.created", "person.removed", "session.started"]));
  });

  it("signs out and the cookie stops working; other sessions can be ended", async () => {
    const second = await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: recoveryCodes[1]! } });
    const cookie2 = cookieOf(second);
    const others = await app.inject({ method: "POST", url: "/v1/auth/logout-others", headers: { cookie: cookie2 } });
    expect(others.json()).toEqual({ signedOut: 1 });
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } })).statusCode).toBe(401);
    const out = await app.inject({ method: "POST", url: "/v1/auth/logout", headers: { cookie: cookie2 } });
    expect(out.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: cookie2 } })).statusCode).toBe(401);
  });
});

describe("one-time store and codes", () => {
  it("expires and consumes values once", () => {
    let t = 0;
    const store = new OneTimeStore<string>(1000, () => t);
    const k = store.put("a");
    expect(store.peek(k)).toBe("a");
    expect(store.take(k)).toBe("a");
    expect(store.take(k)).toBeNull();
    const k2 = store.put("b");
    t = 2000;
    expect(store.take(k2)).toBeNull();
    expect(store.size).toBe(0);
  });
  it("normalises codes the way people type them", () => {
    expect(formatCode("abcd2345")).toBe("abcd-2345");
    expect(normalizeCode(" ABCD 2345 ")).toBe("abcd2345");
  });
});
