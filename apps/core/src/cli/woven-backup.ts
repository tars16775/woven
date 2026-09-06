#!/usr/bin/env node
/**
 * woven-backup: the folder backup client for any Mac on the home network
 * (gap 20). Talks to the household's Core over HTTPS with a device token
 * made in the dashboard (Settings, Backup devices), trusting the household
 * CA it fetched once at connect. Walks a folder, hashes what changed, and
 * uploads only bytes the box does not already hold, through the same
 * chunked, resumable protocol the dashboard uses. Nothing here imports the
 * core: it runs on machines that only back up.
 *
 *   woven-backup connect https://woven.local:4000 <token>
 *   woven-backup run ~/Documents [--into /Backups/<machine>] [--namespace personal] [--watch]
 *   woven-backup status
 */
import { createHash } from "node:crypto";
import { createReadStream, watch } from "node:fs";
import { chmod, mkdir, open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

type Config = { origin: string; token: string; ca: string | null; connectedAt: string };
type Manifest = Record<string, { size: number; mtimeMs: number; sha256: string; uploadedAt: string }>;

const home = process.env.WOVEN_BACKUP_HOME ?? join(os.homedir(), "Library", "Application Support", "Woven Backup");
const configFile = join(home, "config.json");

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "connect":
      return connect(rest[0], rest[1]);
    case "run":
      return run(rest);
    case "status":
      return status();
    default:
      console.log("woven-backup connect <origin> <token>\nwoven-backup run <folder> [--into /Backups/<machine>] [--namespace personal] [--watch]\nwoven-backup status");
      process.exit(cmd ? 2 : 0);
  }
}

async function connect(origin: string | undefined, token: string | undefined) {
  if (!origin || !token) {
    console.error("usage: woven-backup connect https://woven.local:4000 <token>");
    process.exit(2);
  }
  const url = new URL(origin);
  let ca: string | null = null;
  if (url.protocol === "https:") {
    // The household CA from the trust page (plain HTTP on the trust port, on the same host), pinned from now on.
    const trustPort = process.env.WOVEN_TRUST_PORT ?? "4001";
    try {
      const r = await request({ origin: `http://${url.hostname}:${trustPort}`, path: "/ca.crt", method: "GET", ca: null, token: null });
      if (r.status === 200 && r.body.toString().includes("BEGIN CERTIFICATE")) ca = r.body.toString();
      else throw new Error(`status ${r.status}`);
    } catch (err) {
      console.error(`Could not fetch the household certificate from http://${url.hostname}:${trustPort}/ca.crt: ${(err as Error).message}`);
      process.exit(1);
    }
  }
  const config: Config = { origin: url.origin, token, ca, connectedAt: new Date().toISOString() };
  const me = await api(config, "GET", "/v1/auth/session");
  if (me.status !== 200) {
    console.error(me.status === 401 ? "The Core did not accept that token. Make a new one under Settings, Backup devices." : `The Core answered ${me.status}.`);
    process.exit(1);
  }
  const session = JSON.parse(me.body.toString()) as { person: { name: string }; household: { name: string } };
  await mkdir(home, { recursive: true, mode: 0o700 });
  await writeFile(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
  await chmod(configFile, 0o600);
  console.log(`Connected to ${session.household.name} at ${config.origin} as ${session.person.name}.${ca ? " The household certificate is pinned." : ""}`);
}

async function status() {
  const config = await loadConfig();
  const me = await api(config, "GET", "/v1/auth/session");
  if (me.status !== 200) {
    console.log(`Connected to ${config.origin}, but the Core answered ${me.status}. Reconnect with a new token.`);
    process.exit(1);
  }
  const session = JSON.parse(me.body.toString()) as { person: { name: string }; household: { name: string }; expiresAt: string };
  console.log(`${session.household.name} at ${config.origin} as ${session.person.name} · token good until ${new Date(session.expiresAt).toLocaleDateString()}`);
  for (const name of await readdir(home)) {
    if (!name.startsWith("manifest-")) continue;
    const m = JSON.parse(await readFile(join(home, name), "utf8")) as { folder: string; files: Manifest };
    const n = Object.keys(m.files).length;
    const last = Object.values(m.files).reduce((a, f) => (f.uploadedAt > a ? f.uploadedAt : a), "");
    console.log(`  ${m.folder}: ${n} files known${last ? `, last upload ${new Date(last).toLocaleString()}` : ""}`);
  }
}

async function run(args: string[]) {
  const folder = args.find((a) => !a.startsWith("--"));
  if (!folder) {
    console.error("usage: woven-backup run <folder> [--into /Backups/<machine>] [--namespace personal] [--watch]");
    process.exit(2);
  }
  const opt = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const config = await loadConfig();
  const root = resolve(folder);
  const machine = os.hostname().replace(/\.local$/, "");
  const into = opt("into") ?? `/Backups/${machine}`;
  const namespace = opt("namespace") ?? "personal";
  const once = () => backupFolder(config, root, { into, namespace, machine });
  await once();
  if (!args.includes("--watch")) return;
  console.log("Watching for changes. Press Ctrl-C to stop.");
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let again = false;
  const kick = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        await once();
      } catch (err) {
        console.error((err as Error).message);
      }
      running = false;
      if (again) {
        again = false;
        kick();
      }
    }, 2000);
  };
  watch(root, { recursive: true }, kick);
  await new Promise(() => undefined);
}

