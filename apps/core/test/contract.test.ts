import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp, type RouteInfo } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { TEST_KEY } from "./helpers.ts";

/**
 * Contract tests (gap 27): every route the Core exposes is typed and
 * guarded. A route without a response schema would leak whatever the
 * handler returned; a route without a session guard is public. Both are
 * allowed only on the short list below, which is the box's public surface.
 */
const PUBLIC = new Set([
  "GET /v1/health",
  "GET /v1/household/setup",
  "POST /v1/household/setup",
  "POST /v1/household/invitations/accept",
  "POST /v1/auth/passkeys/register/options",
  "POST /v1/auth/passkeys/register/verify",
  "POST /v1/auth/passkeys/login/options",
  "POST /v1/auth/passkeys/login/verify",
  "POST /v1/auth/code/login",
  "POST /v1/auth/recover",
  "POST /v1/auth/logout",
  "GET /v1/screen",
  "GET /v1/screen/code",
  "GET /v1/screen/state",
  "GET /v1/capabilities",
  "GET /v1/s/:token",
  "GET /v1/s/:token/info",
  "GET /v1/events",
]);
/** Streams and pages: bytes, not JSON, so no response schema. */
const UNTYPED = new Set(["GET /v1/files/:id/content", "GET /v1/photos/:id/thumb", "GET /v1/photos/:id/preview", "GET /v1/media/:id/stream", "GET /v1/media/:id/transcode", "GET /v1/s/:token", "GET /v1/events", "GET /v1/screen", "GET /v1/screen/code", "GET /v1/household/export", "POST /v1/household/export"]);

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-contract-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: "http://localhost:3000", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services: buildServices(data, config, new GateClient(null, "test"), { hardware }), version: "test", startedAt: new Date() });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("the API contract", () => {
  const api = () => app.routeTable.filter((r) => r.url.startsWith("/v1/") && r.method !== "HEAD" && r.method !== "OPTIONS");

  it("has a real surface", () => {
    expect(api().length).toBeGreaterThan(80);
  });

  it("guards every route that is not on the public list", () => {
    const unguarded = api()
      .filter((r) => !r.guarded && !PUBLIC.has(`${r.method} ${r.url}`))
      .map((r) => `${r.method} ${r.url}`);
    expect(unguarded).toEqual([]);
  });

  it("types every JSON answer", () => {
    const untyped = api()
      .filter((r) => !r.typed && !UNTYPED.has(`${r.method} ${r.url}`))
      .map((r) => `${r.method} ${r.url}`);
    expect(untyped).toEqual([]);
  });

  it("keeps the public surface small and named", () => {
    const publicRoutes = api()
      .filter((r) => !r.guarded)
      .map((r) => `${r.method} ${r.url}`);
    for (const p of publicRoutes) expect(PUBLIC.has(p), `${p} is public but not on the list`).toBe(true);
    expect(publicRoutes.length).toBeLessThanOrEqual(PUBLIC.size);
  });

  it("answers a stranger with 401 (or a validation 400 that says nothing) on guarded routes, never a stack trace", async () => {
    const samples: RouteInfo[] = api().filter((r) => r.guarded && r.method === "GET" && !r.url.includes(":"));
    expect(samples.length).toBeGreaterThan(15);
    for (const r of samples) {
      const res = await app.inject({ method: "GET", url: r.url });
      expect([400, 401], `${r.method} ${r.url} answered ${res.statusCode}`).toContain(res.statusCode);
      expect(res.body).not.toMatch(/at .*\.ts:\d+/);
      expect(res.body).not.toMatch(/"household"|"person":/);
    }
  });
});
