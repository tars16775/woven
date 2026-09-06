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
import { signPath } from "../src/auth/sessions.ts";
import { auth, sessionOf, type Auth } from "./helpers.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-binding-`);
const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_GATE: "off" });
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let codes: string[] = [];

beforeAll(async () => {
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths);
  services = buildServices(data, config, new GateClient(null, "test"), { hardware, mdns: false });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  codes = setup.json<{ recoveryCodes: string[] }>().recoveryCodes;
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: codes[0] } }));
});
afterAll(async () => {
  await app.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("gap 1: nothing about the household without a session", () => {
  it("refuses the ledger, the household, the Gate, status and config to a visitor", async () => {
    for (const url of ["/v1/ledger/recent", "/v1/ledger/integrity", "/v1/household", "/v1/gate", "/v1/system/status", "/v1/system/config"]) {
      expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(401);
    }
    expect((await app.inject({ method: "GET", url: "/v1/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/household/setup" })).json()).toEqual({ setup: true, name: "H" });
  });
});

describe("gap 3: a stolen cookie is not enough", () => {
  it("the cookie alone is refused; cookie plus device secret is a session", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: owner.cookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: owner.cookie, "x-woven-device": "wrong" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: auth(owner) })).statusCode).toBe(200);
  });

  it("addresses fetched without headers carry a signature instead", async () => {
    const alex = services.household.personByEmail("alex@example.com")!;
    const entry = await services.files.put(alex, { name: "a.txt", path: "/", namespace: "personal", mime: "text/plain" }, Buffer.from("hello"));
    const path = `/v1/files/${entry.id}/content`;
    expect((await app.inject({ method: "GET", url: path, headers: { cookie: owner.cookie } })).statusCode).toBe(401);
    const exp = Math.floor(Date.now() / 1000) + 600;
    const good = await app.inject({ method: "GET", url: `${path}?dexp=${exp}&dsig=${signPath(owner.device, path, exp)}`, headers: { cookie: owner.cookie } });
    expect(good.statusCode).toBe(200);
    expect(good.body).toBe("hello");
    const stale = Math.floor(Date.now() / 1000) - 1;
    expect((await app.inject({ method: "GET", url: `${path}?dexp=${stale}&dsig=${signPath(owner.device, path, stale)}`, headers: { cookie: owner.cookie } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: `${path}?dexp=${exp}&dsig=${signPath("other", path, exp)}`, headers: { cookie: owner.cookie } })).statusCode).toBe(401);
  });
});

describe("gap 2: the doors are throttled", () => {
  it("stops a guesser after a few wrong recovery codes and writes a receipt", async () => {
    let last = 0;
    for (let i = 0; i < 7; i += 1) {
      last = (await app.inject({ method: "POST", url: "/v1/auth/recover", remoteAddress: "192.168.0.99", payload: { email: "alex@example.com", code: "zzzz-zzzz" } })).statusCode;
    }
    expect(last).toBe(429);
    expect(data.ledger.recent(undefined, 3).some((r) => r.type === "action.declined" && r.payload.reason === "too many attempts")).toBe(true);
    // Someone else, or the same person from home, is not punished for the guesser.
    expect((await app.inject({ method: "POST", url: "/v1/auth/recover", remoteAddress: "192.168.0.7", payload: { email: "alex@example.com", code: codes[1] } })).statusCode).toBe(200);
  });
});
