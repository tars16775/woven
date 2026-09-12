/* eslint-disable no-restricted-globals -- the Gate is the one process allowed outbound (ADR 0005). */
/**
 * The Gate (phase 15): a separate process, the household's only way out.
 *
 * It listens on loopback, accepts calls only from the core (bearer secret
 * minted at start), keeps an allow list of hosts, can be closed, and writes
 * its own append-only crossing log next to the core's ledger. On the box
 * this process runs on the Outside processor; on the Mac it is a child of
 * the core with no access to the household database.
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import Fastify from "fastify";
import { z } from "zod";

const Env = z.object({
  WOVEN_DATA: z.string().min(1),
  WOVEN_GATE_PORT: z.coerce.number().int().default(4010),
  WOVEN_GATE_SECRET: z.string().min(16),
  /** Comma-separated hosts that crossings may reach. Empty means nothing. */
  WOVEN_GATE_ALLOW: z.string().default(""),
  LOG_LEVEL: z.string().default("info"),
});
const env = Env.parse(process.env);
const dir = join(env.WOVEN_DATA, "gate");
const stateFile = join(dir, "state.json");
const logFile = join(dir, "crossings.log");

type State = { state: "open" | "closed"; changedAt: string | null; changedBy: string | null; allowList?: string[] };
let allowList = env.WOVEN_GATE_ALLOW.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
/** "api.example.com" matches itself; "*.hf.co" matches any subdomain (content mirrors move around). */
const allowed = (host: string) => allowList.some((a) => (a.startsWith("*.") ? host === a.slice(2) || host.endsWith(a.slice(1)) : host === a));
let state: State = { state: "open", changedAt: null, changedBy: null };
let crossingsToday = 0;
let bytesOutToday = 0;
let day = new Date().toISOString().slice(0, 10);

await mkdir(dir, { recursive: true, mode: 0o700 });
try {
  const saved = JSON.parse(await readFile(stateFile, "utf8")) as Partial<State>;
  state = { state: saved.state ?? state.state, changedAt: saved.changedAt ?? null, changedBy: saved.changedBy ?? null };
  // The allow list the owner built from the dashboard outlives the environment's first-boot list.
  if (Array.isArray(saved.allowList)) allowList = [...new Set([...allowList, ...saved.allowList.map((h) => String(h).toLowerCase())])];
} catch {
  await writeFile(stateFile, JSON.stringify({ ...state, allowList }), { mode: 0o600 });
}
const persist = () => writeFile(stateFile, JSON.stringify({ ...state, allowList }), { mode: 0o600 });

const app = Fastify({ logger: { level: env.LOG_LEVEL, base: { service: "woven-gate" } } });

app.addHook("onRequest", async (req, reply) => {
  if (req.headers.authorization !== `Bearer ${env.WOVEN_GATE_SECRET}`) {
    return reply.status(401).send({ error: "Not the core." });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    crossingsToday = 0;
    bytesOutToday = 0;
  }
});

const status = () => ({ ...state, allowList, crossingsToday, bytesOutToday });

app.get("/status", async () => status());

/** The allow list changes only through the core, which only lets the owner do it with a passkey (class H). */
const Host = z.object({ host: z.string().trim().min(1).max(253).regex(/^(\*\.)?[a-z0-9.-]+(:\d+)?$/i), by: z.string().optional() });
app.post("/allow", async (req, reply) => {
  const p = Host.safeParse(req.body);
  if (!p.success) return reply.status(400).send({ error: "That is not a host name." });
  const host = p.data.host.toLowerCase();
  if (!allowList.includes(host)) allowList = [...allowList, host];
  await persist();
  await record({ kind: "allowed", host, by: p.data.by ?? null });
  return status();
});
app.post("/disallow", async (req, reply) => {
  const p = Host.safeParse(req.body);
  if (!p.success) return reply.status(400).send({ error: "That is not a host name." });
  const host = p.data.host.toLowerCase();
  allowList = allowList.filter((h) => h !== host);
  await persist();
  await record({ kind: "disallowed", host, by: p.data.by ?? null });
  return status();
});

app.post("/open", async (req) => {
  const { by } = (req.body ?? {}) as { by?: string };
  state = { state: "open", changedAt: new Date().toISOString(), changedBy: by ?? null };
  await persist();
  await record({ kind: "opened", by: by ?? null });
  return status();
});

app.post("/close", async (req) => {
  const { by } = (req.body ?? {}) as { by?: string };
  state = { state: "closed", changedAt: new Date().toISOString(), changedBy: by ?? null };
  await persist();
  await record({ kind: "closed", by: by ?? null });
  return status();
});

const Cross = z.object({
  actionId: z.string(),
  host: z.string().min(1),
  method: z.enum(["GET", "POST"]),
  path: z.string().default("/"),
  body: z.string().optional(),
  /** A binary body (an encrypted notification), base64. */
  bodyBase64: z.string().optional(),
  /** Extra request headers (VAPID authorization, content encoding). Host and cookies are never forwarded. */
  headers: z.record(z.string(), z.string()).optional(),
});

