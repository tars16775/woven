import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { detectHardware } from "@woven/hal";
import { startRelay } from "@woven/relay";
import type { RemotePairing, RemoteStatus } from "@woven/schema";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { GateClient } from "../src/gate/client.ts";
import { RelayClient } from "../src/remote/client.ts";
import { relayIdentity } from "../src/remote/identity.ts";
import { open, parseFrame, seal } from "../src/remote/frames.ts";
import { derive } from "../src/keystore.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-remote-`);
let relay: Awaited<ReturnType<typeof startRelay>>;
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let client: RelayClient;
let owner: Auth = { cookie: "", device: "" };
let coreId = "";

/** What the browser does, in Node: seal a request under the pairing key and read the answer. */
class Browser {
  private ws!: WebSocket;
  private readonly waiting = new Map<string, (r: { s: number; h: Record<string, string>; b: string | null }) => void>();
  readonly events: unknown[] = [];
  closedWith: number | null = null;
  constructor(
    private readonly pairing: RemotePairing,
    private readonly relayUrl: string,
  ) {}
  async connect(): Promise<void> {
    this.ws = new WebSocket(`${this.relayUrl}/c/${this.pairing.coreId}`);
    await new Promise<void>((resolve, reject) => {
      this.ws.once("message", () => resolve());
      this.ws.once("error", reject);
      this.ws.once("close", (code) => {
        this.closedWith = code;
        resolve();
      });
    });
    this.ws.on("close", (code) => {
      this.closedWith = code;
    });
    this.ws.on("message", (raw) => {
      const frame = parseFrame(Buffer.isBuffer(raw) ? raw.toString("utf8") : Buffer.from(raw as ArrayBuffer).toString("utf8"));
      if (!frame) return;
      const msg = JSON.parse(open(Buffer.from(this.pairing.key, "base64"), frame).toString()) as { i: string; s?: number; h?: Record<string, string>; b?: string | null; ev?: unknown };
      if (msg.ev !== undefined) this.events.push(msg.ev);
      else this.waiting.get(msg.i)?.({ s: msg.s!, h: msg.h ?? {}, b: msg.b ?? null });
    });
  }
  request(m: string, p: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<{ s: number; h: Record<string, string>; b: string | null; json: () => unknown }> {
    const i = randomBytes(4).toString("hex");
    const h = { authorization: `Bearer ${this.pairing.token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}), ...extraHeaders };
    const plain = JSON.stringify({ i, m, p, h, b: body !== undefined ? Buffer.from(JSON.stringify(body)).toString("base64") : null });
    this.ws.send(seal(Buffer.from(this.pairing.key, "base64"), this.pairing.deviceId, Buffer.from(plain)));
    return new Promise((resolve) => this.waiting.set(i, (r) => resolve({ ...r, json: () => JSON.parse(Buffer.from(r.b ?? "", "base64").toString()) as unknown })));
  }
  raw(text: string) {
    this.ws.send(text);
  }
  close() {
    this.ws.close();
  }
}

beforeAll(async () => {
  relay = await startRelay({ port: 0 });
  const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: "http://localhost:3000", WOVEN_GATE: "off", WOVEN_RELAY: relay.url });
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, new GateClient(null, "test"), { hardware });
  const identity = await relayIdentity(hardware.paths.keys, derive(TEST_KEY, "keys"));
  coreId = identity.coreId;
  client = new RelayClient({
    url: relay.url,
    identity,
    devices: services.remoteDevices,
    logger: createLogger(config),
    subscribe: (onRow) => {
      data.ledger.on("appended", onRow);
      return () => data.ledger.off("appended", onRow);
    },
    dispatch: async (req) => {
      const res = await app.inject({ method: req.method as "GET", url: req.path, headers: req.headers, ...(req.body ? { payload: req.body } : {}) });
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) if (typeof v === "string") headers[k] = v;
      return { status: res.statusCode, headers, body: res.rawPayload };
    },
  });
  app = await buildApp({ config, logger: createLogger(config), hardware, data, services, version: "test", startedAt: new Date(), relay: client });
  await app.ready();
  client.start();
  await new Promise<void>((resolve) => {
    const t = setInterval(() => {
      if (client.status().connected) {
        clearInterval(t);
        resolve();
      }
    }, 20);
  });
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "Remote house", owner: { name: "Alex", email: "alex@example.com" } } });
  const codes = setup.json<{ recoveryCodes: string[] }>();
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: codes.recoveryCodes[0] } }));
});

afterAll(async () => {
  client.stop();
  await app.close();
  await relay.close();
  data.close();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("remote access through the relay (gap 21)", () => {
  let pairing: RemotePairing;

  it("attaches to the relay with a signed identity and reports it", async () => {
    expect(relay.cores()).toEqual([coreId]);
    const res = await app.inject({ method: "GET", url: "/v1/remote/status", headers: auth(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json<RemoteStatus>()).toMatchObject({ enabled: true, connected: true, coreId, devices: 0 });
    // Only a Core holding the private key can claim an id.
    const impostor = new WebSocket(`${relay.url}/core`);
    const closed = new Promise<number>((resolve) => impostor.on("close", (code) => resolve(code)));
    impostor.on("open", () => impostor.send(JSON.stringify({ t: "hello", pub: Buffer.from(randomBytes(44)).toString("base64url"), ts: Date.now(), sig: "nope" })));
    expect(await closed).toBe(4401);
  });

  it("pairs at home, then answers the paired browser from anywhere, end to end encrypted", async () => {
    const paired = await app.inject({ method: "POST", url: "/v1/remote/pair", headers: auth(owner), payload: { label: "Alex's phone" } });
    expect(paired.statusCode).toBe(201);
    pairing = paired.json<RemotePairing>();
    expect(pairing).toMatchObject({ coreId, relay: relay.url, household: "Remote house" });
    expect(Buffer.from(pairing.key, "base64")).toHaveLength(32);

    const browser = new Browser(pairing, relay.url);
    await browser.connect();
    const me = await browser.request("GET", "/v1/auth/session");
    expect(me.s).toBe(200);
    expect(me.json()).toMatchObject({ person: { name: "Alex" }, method: "token" });
    expect(me.h["content-type"]).toContain("application/json");

    // A real change through the tunnel: turn a light off, read it back.
    const act = await browser.request("POST", "/v1/actions/run", { capability: "light.set", target: "kitchen.main", parameters: { on: false } });
    expect(act.s).toBe(200);
    expect(act.json()).toMatchObject({ status: "succeeded" });

    // The event stream, multiplexed: a ledger row arrives inside the same tunnel.
    const sub = await browser.request("SUB", "/v1/events");
    expect(sub.s).toBe(200);
    data.ledger.append({ type: "core.started", householdId: services.household.household()!.id, actor: { kind: "core", id: "core" }, where: "inside", sensitivity: "low", payload: { test: true } });
    await new Promise((r) => setTimeout(r, 100));
    expect(browser.events.some((e) => (e as { type: string; row: { type: string } }).type === "ledger" && (e as { row: { type: string } }).row.type === "core.started")).toBe(true);

    // Pairing another device from away is refused: that only happens at home.
    const more = await browser.request("POST", "/v1/remote/pair", { label: "stolen" });
    expect(more.s).toBe(403);
    // A bad request inside the tunnel is the Core's own answer, not the tunnel's.
    const bad = await browser.request("POST", "/v1/actions/run", { capability: "light.explode", target: "kitchen.main", parameters: {} });
    expect(bad.s).toBe(404);
    browser.close();
  });

  it("drops frames under a wrong key, a wrong device id, or a revoked device", async () => {
    const wrongKey = new Browser({ ...pairing, key: randomBytes(32).toString("base64") }, relay.url);
    await wrongKey.connect();
    wrongKey.request("GET", "/v1/auth/session").catch(() => undefined);
    await new Promise((r) => setTimeout(r, 200));
    expect(wrongKey.closedWith).toBe(4000);

    const swapped = new Browser({ ...pairing, deviceId: "01J9Z0000000000000000000FAKE" }, relay.url);
    await swapped.connect();
    swapped.request("GET", "/v1/auth/session").catch(() => undefined);
    await new Promise((r) => setTimeout(r, 200));
    expect(swapped.closedWith).toBe(4000);

    // Frames are bound to the device id: re-sealing the same ciphertext under another id fails to open.
    const key = Buffer.from(pairing.key, "base64");
    const nonce = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, nonce);
    c.setAAD(Buffer.from(pairing.deviceId));
    const ct = Buffer.concat([c.update("{}"), c.final(), c.getAuthTag()]);
    const d = createDecipheriv("aes-256-gcm", key, nonce);
    d.setAAD(Buffer.from("other"));
    d.setAuthTag(ct.subarray(ct.length - 16));
    expect(() => d.update(ct.subarray(0, ct.length - 16)) && d.final()).toThrow();

    const list = await app.inject({ method: "GET", url: "/v1/remote/devices", headers: auth(owner) });
    expect(list.json<{ devices: { id: string; label: string }[] }>().devices).toMatchObject([{ id: pairing.deviceId, label: "Alex's phone" }]);
    const revoked = await app.inject({ method: "DELETE", url: `/v1/remote/devices/${pairing.deviceId}`, headers: auth(owner) });
    expect(revoked.statusCode).toBe(200);
    const after = new Browser(pairing, relay.url);
    await after.connect();
    after.request("GET", "/v1/auth/session").catch(() => undefined);
    await new Promise((r) => setTimeout(r, 200));
    expect(after.closedWith).toBe(4000);
    // The token behind the device is gone too, even on the LAN.
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { authorization: `Bearer ${pairing.token}` } })).statusCode).toBe(401);
    expect(data.ledger.recent(undefined, 20).map((r) => r.type)).toContain("remote.revoked");
  });

  it("tells a browser when the core is not there", async () => {
    const ws = new WebSocket(`${relay.url}/c/${"0".repeat(32)}`);
    const code = await new Promise<number>((resolve) => ws.on("close", (c) => resolve(c)));
    expect(code).toBe(4404);
  });
});
