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
import { GateClient } from "../src/gate/client.ts";
import { SESSION_COOKIE } from "../src/auth/sessions.ts";
import { ActionError, hashParams } from "../src/actions/engine.ts";
import { actions } from "../src/db/schema.ts";
import { eq } from "drizzle-orm";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-actions-`);
const ORIGIN = "http://localhost:3000";
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: ORIGIN, WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner = "";
let adult = "";
let child = "";
let householdId = "";

const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers["set-cookie"] as string | string[] | undefined;
  const list: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((x) => x.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0] ?? "";
};

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  services = buildServices(data, config, new GateClient(null, "test"));
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  const codes = setup.json<{ recoveryCodes: string[]; household: { id: string } }>();
  householdId = codes.household.id;
  owner = cookieOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: codes.recoveryCodes[0] } }));
  for (const [name, email, role] of [
    ["Maya", "maya@example.com", "adult"],
    ["Sam", "sam@example.com", "child"],
  ] as const) {
    await app.inject({ method: "POST", url: "/v1/household/people", headers: { cookie: owner }, payload: { name, email, role } });
    const person = services.household.personByEmail(email)!;
    const code = services.recovery.issue(person)[0]!;
    const cookie = cookieOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email, code } }));
    if (role === "adult") adult = cookie;
    else child = cookie;
  }
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

type Rec = { id: string; status: string; riskClass?: string; observed?: Record<string, unknown>; decision: { outcome: string; reason: string }; approval?: { by?: string; factors?: string[]; approvedBy?: string | null } | null; error?: string | null };
const run = (cookie: string, body: Record<string, unknown>) => app.inject({ method: "POST", url: "/v1/actions/run", headers: { cookie }, payload: body });

describe("capabilities and one-tap actions", () => {
  it("publishes the registry", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/capabilities" });
    const names = res.json<{ capabilities: { name: string; riskClass: string }[] }>().capabilities;
    expect(names.find((c) => c.name === "lock.unlock")?.riskClass).toBe("D");
    expect(names.some((c) => c.name === "gate.cross")).toBe(true);
  });

  it("runs a class B light change, reads it back, and writes the receipt", async () => {
    const res = await run(owner, { capability: "light.set", target: "kitchen.main", parameters: { on: true, brightness: 60 } });
    expect(res.statusCode).toBe(200);
    expect(res.json<Rec>()).toMatchObject({ status: "succeeded", riskClass: "B", observed: { on: true, brightness: 60 }, decision: { outcome: "allow" } });
    expect(services.home.device("kitchen.main")?.state).toMatchObject({ on: true, brightness: 60 });
    const types = data.ledger.recent(householdId, 5).map((r) => r.type);
    expect(types.slice(0, 3)).toEqual(["action.verified", "action.executed", "action.prepared"]);
  });

  it("refuses bad parameters and unknown capabilities", async () => {
    expect((await run(owner, { capability: "light.set", target: "kitchen.main", parameters: { on: "yes" } })).statusCode).toBe(400);
    expect((await run(owner, { capability: "light.explode", target: "kitchen.main", parameters: {} })).statusCode).toBe(404);
    expect((await run(owner, { capability: "light.set", target: "nowhere", parameters: { on: true } })).json<Rec>()).toMatchObject({ status: "failed" });
  });

  it("is idempotent under a key", async () => {
    const a = await run(owner, { capability: "plug.set", target: "kitchen.kettle", parameters: { on: true }, idempotencyKey: "kettle-morning-1" });
    const b = await run(owner, { capability: "plug.set", target: "kitchen.kettle", parameters: { on: false }, idempotencyKey: "kettle-morning-1" });
    expect(b.json<{ id: string }>().id).toBe(a.json<{ id: string }>().id);
    expect(services.home.device("kitchen.kettle")?.state).toMatchObject({ on: true });
  });
});

describe("policy (phase 13)", () => {
  it("class C stays automatic inside bounds and asks outside them", async () => {
    const ok = await run(owner, { capability: "climate.set_temperature", target: "living.thermostat", parameters: { setpointC: 22 } });
    expect(ok.json<Rec>()).toMatchObject({ status: "succeeded" });
    const hot = await run(owner, { capability: "climate.set_temperature", target: "living.thermostat", parameters: { setpointC: 31 } });
    expect(hot.json<Rec>()).toMatchObject({ status: "prepared", decision: { outcome: "approve" }, approval: { by: "adult" } });
  });

  it("class D: a child cannot touch security; an adult with nobody home must be approved by someone present; an adult at home is automatic", async () => {
    const asChild = await run(child, { capability: "lock.unlock", target: "entry.front-door", parameters: {} });
    expect(asChild.json<Rec>()).toMatchObject({ status: "declined", decision: { outcome: "deny", reason: expect.stringMatching(/security/) } });
    const asAdult = await run(adult, { capability: "lock.unlock", target: "entry.front-door", parameters: {} });
    expect(asAdult.json<Rec>()).toMatchObject({ status: "prepared", approval: { by: "adult", factors: ["presence"] } });
    const approveNobodyHome = await app.inject({ method: "POST", url: `/v1/actions/${asAdult.json<{ id: string }>().id}/approve`, headers: { cookie: owner }, payload: {} });
    expect(approveNobodyHome.statusCode).toBe(403);
    expect(approveNobodyHome.json<Rec>()).toMatchObject({ error: expect.stringMatching(/Nobody is confirmed home/) });

    const childApproves = await app.inject({ method: "POST", url: `/v1/actions/${asAdult.json<{ id: string }>().id}/approve`, headers: { cookie: child }, payload: {} });
    expect(childApproves.statusCode).toBe(403);

    await app.inject({ method: "POST", url: "/v1/home/presence", headers: { cookie: owner }, payload: { adultsHome: true } });
    const approved = await app.inject({ method: "POST", url: `/v1/actions/${asAdult.json<{ id: string }>().id}/approve`, headers: { cookie: owner }, payload: {} });
    expect(approved.json<Rec>()).toMatchObject({ status: "approved", approval: { approvedBy: expect.any(String) } });
    const executed = await app.inject({ method: "POST", url: `/v1/actions/${asAdult.json<{ id: string }>().id}/execute`, headers: { cookie: adult } });
    expect(executed.json<Rec>()).toMatchObject({ status: "succeeded", observed: { locked: false } });
    const receipt = data.ledger.recent(householdId, 3).find((r) => r.type === "action.executed")!;
    expect(receipt.payload).toMatchObject({ planned: {}, observed: { locked: false }, approvedBy: expect.any(String) });

    const adultHome = await run(owner, { capability: "lock.lock", target: "entry.front-door", parameters: {} });
    expect(adultHome.json<Rec>()).toMatchObject({ status: "succeeded" });
    const unlockAgain = await run(owner, { capability: "lock.unlock", target: "entry.front-door", parameters: {} });
    expect(unlockAgain.json<Rec>()).toMatchObject({ status: "succeeded", decision: { reason: "An adult is present." } });
  });

  it("class E: under the limit is automatic, above it asks the buyer, children are refused", async () => {
    const small = await run(owner, { capability: "commerce.order", target: "grocer.example", parameters: { amount: 23.4, items: ["oat milk"] } });
    // The Gate is off in this suite, so the crossing itself is refused at prepare time; the policy decision is still visible.
    expect(small.json<Rec>()).toMatchObject({ status: "declined", decision: { reason: expect.stringMatching(/Gate is closed|Nothing crosses/) } });
    const kid = await run(child, { capability: "commerce.order", target: "grocer.example", parameters: { amount: 5, items: ["sweets"] } });
    expect(kid.json<Rec>()).toMatchObject({ status: "declined", decision: { outcome: "deny", reason: expect.stringMatching(/adults|financial/) } });
  });

  it("class H needs the owner and a fresh passkey", async () => {
    const asChild = await run(child, { capability: "core.factory_reset", target: "core", parameters: { confirm: "erase everything" } });
    expect(asChild.json<Rec>()).toMatchObject({ status: "declined" });
    const asOwner = await run(owner, { capability: "core.factory_reset", target: "core", parameters: { confirm: "erase everything" } });
    expect(asOwner.json<Rec>()).toMatchObject({ status: "prepared", approval: { by: "owner", factors: ["strong_auth"] } });
    const noKey = await app.inject({ method: "POST", url: `/v1/actions/${asOwner.json<{ id: string }>().id}/approve`, headers: { cookie: owner }, payload: {} });
    expect(noKey.statusCode).toBe(403);
    expect(noKey.json<Rec>()).toMatchObject({ error: expect.stringMatching(/passkey/) });
  });

  it("refuses to run an action whose parameters changed after approval", async () => {
    const hot = await run(owner, { capability: "climate.set_temperature", target: "living.thermostat", parameters: { setpointC: 30 } });
    const id = hot.json<{ id: string }>().id;
    expect((await app.inject({ method: "POST", url: `/v1/actions/${id}/approve`, headers: { cookie: owner }, payload: {} })).json<Rec>()).toMatchObject({ status: "approved" });
    // Someone edits the stored parameters behind the policy's back.
    data.database.db.update(actions).set({ parameters: JSON.stringify({ setpointC: 45 }) }).where(eq(actions.id, id)).run();
    const res = await app.inject({ method: "POST", url: `/v1/actions/${id}/execute`, headers: { cookie: owner } });
    expect(res.statusCode).toBe(409);
    expect(res.json<Rec>()).toMatchObject({ error: expect.stringMatching(/changed after it was approved/) });
    expect(services.home.device("living.thermostat")?.state).toMatchObject({ setpointC: 22 });
    expect(hashParams("climate.set_temperature", "living.thermostat", { setpointC: 30 })).not.toBe(hashParams("climate.set_temperature", "living.thermostat", { setpointC: 45 }));
  });

  it("expires what nobody approved", async () => {
    const hot = await run(owner, { capability: "climate.set_temperature", target: "living.thermostat", parameters: { setpointC: 29 } });
    const id = hot.json<{ id: string }>().id;
    data.database.db.update(actions).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(actions.id, id)).run();
    const res = await app.inject({ method: "POST", url: `/v1/actions/${id}/approve`, headers: { cookie: owner }, payload: {} });
    expect(res.statusCode).toBe(409);
    expect((await app.inject({ method: "GET", url: `/v1/actions/${id}`, headers: { cookie: owner } })).json<Rec>()).toMatchObject({ status: "expired" });
    const pending = await app.inject({ method: "GET", url: "/v1/actions?status=prepared", headers: { cookie: owner } });
    expect(pending.json<{ actions: { id: string }[] }>().actions.map((a) => a.id)).not.toContain(id);
  });

  it("the engine never runs a capability twice for the same non-idempotent approval", async () => {
    const hot = await run(owner, { capability: "climate.set_temperature", target: "living.thermostat", parameters: { setpointC: 28.5 } });
    const id = hot.json<{ id: string }>().id;
    await app.inject({ method: "POST", url: `/v1/actions/${id}/approve`, headers: { cookie: owner }, payload: {} });
    const first = await app.inject({ method: "POST", url: `/v1/actions/${id}/execute`, headers: { cookie: owner } });
    expect(first.json<Rec>()).toMatchObject({ status: "succeeded" });
    const again = await app.inject({ method: "POST", url: `/v1/actions/${id}/execute`, headers: { cookie: owner } });
    expect(again.json<Rec>()).toMatchObject({ status: "succeeded" }); // idempotent capability: same record, nothing re-run
    await expect(services.actions.execute(id, { kind: "person", id: "x" })).resolves.toMatchObject({ status: "succeeded" });
    expect(() => services.actions.decline(id, services.household.personByEmail("alex@example.com")!)).toThrow(ActionError);
  });
});

describe("home", () => {
  it("lists rooms, devices and presence for the signed in", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/home" })).statusCode).toBe(401);
    const res = await app.inject({ method: "GET", url: "/v1/home", headers: { cookie: owner } });
    const body = res.json<{ adapter: string; devices: unknown[]; presence: { adultsHome: boolean } }>();
    expect(body.adapter).toBe("simulated");
    expect(body.devices.length).toBeGreaterThan(10);
    expect(body.presence.adultsHome).toBe(true);
    expect((await app.inject({ method: "POST", url: "/v1/home/presence", headers: { cookie: child }, payload: { adultsHome: false } })).statusCode).toBe(403);
  });
});
