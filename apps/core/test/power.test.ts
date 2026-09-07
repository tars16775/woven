import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import type { CoreStatus } from "@woven/schema";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { Power } from "../src/power.ts";
import { SettingsStore } from "../src/settings.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-power-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: "http://localhost:3000", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let power: Power;
let owner: Auth = { cookie: "", device: "" };
let maya: Auth = { cookie: "", device: "" };
const hookLog: string[] = [];

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"), { hardware });
  const settings = new SettingsStore(dataRoot);
  power = new Power(settings, services.gate, data.ledger, services.alerts);
  power.attach({ onOff: () => void hookLog.push("off"), onOn: () => void hookLog.push("on") });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date(), settings, power });
  await app.ready();
  await power.resume();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  const codes = setup.json<{ recoveryCodes: string[] }>();
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: codes.recoveryCodes[0] } }));
  await app.inject({ method: "POST", url: "/v1/household/people", headers: auth(owner), payload: { name: "Maya", email: "maya@example.com", role: "adult" } });
  const mayaPerson = services.household.personByEmail("maya@example.com")!;
  maya = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "maya@example.com", code: services.recovery.issue(mayaPerson)[0] } }));
});

afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("the kill switch", () => {
  it("starts on, and only the owner flips it", async () => {
    const status = await app.inject({ method: "GET", url: "/v1/system/status", headers: auth(owner) });
    expect(status.json<CoreStatus>().power).toMatchObject({ power: "on" });
    expect(hookLog).toEqual(["on"]);
    expect((await app.inject({ method: "POST", url: "/v1/system/power", headers: auth(maya), payload: { power: "off" } })).statusCode).toBe(403);
  });

  it("off: nothing answers but the switch, the state persists, the hooks ran, and it comes back", async () => {
    const off = await app.inject({ method: "POST", url: "/v1/system/power", headers: auth(owner), payload: { power: "off" } });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toMatchObject({ power: "off", by: expect.any(String) });
    expect(hookLog).toEqual(["on", "off"]);
    // Household data is out of reach; the state, the alerts and sign-in still answer.
    const files = await app.inject({ method: "GET", url: "/v1/files?namespace=personal&path=/", headers: auth(owner) });
    expect(files.statusCode).toBe(503);
    expect(files.json()).toMatchObject({ power: "off" });
    expect((await app.inject({ method: "POST", url: "/v1/actions/run", headers: auth(owner), payload: { capability: "light.set", target: "kitchen.main", parameters: { on: true } } })).statusCode).toBe(503);
    expect((await app.inject({ method: "GET", url: "/v1/system/status", headers: auth(owner) })).json<CoreStatus>().power?.power).toBe("off");
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: auth(owner) })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/health" })).statusCode).toBe(200);
    expect(services.alerts.list().map((a) => a.id)).toContain("power");
    expect(new SettingsStore(dataRoot).get().power).toBe("off");
    expect(data.ledger.recent(undefined, 3).some((r) => r.type === "core.power" && (r.payload as { power: string }).power === "off")).toBe(true);

    const on = await app.inject({ method: "POST", url: "/v1/system/power", headers: auth(owner), payload: { power: "on" } });
    expect(on.json()).toMatchObject({ power: "on" });
    expect(hookLog).toEqual(["on", "off", "on"]);
    expect((await app.inject({ method: "GET", url: "/v1/files?namespace=personal&path=/", headers: auth(owner) })).statusCode).toBe(200);
    expect(services.alerts.list().map((a) => a.id)).not.toContain("power");
    expect(new SettingsStore(dataRoot).get().power).toBe("on");
  });

  it("a Core that stopped while off starts off", async () => {
    await power.off({ id: "p", name: "Alex" });
    const again = new Power(new SettingsStore(dataRoot), services.gate, data.ledger, services.alerts);
    expect(again.on).toBe(false);
    await power.on_({ id: "p", name: "Alex" });
  });
});
