import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { UpdateCheck } from "@woven/schema";
import { CORE_HOUSEHOLD_ID } from "./data.ts";
import type { GateClient } from "./gate/client.ts";
import type { Ledger } from "./ledger.ts";

export const RELEASES_HOST = "api.github.com";
export const RELEASES_PATH = "/repos/tars16775/woven/releases/latest";

/**
 * Updates (gap 22). Releases are tarballs signed with the Woven release key;
 * the installer verifies the signature before anything from a release is
 * used, keeps the previous release beside the new one, and `woven update`
 * rolls back on its own if the new Core does not answer within a minute.
 * The Core itself only asks whether a newer version exists, through the
 * Gate, and notes every version change in the ledger.
 */
export async function checkForUpdate(gate: GateClient, ledger: Ledger, current: string): Promise<UpdateCheck> {
  const r = await gate.cross({ actionId: `update-check:${Date.now()}`, host: RELEASES_HOST, method: "GET", path: RELEASES_PATH });
  ledger.append({ type: "gate.crossing", householdId: CORE_HOUSEHOLD_ID, actor: { kind: "core", id: "core" }, where: "gate", sensitivity: "low", target: RELEASES_HOST, sent: `A request for the newest Woven release to ${RELEASES_HOST}. Nothing about the household.`, payload: { capability: "core.update_check", observed: { status: r.status, bytesOut: r.bytesOut } } });
  if (r.status !== 200) return { current, latest: null, newer: false, publishedAt: null, signed: false, checkedAt: new Date().toISOString(), problem: `GitHub answered ${r.status}.` };
  let body: { tag_name?: string; published_at?: string; assets?: { name: string }[] };
  try {
    body = JSON.parse(r.body) as typeof body;
  } catch {
    return { current, latest: null, newer: false, publishedAt: null, signed: false, checkedAt: new Date().toISOString(), problem: "GitHub's answer was not readable." };
  }
  const latest = (body.tag_name ?? "").replace(/^v/, "") || null;
  const names = (body.assets ?? []).map((a) => a.name);
  const signed = names.includes("woven-macos.tar.gz") && names.includes("woven-macos.tar.gz.sig");
  return { current, latest, newer: latest !== null && isNewer(latest, current), publishedAt: body.published_at ?? null, signed, checkedAt: new Date().toISOString(), problem: null };
}

export function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

/** At start: if the version differs from the last one that ran here, the ledger says an update was installed. */
export async function noteInstalledVersion(dataRoot: string, version: string, ledger: Ledger): Promise<{ from: string | null; changed: boolean }> {
  const file = join(dataRoot, "version");
  let from: string | null = null;
  try {
    from = (await readFile(file, "utf8")).trim() || null;
  } catch {
    // first start on this data root
  }
  if (from === version) return { from, changed: false };
  await writeFile(file, `${version}\n`);
  if (from !== null) ledger.append({ type: "update.installed", householdId: CORE_HOUSEHOLD_ID, actor: { kind: "core", id: "core" }, where: "inside", sensitivity: "low", payload: { from, to: version } });
  return { from, changed: from !== null };
}
