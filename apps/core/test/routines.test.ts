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
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-routines-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let child: Auth = { cookie: "", device: "" };
type R = { id: string; name: string; trigger: { kind: string }; steps: unknown[]; enabled: boolean; lastResult: string | null };
type Run = { summary: string; steps: { status: string; note: string | null }[] };

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"), { hardware, mdns: false });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: setup.json<{ recoveryCodes: string[] }>().recoveryCodes[0] } }));
  await app.inject({ method: "POST", url: "/v1/household/people", headers: auth(owner), payload: { name: "Sam", email: "sam@example.com", role: "child" } });
  const sam = services.household.personByEmail("sam@example.com")!;
  child = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "sam@example.com", code: services.recovery.issue(sam)[0] } }));
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("routines (phase 27)", () => {
  it("a new house starts with three routines", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/routines", headers: auth(owner) });
    expect(res.json<{ routines: R[] }>().routines.map((r) => r.name)).toEqual(["Goodnight", "Leaving", "Arrive"]);
  });

  it("running Goodnight turns things off, sets the thermostat, locks the door, and leaves receipts", async () => {
    await services.home.apply("living.ceiling", "light.set", { on: true });
    const list = (await app.inject({ method: "GET", url: "/v1/routines", headers: auth(owner) })).json<{ routines: R[] }>().routines;
    const goodnight = list.find((r) => r.name === "Goodnight")!;
    const run = await app.inject({ method: "POST", url: `/v1/routines/${goodnight.id}/run`, headers: auth(owner) });
    expect(run.statusCode).toBe(200);
    expect(run.json<Run>().summary).toBe("4 of 4 steps done");
    expect(services.home.device("living.ceiling")?.state).toMatchObject({ on: false });
    expect(services.home.device("living.thermostat")?.state).toMatchObject({ setpointC: 19 });
    expect(services.home.device("entry.front-door")?.state).toMatchObject({ locked: true });
    const types = data.ledger.recent(undefined, 12).map((r) => r.type);
    expect(types[0]).toBe("action.executed"); // routine.run
    expect(types.filter((t) => t === "action.executed").length).toBeGreaterThanOrEqual(5);
    const routineRow = data.ledger.recent(undefined, 1)[0]!;
    expect(routineRow.payload).toMatchObject({ capability: "routine.run", observed: { done: 4 } });
    const after = (await app.inject({ method: "GET", url: "/v1/routines", headers: auth(owner) })).json<{ routines: R[] }>().routines.find((r) => r.name === "Goodnight")!;
    expect(after.lastResult).toBe("4 of 4 steps done");
  });

  it("a phrase runs the matching routine", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/routines/say", headers: auth(owner), payload: { phrase: "Goodnight" } });
    expect(res.json<Run>().summary).toMatch(/4 of 4/);
    expect((await app.inject({ method: "POST", url: "/v1/routines/say", headers: auth(owner), payload: { phrase: "party time" } })).json()).toBeNull();
  });

  it("a routine can do no more than its author; a class D step still asks", async () => {
    // A child makes a routine that unlocks the door: the step is refused by policy, not by the routine.
    const made = await app.inject({ method: "POST", url: "/v1/routines", headers: auth(child), payload: { name: "Sneak", trigger: { kind: "manual" }, steps: [{ capability: "lock.unlock", target: "entry.front-door", parameters: {} }, { capability: "light.set", target: "bed.bedside", parameters: { on: true } }] } });
    expect(made.statusCode).toBe(201);
    const run = await app.inject({ method: "POST", url: `/v1/routines/${made.json<R>().id}/run`, headers: auth(child) });
    const r = run.json<Run>();
    expect(r.steps[0]).toMatchObject({ status: "declined" });
    expect(r.steps[1]).toMatchObject({ status: "succeeded" });
    expect(r.summary).toBe("1 of 2 steps done · 1 did not run");

    // The owner's unlock with nobody home waits for approval instead.
    services.presence.set(false, "test");
    const ownerMade = await app.inject({ method: "POST", url: "/v1/routines", headers: auth(owner), payload: { name: "Open up", trigger: { kind: "manual" }, steps: [{ capability: "lock.unlock", target: "entry.front-door", parameters: {} }] } });
    const run2 = (await app.inject({ method: "POST", url: `/v1/routines/${ownerMade.json<R>().id}/run`, headers: auth(owner) })).json<Run>();
    expect(run2.steps[0]).toMatchObject({ status: "prepared", note: "waiting for approval" });
    expect(run2.summary).toMatch(/waiting for approval/);
  });

  it("presence flipping runs Leaving and Arrive; the schedule runs on the minute", async () => {
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 100 && !ok(); i += 1) await new Promise((r) => setTimeout(r, 20));
    };
    await services.home.apply("living.ceiling", "light.set", { on: true });
    await services.home.apply("entry.porch", "light.set", { on: false });
    services.presence.set(true, "test"); // first home: Arrive
    await until(() => services.home.device("living.thermostat")?.state.setpointC === 21);
    expect(services.home.device("entry.porch")?.state).toMatchObject({ on: true });
    services.presence.set(false, "test"); // everyone away: Leaving
    await until(() => services.home.device("living.thermostat")?.state.setpointC === 18);
    expect(services.home.device("living.ceiling")?.state).toMatchObject({ on: false });
    expect(services.home.device("entry.front-door")?.state).toMatchObject({ locked: true });

    const at = new Date();
    at.setSeconds(0, 0);
    const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
    await app.inject({ method: "POST", url: "/v1/routines", headers: auth(owner), payload: { name: "Kettle", trigger: { kind: "time", at: hhmm }, steps: [{ capability: "plug.set", target: "kitchen.kettle", parameters: { on: true } }] } });
    expect(await services.routines.tick(at)).toBe(1);
    expect(services.home.device("kitchen.kettle")?.state).toMatchObject({ on: true });
    expect(await services.routines.tick(at)).toBe(0); // not twice in the same minute
  });

  it("only the owner or the author changes or deletes a routine", async () => {
    const list = (await app.inject({ method: "GET", url: "/v1/routines", headers: auth(owner) })).json<{ routines: R[] }>().routines;
    const sneak = list.find((r) => r.name === "Sneak")!;
    expect((await app.inject({ method: "PATCH", url: `/v1/routines/${list[0]!.id}`, headers: auth(child), payload: { enabled: false } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/v1/routines/${sneak.id}`, headers: auth(child), payload: { enabled: false } })).json<R>().enabled).toBe(false);
    expect((await app.inject({ method: "DELETE", url: `/v1/routines/${sneak.id}`, headers: auth(owner) })).json()).toEqual({ removed: true });
  });
});
