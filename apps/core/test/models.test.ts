import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectHardware } from "@woven/hal";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { openData, type Data } from "../src/data.ts";
import { createLogger } from "../src/logger.ts";
import { buildServices, type Services } from "../src/services.ts";
import { startGate, type GateHandle } from "../src/gate/spawn.ts";
import { auth, sessionOf, type Auth, TEST_KEY } from "./helpers.ts";
import { catalogue } from "../src/models.ts";
import { cosine, type Embedder } from "../src/photo-index.ts";

const dataRoot = mkdtempSync(`${os.tmpdir()}/woven-models-`);
const ORIGIN = "http://localhost:3000";
let gate: GateHandle;
let app: Awaited<ReturnType<typeof buildApp>>;
let data: Data;
let services: Services;
let owner: Auth = { cookie: "", device: "" };
let servedBytes = 0;
const hits: string[] = [];

/** A stand-in for huggingface.co: JSON files served directly, the .onnx files through a redirect, like the real CDN. */
const outside = createServer((req, res) => {
  hits.push(req.url ?? "");
  const url = req.url ?? "";
  const file = url.split("/resolve/main/")[1] ?? "";
  if (file.endsWith(".onnx")) {
    res.writeHead(302, { location: `/cdn/${file}` });
    return res.end();
  }
  const name = url.startsWith("/cdn/") ? url.slice(5) : file;
  const body = name.endsWith(".onnx") ? Buffer.alloc(200_000, name.length) : Buffer.from(JSON.stringify({ file: name }));
  servedBytes += body.length;
  res.writeHead(200, { "content-type": "application/octet-stream", "content-length": String(body.length) });
  res.end(body);
});

/** A stub in the same vector space as words: "blue" pictures match "blue" queries. */
const stub: Embedder = {
  name: "stub",
  image: async (bytes) => {
    const stats = await sharp(bytes).stats();
    const [r, g, b] = stats.channels.map((c) => c.mean / 255);
    return Float32Array.from([r ?? 0, g ?? 0, b ?? 0]);
  },
  text: async (q) => Float32Array.from([/red/i.test(q) ? 1 : 0, /green/i.test(q) ? 1 : 0, /blue/i.test(q) ? 1 : 0]),
};


beforeAll(async () => {
  await new Promise<void>((r) => outside.listen(0, "127.0.0.1", r));
  const port = (outside.address() as { port: number }).port;
  process.env.WOVEN_MODEL_SOURCE = `http://127.0.0.1:${port}`;
  const gatePort = 4600 + Math.floor(Math.random() * 300);
  const config = loadConfig({ NODE_ENV: "test", WOVEN_DATA: dataRoot, LOG_LEVEL: "fatal", WOVEN_MDNS: "off", WOVEN_TLS: "off", WOVEN_ORIGINS: ORIGIN, WOVEN_GATE: "spawn", WOVEN_GATE_PORT: String(gatePort), WOVEN_GATE_ALLOW: `127.0.0.1:${port}` });
  const logger = createLogger(config);
  gate = await startGate({ mode: "spawn", port: gatePort, allow: config.gate.allow, dataRoot, logLevel: "fatal", logger });
  const hardware = detectHardware({ dataRoot });
  data = await openData(hardware.paths, { key: TEST_KEY });
  services = buildServices(data, config, gate.client, { logger, loadEmbedder: async () => stub });
  app = await buildApp({ config, logger, hardware, data, services, version: "test", startedAt: new Date() });
  await app.ready();
  const setup = await app.inject({ method: "POST", url: "/v1/household/setup", payload: { household: "H", owner: { name: "Alex", email: "alex@example.com" } } });
  owner = sessionOf(await app.inject({ method: "POST", url: "/v1/auth/recover", payload: { email: "alex@example.com", code: setup.json<{ recoveryCodes: string[] }>().recoveryCodes[0] } }));
}, 60_000);

afterAll(async () => {
  await app.close();
  await gate.stop();
  data.close();
  outside.close();
  delete process.env.WOVEN_MODEL_SOURCE;
  await rm(dataRoot, { recursive: true, force: true });
});

