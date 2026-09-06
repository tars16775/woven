import { mkdtempSync } from "node:fs";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { CoreStatus } from "@woven/schema";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices } from "../src/services.ts";
import { auth, sessionOf, type Auth } from "./helpers.ts";
import { GateClient } from "../src/gate/client.ts";
import { openData, type Data } from "../src/data.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-core-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off" });

let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let owner: Auth = { cookie: "", device: "" };

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  app = await buildApp({
    config,
    logger: createLogger(config),
    hardware,
    data,
    services: buildServices(data, config, new GateClient(null, "test")),
    version: "test",
    startedAt: new Date(),
  });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: setup.json<{ recoveryCodes: string[] }>().recoveryCodes[0] } }));
});

afterAll(async () => {
  await app.close();
  data.close();
});

describe("core app", () => {
  it("answers health without revealing anything about the household", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, version: "test" });
    expect(res.headers["x-woven-core"]).toBe("test");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it.runIf(process.platform === "darwin")("reports status that validates against the shared schema", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/system/status", headers: auth(owner) });
    expect(res.statusCode).toBe(200);
    const status = CoreStatus.parse(res.json());
    expect(status.hardware.kind).toBe("macos");
    expect(status.gate).toBe("absent");
    expect(status.metrics.temperatureC).toBeNull();
    expect(status.dataRoot).toBe(dataRoot);
  });

  it("refuses browsers from unknown origins", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/v1/health",
      headers: { origin: "https://evil.example", "access-control-request-method": "GET" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows the site's origin", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/v1/health",
      headers: { origin: "http://localhost:3000", "access-control-request-method": "GET" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("returns a calm error and a request id on failures", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty("requestId");
  });
});

describe("config", () => {
  it("defaults the data root to the platform's application-data folder", () => {
    expect(loadConfig({}).dataRoot).toMatch(/Woven|woven/);
  });
  it("parses origins and trims them", () => {
    const c = loadConfig({ WOVEN_DATA: "/x", WOVEN_ORIGINS: " http://a , http://b " });
    expect(c.origins).toEqual(["http://a", "http://b"]);
  });
});

describe("ledger routes", () => {
  it("verifies an empty or short chain and records the check", async () => {
    const first = await app.inject({ method: "GET", url: "/v1/ledger/integrity", headers: auth(owner) });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ ok: true });
    const recent = await app.inject({ method: "GET", url: "/v1/ledger/recent?limit=5", headers: auth(owner) });
    expect(recent.statusCode).toBe(200);
    const { rows } = recent.json<{ rows: { type: string; prevHash: string }[] }>();
    expect(rows[0]?.type).toBe("core.integrity_checked");
    expect(rows[0]?.prevHash).toHaveLength(64);
  });

  it("rejects an out-of-range limit", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/ledger/recent?limit=5000", headers: auth(owner) });
    expect(res.statusCode).toBe(400);
  });
});
