/**
 * `pnpm backup <folder> --owner <email> [--namespace personal] [--into /Backups/<machine>]`
 *
 * The folder-watch client for the Mac (phase 18), in its first form: walk a
 * folder, hash every file, and register what the box does not already hold.
 * Runs on the box itself against the store, so it needs no network and no
 * session; the phone and desktop apps speak the upload protocol instead.
 * Re-running is cheap: unchanged files are hashed and skipped.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import os from "node:os";
import { basename, dirname, relative, resolve } from "node:path";
import { detectHardware } from "@woven/hal";
import { Namespace } from "@woven/schema";
import { loadConfig } from "../config.ts";
import { openData } from "../data.ts";
import { GateClient } from "../gate/client.ts";
import { buildServices } from "../services.ts";
import { sha256File, walkFiles } from "../files.ts";

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--"));
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ownerEmail = opt("owner");
if (!folder || !ownerEmail) {
  console.error("usage: pnpm backup <folder> --owner <email> [--namespace personal] [--into /Backups/<machine>]");
  process.exit(2);
}
const namespace = Namespace.parse(opt("namespace") ?? "personal");
const machine = os.hostname().replace(/\.local$/, "");
const into = opt("into") ?? `/Backups/${machine}`;
const root = resolve(folder);

const config = loadConfig();
const { paths } = detectHardware({ dataRoot: config.dataRoot });
const data = await openData(paths);
const services = buildServices(data, config, new GateClient(null, "cli"));
try {
  const owner = services.household.personByEmail(ownerEmail);
  if (!owner) {
    console.error(`No one in the household has the email ${ownerEmail}.`);
    process.exit(2);
  }
  let seen = 0;
  let added = 0;
  let bytes = 0;
  let skipped = 0;
  const started = Date.now();
  for await (const file of walkFiles(root)) {
    seen += 1;
    const info = await stat(file);
    const sha256 = await sha256File(file);
    const relDir = relative(root, dirname(file));
    const path = `${into}/${basename(root)}${relDir ? `/${relDir}` : ""}`;
    const before = await data.store.has(sha256);
    if (!before) {
      await data.store.put(createReadStream(file));
      bytes += info.size;
    }
    const entry = services.files.add(owner, { name: basename(file), path, namespace, sha256, size: info.size, source: `backup:${machine}`, modifiedAt: info.mtime.toISOString() });
    if (before && entry.modifiedAt !== info.mtime.toISOString()) skipped += 1;
    else if (!before) added += 1;
    else skipped += 1;
    if (seen % 200 === 0) console.log(`  ${seen} files…`);
  }
  data.ledger.append({ type: "action.executed", householdId: owner.householdId, actor: { kind: "person", id: owner.id }, where: "inside", target: into, sensitivity: "low", payload: { capability: "backup.run", planned: { folder: basename(root), machine }, observed: { files: seen, added, bytes, skipped } } });
  console.log(`Backed up ${basename(root)}: ${seen} files, ${added} new (${(bytes / 1e6).toFixed(1)} MB stored), ${skipped} already on the box, in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
} finally {
  data.close();
}
