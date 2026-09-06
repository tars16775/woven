import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Hardware } from "@woven/hal";
import type { Config } from "./config.ts";
import type { Data } from "./data.ts";
import { verifyStore } from "./integrity.ts";
import type { Services } from "./services.ts";

/**
 * A diagnostics bundle (phase 45): what support needs to help, with the
 * privacy filter applied before anything is written. No names, emails,
 * addresses, file names, receipts' contents or keys; counts and states only.
 */
export type DiagnosticsBundle = { dir: string; files: string[]; takenAt: string };

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const MAC = /\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi;
const ULID = /\b[0-9A-HJKMNP-TV-Z]{26}\b/g;

/** The filter every line of a bundle goes through. */
export function scrub(text: string): string {
  return text.replace(EMAIL, "[email]").replace(MAC, "[mac]").replace(IPV4, "[ip]").replace(ULID, "[id]");
}

export async function writeDiagnostics(opts: { data: Data; services: Services; hardware: Hardware; config: Config; version: string; startedAt: Date; logFile: string | null }): Promise<DiagnosticsBundle> {
  const { data, services, hardware, config } = opts;
  const takenAt = new Date();
  const dir = join(data.paths.root, "exports", `diagnostics-${takenAt.toISOString().replace(/[:.]/g, "-")}`);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const files: string[] = [];
  const put = async (name: string, value: unknown) => {
    await writeFile(join(dir, name), scrub(typeof value === "string" ? value : JSON.stringify(value, null, 2)), { mode: 0o600 });
    files.push(name);
  };

  const [identity, metrics, storage, network, ledger, objects, backups] = await Promise.all([
    hardware.identity(),
    hardware.metrics(),
    hardware.storage(),
    services.network.scan().catch(() => null),
    Promise.resolve(data.ledger.verify()),
    verifyStore(data.database.db, data.store, { sampleAbove: 200, sample: 100 }),
    (await import("./integrity.ts")).listSnapshots(data.paths.snapshots, config.snapshotMirror),
  ]);
  const household = services.household.household();
  const people = household ? services.household.people(household.id) : [];

  await put("about.json", { version: opts.version, startedAt: opts.startedAt.toISOString(), takenAt: takenAt.toISOString(), node: process.version, platform: process.platform, hardware: { ...identity, machineId: identity.machineId.slice(0, 8) } });
  await put("config.json", { name: config.name, port: config.port, tls: config.tls, mdns: config.mdns, origins: config.origins.length, gate: { mode: config.gate.mode === "spawn" ? "spawn" : "url", allow: config.gate.allow.split(",").length }, snapshotMirror: !!config.snapshotMirror });
  await put("metrics.json", { ...metrics, storage });
  await put("household.json", { setup: !!household, people: people.length, roles: people.map((p) => p.role), passkeys: people.map((p) => services.passkeys.count(p.id)) });
  await put("integrity.json", { ledger, objects: { ...objects, corrupt: objects.corrupt.length, missing: objects.missing.length }, snapshots: backups.map((b) => ({ takenAt: b.takenAt, objects: b.objects, mirrored: b.mirrored })) });
  await put("network.json", network ? { mode: network.mode, hasGateway: !!network.gateway, ssid: !!network.ssid, neighbours: network.neighbours.length, kinds: network.neighbours.map((n) => n.kind) } : null);
  await put("gate.json", { ...services.gate.cached(), allowList: services.gate.cached().allowList.length });
  await put("media.json", { ffmpeg: !!services.media.tools.ffmpeg, ffprobe: !!services.media.tools.ffprobe });
  await put("models.json", await Promise.all((await import("./models.ts")).catalogue.map((m) => services.models.state(m.name))));
  if (opts.logFile) {
    try {
      const lines = (await readFile(opts.logFile, "utf8")).split("\n");
      await put("log-tail.txt", lines.slice(-300).join("\n"));
    } catch {
      // no log file (started by hand): nothing to include
    }
  }
  data.ledger.append({ type: "action.executed", householdId: household?.id ?? (await import("./data.ts")).CORE_HOUSEHOLD_ID, actor: { kind: "core", id: "core" }, where: "inside", target: "diagnostics", sensitivity: "low", payload: { capability: "core.diagnostics", planned: {}, observed: { files: files.length } } });
  return { dir, files, takenAt: takenAt.toISOString() };
}