async function backupFolder(config: Config, root: string, opts: { into: string; namespace: string; machine: string }) {
  const manifestFile = join(home, `manifest-${createHash("sha256").update(root).digest("hex").slice(0, 12)}.json`);
  let manifest: Manifest = {};
  try {
    manifest = (JSON.parse(await readFile(manifestFile, "utf8")) as { files: Manifest }).files;
  } catch {
    // first run
  }
  const started = Date.now();
  let seen = 0;
  let uploaded = 0;
  let bytes = 0;
  let unchanged = 0;
  let failed = 0;
  for await (const file of walk(root)) {
    seen += 1;
    const rel = relative(root, file);
    const info = await stat(file);
    const known = manifest[rel];
    if (known && known.size === info.size && known.mtimeMs === info.mtimeMs) {
      unchanged += 1;
      continue;
    }
    try {
      const sha256 = await sha256File(file);
      const relDir = relative(root, dirname(file));
      const path = `${opts.into}/${basename(root)}${relDir ? `/${relDir}` : ""}`;
      const sent = await upload(config, file, { name: basename(file), path, namespace: opts.namespace, size: info.size, sha256, modifiedAt: info.mtime.toISOString(), source: `backup:${opts.machine}` });
      manifest[rel] = { size: info.size, mtimeMs: info.mtimeMs, sha256, uploadedAt: new Date().toISOString() };
      if (sent > 0) {
        uploaded += 1;
        bytes += sent;
      } else unchanged += 1;
      if (seen % 50 === 0) await saveManifest(manifestFile, root, manifest);
    } catch (err) {
      failed += 1;
      console.error(`  ${rel}: ${(err as Error).message}`);
    }
  }
  for (const rel of Object.keys(manifest)) {
    try {
      await stat(join(root, rel));
    } catch {
      delete manifest[rel]; // gone locally; the box keeps its copy until you delete it there
    }
  }
  await saveManifest(manifestFile, root, manifest);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${seen} files checked · ${uploaded} uploaded (${fmt(bytes)}) · ${unchanged} already on the box${failed ? ` · ${failed} failed` : ""} · ${secs}s`);
}

/** The chunked protocol: start with the hash, send only what the box lacks, complete. Returns bytes actually sent. */
async function upload(config: Config, file: string, input: { name: string; path: string; namespace: string; size: number; sha256: string; modifiedAt: string; source: string }): Promise<number> {
  const start = await api(config, "POST", "/v1/files/uploads", JSON.stringify({ name: input.name, path: input.path, namespace: input.namespace, size: input.size, sha256: input.sha256, source: input.source }));
  if (start.status !== 201) throw new Error(`the Core answered ${start.status} starting the upload: ${errorOf(start.body)}`);
  const session = JSON.parse(start.body.toString()) as { id: string; chunkSize: number; chunks: number; received: number[]; alreadyStored: boolean };
  let sent = 0;
  if (!session.alreadyStored) {
    const have = new Set(session.received);
    const fh = await open(file, "r");
    try {
      for (let i = 0; i < session.chunks; i += 1) {
        if (have.has(i)) continue;
        const offset = i * session.chunkSize;
        const len = Math.min(session.chunkSize, input.size - offset);
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, offset);
        const r = await api(config, "PUT", `/v1/files/uploads/${session.id}/chunks/${i}`, buf, "application/octet-stream");
        if (r.status !== 200) throw new Error(`chunk ${i + 1} of ${session.chunks}: ${r.status} ${errorOf(r.body)}`);
        sent += len;
      }
    } finally {
      await fh.close();
    }
  }
  const done = await api(config, "POST", `/v1/files/uploads/${session.id}/complete`, "{}");
  if (done.status !== 201) throw new Error(`completing the upload: ${done.status} ${errorOf(done.body)}`);
  return sent;
}

async function saveManifest(file: string, folder: string, files: Manifest) {
  await mkdir(home, { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify({ folder, files }), { mode: 0o600 });
}

async function loadConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(configFile, "utf8")) as Config;
  } catch {
    console.error("Not connected yet. Run: woven-backup connect https://woven.local:4000 <token>");
    process.exit(1);
  }
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

async function sha256File(path: string): Promise<string> {
  const h = createHash("sha256");
  for await (const c of createReadStream(path)) h.update(c as Buffer);
  return h.digest("hex");
}

type Res = { status: number; body: Buffer };

function api(config: Config, method: string, path: string, body?: string | Buffer, contentType = "application/json"): Promise<Res> {
  return request({ origin: config.origin, path, method, ca: config.ca, token: config.token, ...(body !== undefined ? { body } : {}), contentType });
}

function request(opts: { origin: string; path: string; method: string; ca: string | null; token: string | null; body?: string | Buffer; contentType?: string }): Promise<Res> {
  const url = new URL(opts.path, opts.origin);
  const mod = url.protocol === "https:" ? https : http;
  return new Promise((resolvePromise, reject) => {
    const req = mod.request(
      url,
      {
        method: opts.method,
        ...(opts.ca ? { ca: opts.ca } : {}),
        headers: {
          ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
          ...(opts.body !== undefined ? { "content-type": opts.contentType ?? "application/json", "content-length": String(Buffer.byteLength(opts.body)) } : {}),
          "user-agent": `woven-backup/${os.hostname()}`,
        },
        timeout: 120_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolvePromise({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

function errorOf(body: Buffer): string {
  try {
    return (JSON.parse(body.toString()) as { error?: string }).error ?? "";
  } catch {
    return "";
  }
}

function fmt(n: number): string {
  return n < 1e6 ? `${(n / 1e3).toFixed(0)} KB` : n < 1e9 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e9).toFixed(2)} GB`;
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