describe("models through the Gate (phase 21)", () => {
  it("lists the catalogue, uninstalled", async () => {
    expect(Object.keys(catalogue.find((m) => m.name === "photo-search")?.files ?? {})).toHaveLength(7);
    const res = await app.inject({ method: "GET", url: "/v1/models", headers: auth(owner) });
    expect(res.json<{ models: { name: string; installed: boolean }[] }>().models).toEqual([expect.objectContaining({ name: "photo-search", installed: false })]);
    expect((await app.inject({ method: "GET", url: "/v1/photos/search?q=lake", headers: auth(owner) })).json()).toMatchObject({ ready: false, results: [] });
  });

  it("installing is a crossing that asks first; every file arrives through the Gate, redirects included, and is pinned", async () => {
    const prepared = await app.inject({ method: "POST", url: "/v1/models/photo-search/install", headers: auth(owner) });
    expect(prepared.statusCode).toBe(201);
    const rec = prepared.json<{ id: string; status: string; preview: string }>();
    expect(rec.status).toBe("prepared");
    expect(rec.preview).toMatch(/Download the photo search model/);
    expect((await app.inject({ method: "POST", url: `/v1/actions/${rec.id}/approve`, headers: auth(owner), payload: {} })).json<{ status: string }>().status).toBe("approved");
    const done = await app.inject({ method: "POST", url: `/v1/actions/${rec.id}/execute`, headers: auth(owner) });
    expect(done.statusCode).toBe(200);
    expect(done.json<{ status: string; observed: { files: number } }>()).toMatchObject({ status: "succeeded", observed: { files: 7 } });
    expect(hits.filter((h) => h.includes("/resolve/main/"))).toHaveLength(7);
    expect(hits.filter((h) => h.startsWith("/cdn/"))).toHaveLength(2);
    const crossing = data.ledger.recent(undefined, 5).find((r) => r.type === "gate.crossing")!;
    expect(crossing.sent).toMatch(/Nothing about the household/);

    const state = await app.inject({ method: "GET", url: "/v1/models", headers: auth(owner) });
    expect(state.json<{ models: { installed: boolean; bytes: number }[] }>().models[0]).toMatchObject({ installed: true, bytes: servedBytes });
    const spec = services.models.spec("photo-search")!;
    const manifest = JSON.parse(await readFile(join(services.models.pathFor(spec), "woven-manifest.json"), "utf8")) as { files: Record<string, { sha256: string }> };
    expect(Object.keys(manifest.files)).toHaveLength(7);
    expect(await services.models.verify("photo-search")).toEqual({ ok: true, bad: [] });
    const log = await readFile(join(dataRoot, "gate", "crossings.log"), "utf8");
    expect(log.match(/"kind":"fetched"/g)).toHaveLength(7);
  });

  it("embeds photos as they arrive and finds them by words", async () => {
    const alex = services.household.personByEmail("alex@example.com")!;
    const make = (rgb: { r: number; g: number; b: number }) => sharp({ create: { width: 200, height: 150, channels: 3, background: rgb } }).jpeg().toBuffer();
    await services.files.put(alex, { name: "sky.jpg", path: "/", namespace: "personal", mime: "image/jpeg" }, await make({ r: 20, g: 60, b: 220 }));
    await services.files.put(alex, { name: "barn.jpg", path: "/", namespace: "personal", mime: "image/jpeg" }, await make({ r: 220, g: 30, b: 30 }));
    await services.files.put(alex, { name: "lawn.jpg", path: "/", namespace: "personal", mime: "image/jpeg" }, await make({ r: 30, g: 200, b: 40 }));
    for (let i = 0; i < 100 && (await services.photoIndex.search(alex, "x")).indexed < 3; i += 1) {
      await services.photoIndex.indexPending();
      await new Promise((r) => setTimeout(r, 50));
    }
    const blue = await app.inject({ method: "GET", url: "/v1/photos/search?q=a%20blue%20sky", headers: auth(owner) });
    expect(blue.json<{ ready: boolean; indexed: number }>()).toMatchObject({ ready: true, indexed: 3 });
    expect(blue.json<{ results: { name: string }[] }>().results[0]?.name).toBe("sky.jpg");
    const red = await app.inject({ method: "GET", url: "/v1/photos/search?q=red%20barn", headers: auth(owner) });
    expect(red.json<{ results: { name: string }[] }>().results[0]?.name).toBe("barn.jpg");
    expect(cosine(Float32Array.from([1, 0]), Float32Array.from([1, 0]))).toBe(1);
  });
});
