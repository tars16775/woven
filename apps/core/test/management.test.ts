import { mkdtempSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { auth, sessionOf, type Auth } from "./helpers.ts";
import { scrub } from "../src/diagnostics.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-mgmt-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let restarts = 0;

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  services = buildServices(data, config, new GateClient(null, "test"), { hardware, mdns: false });
  const logFile = join(dataRoot, "core.log");
  await writeFile(logFile, `{"level":30,"msg":"Ready.","email":"alex@example.com","ip":"192.168.0.12"}\n`);
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date(), logFile, restart: () => void (restarts += 1) });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: setup.json<{ recoveryCodes: string[] }>().recoveryCodes[0] } }));
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("core management (phase 45)", () => {
  it("reports the volume's health", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/system/storage", headers: auth(owner) });
    expect(res.statusCode).toBe(200);
    const s = res.json<{ totalBytes: number; freeBytes: number; smart: string }>();
    expect(s.totalBytes).toBeGreaterThan(0);
    expect(s.freeBytes).toBeLessThanOrEqual(s.totalBytes);
    expect(["verified", "failing", "unknown"]).toContain(s.smart);
  });

  it("scrubs anything personal out of a diagnostics bundle", async () => {
    expect(scrub("alex@example.com at 192.168.0.12 mac 00:58:28:6c:94:db id 01J9Z0G0000000000000000001")).toBe("[email] at [ip] mac [mac] id [id]");
    const res = await app.inject({ method: "POST", url: "/v1/system/diagnostics", headers: auth(owner) });
    expect(res.statusCode).toBe(200);
    const { dir, files } = res.json<{ dir: string; files: string[] }>();
    expect(files).toEqual(expect.arrayContaining(["about.json", "config.json", "metrics.json", "household.json", "integrity.json", "gate.json", "log-tail.txt"]));
    for (const f of files) {
      const text = await readFile(join(dir, f), "utf8");
      expect(text).not.toMatch(/alex@example\.com|Alex/);
      expect(text).not.toMatch(/\b192\.168\.\d+\.\d+\b/);
    }
    const household = JSON.parse(await readFile(join(dir, "household.json"), "utf8")) as { people: number; roles: string[] };
    expect(household).toMatchObject({ people: 1, roles: ["owner"] });
    expect(await readFile(join(dir, "log-tail.txt"), "utf8")).toContain("[email]");
    expect(data.ledger.recent(undefined, 1)[0]?.payload).toMatchObject({ capability: "core.diagnostics" });
  });

  it("restarts only for the owner and leaves a receipt", async () => {
    await app.inject({ method: "POST", url: "/v1/household/people", headers: auth(owner), payload: { name: "Maya", email: "maya@example.com", role: "adult" } });
    const maya = services.household.personByEmail("maya@example.com")!;
    const adult = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "maya@example.com", code: services.recovery.issue(maya)[0] } }));
    expect((await app.inject({ method: "POST", url: "/v1/system/restart", headers: auth(adult) })).statusCode).toBe(403);
    const res = await app.inject({ method: "POST", url: "/v1/system/restart", headers: auth(owner) });
    expect(res.statusCode).toBe(202);
    await new Promise((r) => setTimeout(r, 500));
    expect(restarts).toBe(1);
    expect(data.ledger.recent(undefined, 1)[0]?.payload).toMatchObject({ capability: "core.restart" });
  });
});
