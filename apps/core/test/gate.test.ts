import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { startGate, type GateHandle } from "../src/gate/spawn.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-gate-`);
const ORIGIN = "http://localhost:3000";
let outsidePort = 0;
let outsideHits = 0;
const outside = createServer((req, res) => {
  outsideHits += 1;
  let body = "";
  req.on("data", (c: Buffer) => (body += c.toString()));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ echo: body.length, path: req.url }));
  });
});

let gate: GateHandle;
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let householdId = "";


beforeAll(async () => {
  await new Promise<void>((r) => outside.listen(0, "127.0.0.1", r));
  outsidePort = (outside.address() as { port: number }).port;
  const gatePort = 4100 + Math.floor(Math.random() * 500);
  const config = loadConfig({
    NODE_ENV: "test",
    WOVEN_DATA: dataRoot,
    LOG_LEVEL: "fatal",
    WOVEN_MDNS: "off",
    WOVEN_TLS: "off",
    WOVEN_ORIGINS: ORIGIN,
    WOVEN_GATE: "spawn",
    WOVEN_GATE_PORT: String(gatePort),
    WOVEN_GATE_ALLOW: `127.0.0.1:${outsidePort}`,
  });
  const logger = createLogger(config);
  gate = await startGate({ mode: "spawn", port: gatePort, allow: config.gate.allow, dataRoot, logLevel: "fatal", logger });
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, gate.client);
  app = await buildApp({ config, logger, hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  const body = setup.json<{ recoveryCodes: string[]; household: { id: string } }>();
  householdId = body.household.id;
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: body.recoveryCodes[0] } }));
}, 60_000);

afterAll(async () => {
  await app.close();
  await gate.stop();
  data.close();
  outside.close();
  await rm(dataRoot, { recursive: true, force: true });
});

type GateView = { state: string; allowList?: string[]; crossingsToday?: number; changedBy?: string | null };
type Rec = { id: string; status: string; preview?: string; observed?: Record<string, unknown>; decision?: { reason: string }; approval?: { by: string } };
type Err = { error: string };
const cross = (params: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/v1/actions/prepare", headers: auth(owner), payload: { capability: "gate.cross", target: `127.0.0.1:${outsidePort}`, parameters: { host: `127.0.0.1:${outsidePort}`, purpose: "test", sent: "Task text only. No names.", method: "POST", path: "/task", body: JSON.stringify({ q: "compare heat pumps" }), ...params } } });
const approve = (id: string) => app.inject({ method: "POST", url: `/v1/actions/${id}/approve`, headers: auth(owner), payload: {} });
const execute = (id: string) => app.inject({ method: "POST", url: `/v1/actions/${id}/execute`, headers: auth(owner) });

describe("the Gate (phase 15)", () => {
  it("is a separate process that refuses callers without the secret", async () => {
    expect(gate.child?.pid).toBeGreaterThan(0);
    expect(gate.child?.pid).not.toBe(process.pid);
    const status = await app.inject({ method: "GET", url: "/v1/gate", headers: auth(owner) });
    expect(status.json<GateView>()).toMatchObject({ state: "open", allowList: [`127.0.0.1:${outsidePort}`], crossingsToday: 0 });
    // eslint-disable-next-line no-restricted-globals -- the test plays an intruder on loopback
    const intruder = await fetch(`${gate.client.url!}/status`);
    expect(intruder.status).toBe(401);
  });

  it("a crossing always asks first, then leaves a receipt saying exactly what was sent", async () => {
    const prepared = await cross({});
    expect(prepared.statusCode).toBe(201);
    const rec = prepared.json<Rec>();
    expect(rec.status).toBe("prepared");
    expect(rec.preview).toMatch(/Task text only/);
    expect((await execute(rec.id)).statusCode).toBe(409); // not yet approved
    expect((await approve(rec.id)).json<Rec>()).toMatchObject({ status: "approved" });
    const done = await execute(rec.id);
    expect(done.json<Rec>()).toMatchObject({ status: "succeeded", observed: { status: 200 } });
    expect(outsideHits).toBe(1);
    const crossing = data.ledger.recent(householdId, 6).find((r) => r.type === "gate.crossing")!;
    expect(crossing.where).toBe("gate");
    expect(crossing.sent).toBe("Task text only. No names.");
    expect(crossing.sensitivity).toBe("high");
    const log = await readFile(join(dataRoot, "gate", "crossings.log"), "utf8");
    expect(log).toMatch(/"kind":"crossed"/);
    expect((await app.inject({ method: "GET", url: "/v1/gate", headers: auth(owner) })).json<GateView>()).toMatchObject({ crossingsToday: 1 });
  });

  it("refuses hosts that are not on the allow list", async () => {
    const prepared = await cross({ host: "evil.example" });
    const id = prepared.json<{ id: string }>().id;
    await approve(id);
    const res = await execute(id);
    expect(res.statusCode).toBe(403);
    expect(res.json<Err>()).toMatchObject({ error: expect.stringMatching(/allow list/) });
    expect(outsideHits).toBe(1);
    expect(data.ledger.recent(householdId, 2)[0]).toMatchObject({ type: "action.failed" });
  });

  it("closing the Gate makes an approved crossing fail cleanly, with a receipt", async () => {
    const prepared = await cross({});
    const id = prepared.json<{ id: string }>().id;
    await approve(id);
    const closed = await app.inject({ method: "POST", url: "/v1/gate", headers: auth(owner), payload: { open: false } });
    expect(closed.json<GateView>()).toMatchObject({ state: "closed", changedBy: expect.any(String) });
    expect(data.ledger.recent(householdId, 3).map((r) => r.type)).toContain("action.executed");

    const res = await execute(id);
    expect(res.statusCode).toBe(423);
    expect(res.json<Err>()).toMatchObject({ error: expect.stringMatching(/Gate is closed/) });
    expect(outsideHits).toBe(1);
    const failed = data.ledger.recent(householdId, 2).find((r) => r.type === "action.failed")!;
    expect(failed.payload).toMatchObject({ error: expect.stringMatching(/Gate is closed/), capability: "gate.cross" });

    // New crossings are refused at prepare time while closed.
    const whileClosed = await cross({});
    expect(whileClosed.json<Rec>()).toMatchObject({ status: "declined", decision: { reason: expect.stringMatching(/Gate is closed/) } });
    const status = await app.inject({ method: "GET", url: "/v1/system/status", headers: auth(owner) });
    expect(status.json<{ gate: string }>()).toMatchObject({ gate: "closed" });

    const reopened = await app.inject({ method: "POST", url: "/v1/gate", headers: auth(owner), payload: { open: true } });
    expect(reopened.json<GateView>()).toMatchObject({ state: "open" });
  });

  it("remembers its state across a restart of the Gate process", async () => {
    await app.inject({ method: "POST", url: "/v1/gate", headers: auth(owner), payload: { open: false } });
    const stateFile = JSON.parse(await readFile(join(dataRoot, "gate", "state.json"), "utf8")) as { state: string };
    expect(stateFile.state).toBe("closed");
    await app.inject({ method: "POST", url: "/v1/gate", headers: auth(owner), payload: { open: true } });
  });
});