app.post("/cross", async (req, reply) => {
  const parsed = Cross.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: "Bad crossing request." });
  const c = parsed.data;
  const host = c.host.toLowerCase();
  if (state.state === "closed") {
    await record({ kind: "refused", actionId: c.actionId, host, reason: "gate closed" });
    return reply.status(423).send({ error: "The Gate is closed. Nothing crosses until it is opened." });
  }
  if (!allowed(host)) {
    await record({ kind: "refused", actionId: c.actionId, host, reason: "not on the allow list" });
    return reply.status(403).send({ error: `${host} is not on the Gate's allow list.` });
  }
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https";
  const url = `${scheme}://${host}${c.path.startsWith("/") ? c.path : `/${c.path}`}`;
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.headers ?? {})) if (!/^(host|cookie|authorization-bearer-woven|x-woven-device)$/i.test(k)) extra[k.toLowerCase()] = v;
    const binary = c.bodyBase64 !== undefined ? Buffer.from(c.bodyBase64, "base64") : null;
    const res = await fetch(url, {
      method: c.method,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "user-agent": "WovenGate/0.1", ...extra },
      ...(c.method === "POST" && binary ? { body: binary } : c.body !== undefined && c.method === "POST" ? { body: c.body } : {}),
    });
    const text = await res.text();
    const bytesOut = (binary ? binary.length : Buffer.byteLength(c.body ?? "")) + Buffer.byteLength(url);
    crossingsToday += 1;
    bytesOutToday += bytesOut;
    await record({ kind: "crossed", actionId: c.actionId, host, status: res.status, bytesOut, bytesIn: Buffer.byteLength(text) });
    return { status: res.status, bytesOut, bytesIn: Buffer.byteLength(text), durationMs: Date.now() - started, body: text.slice(0, 200_000) };
  } catch (err) {
    await record({ kind: "failed", actionId: c.actionId, host, reason: err instanceof Error ? err.message : String(err) });
    return reply.status(502).send({ error: `The crossing to ${host} failed: ${err instanceof Error ? err.message : String(err)}` });
  } finally {
    clearTimeout(timer);
  }
});

/**
 * A large download (a model, an update) streamed straight to a file the
 * core named, never through JSON. Redirects are followed by hand so every
 * hop is checked against the allow list; the file's hash comes back so the
 * core can pin it.
 */
const Fetch = z.object({ actionId: z.string(), url: z.url(), dest: z.string().min(1), maxBytes: z.number().int().positive().default(4 * 1024 ** 3) });

app.post("/fetch", async (req, reply) => {
  const parsed = Fetch.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: "Bad fetch request." });
  const f = parsed.data;
  if (!f.dest.startsWith(env.WOVEN_DATA + "/")) return reply.status(400).send({ error: "Downloads land inside the data root only." });
  if (state.state === "closed") {
    await record({ kind: "refused", actionId: f.actionId, host: new URL(f.url).host, reason: "gate closed" });
    return reply.status(423).send({ error: "The Gate is closed. Nothing crosses until it is opened." });
  }
  const started = Date.now();
  let url = f.url;
  const hops: string[] = [];
  try {
    let res: Response | null = null;
    for (let i = 0; i < 6; i += 1) {
      const host = new URL(url).host.toLowerCase();
      if (!allowed(host)) {
        await record({ kind: "refused", actionId: f.actionId, host, reason: "not on the allow list" });
        return reply.status(403).send({ error: `${host} is not on the Gate's allow list.` });
      }
      hops.push(host);
      res = await fetch(url, { redirect: "manual", headers: { "user-agent": "WovenGate/0.1" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url).toString();
        continue;
      }
      break;
    }
    if (!res || !res.ok || !res.body) {
      await record({ kind: "failed", actionId: f.actionId, host: hops[0], reason: `HTTP ${res?.status ?? 0}` });
      return reply.status(502).send({ error: `The download answered ${res?.status ?? "nothing"}.` });
    }
    await mkdir(dirname(f.dest), { recursive: true });
    const tmp = `${f.dest}.part`;
    const hash = createHash("sha256");
    let bytesIn = 0;
    const out = createWriteStream(tmp, { mode: 0o600 });
    const reader = res.body.getReader();
    for (;;) {
      const chunk = (await reader.read()) as { done: boolean; value?: Uint8Array };
      if (chunk.done || !chunk.value) break;
      const value: Uint8Array = chunk.value;
      bytesIn += value.byteLength;
      if (bytesIn > f.maxBytes) {
        await reader.cancel();
        out.destroy();
        await rm(tmp, { force: true });
        await record({ kind: "failed", actionId: f.actionId, host: hops[0], reason: "too large" });
        return reply.status(413).send({ error: "The download is larger than allowed." });
      }
      hash.update(value);
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((r, j) => out.end((e: Error | null | undefined) => (e ? j(e) : r())));
    await rename(tmp, f.dest);
    crossingsToday += 1;
    const sha256 = hash.digest("hex");
    await record({ kind: "fetched", actionId: f.actionId, host: hops[0], hops, bytesIn, sha256 });
    return { status: res.status, bytesIn, sha256, hops, durationMs: Date.now() - started };
  } catch (err) {
    await record({ kind: "failed", actionId: f.actionId, host: hops[0] ?? new URL(f.url).host, reason: err instanceof Error ? err.message : String(err) });
    return reply.status(502).send({ error: `The download failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

/** The Gate's own record, independent of the core's ledger. One JSON object per line. */
async function record(entry: Record<string, unknown>) {
  await appendFile(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, { mode: 0o600 });
}

await app.listen({ host: "127.0.0.1", port: env.WOVEN_GATE_PORT });
app.log.info({ port: env.WOVEN_GATE_PORT, allowList, state: state.state }, "Gate ready");
const stop = () => void app.close().then(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("disconnect", stop);

// With a callback, a send to a parent that has already given up and closed the
// channel reports here instead of surfacing as an unhandled 'error' event that
// buries the parent's own message under a stack trace. Nobody to tell means
// nothing to do but leave.
process.send?.({ ready: true, port: env.WOVEN_GATE_PORT }, (err) => {
  if (err) stop();
});
