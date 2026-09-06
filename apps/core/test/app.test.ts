import { mkdtempSync } from "node:fs";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { CoreStatus } from "@woven/schema";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { createLogger } from "../src/logger.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-core-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off" });

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({
    config,
    logger: createLogger(config),
    hardware: detectHardware({ dataRoot }),
    version: "test",
    startedAt: new Date(),
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
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
    const res = await app.inject({ method: "GET", url: "/v1/system/status" });
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
  it("requires the data root", () => {
    expect(() => loadConfig({})).toThrow(/WOVEN_DATA/);
  });
  it("parses origins and trims them", () => {
    const c = loadConfig({ WOVEN_DATA: "/x", WOVEN_ORIGINS: " http://a , http://b " });
    expect(c.origins).toEqual(["http://a", "http://b"]);
  });
});
