import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "./logger.ts";
import { CORE_HOUSEHOLD_ID, type Data } from "./data.ts";
import { takeSnapshot } from "./snapshot.ts";
import { mirrorSnapshot, verifyStore } from "./integrity.ts";

export type MaintenanceOptions = {
  /** A second location for snapshots. */
  mirror?: string | null;
  sweep?: () => Promise<number>;
  /** Called with what the night found, so alerts can be raised or cleared. */
  report?: (facts: { ledgerOk: boolean; objectsBad: number; mirrorOk: boolean | null }) => void;
  /** Local hour (0-23) to run. Default 3 in the morning, when the house is quiet. */
  hour?: number;
  /** How many snapshots to keep. Default 14. */
  keep?: number;
  now?: () => Date;
};

/** Milliseconds until the next occurrence of `hour` o'clock local time. */
export function msUntilHour(hour: number, now: Date): number {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** Verify the chain, snapshot the household, prune old snapshots. */
export async function runNightly(data: Data, logger: Logger, keep = 14, opts: Pick<MaintenanceOptions, "mirror" | "sweep" | "report"> = {}): Promise<void> {
  if (opts.sweep) logger.info({ removed: await opts.sweep() }, "stale uploads swept");
  const report = data.ledger.verify();
  const objects = await verifyStore(data.database.db, data.store);
  data.ledger.append({
    type: "core.integrity_checked",
    householdId: CORE_HOUSEHOLD_ID,
    actor: { kind: "core", id: "core" },
    where: "inside",
    sensitivity: "low",
    payload: { ok: report.ok && objects.corrupt.length === 0 && objects.missing.length === 0, rows: report.rows, objects: { checked: objects.checked, total: objects.total, corrupt: objects.corrupt.length, missing: objects.missing.length, sampled: objects.sampled }, nightly: true },
  });
  if (!report.ok) logger.error({ report }, "ledger integrity check FAILED");
  if (objects.corrupt.length || objects.missing.length) logger.error({ corrupt: objects.corrupt, missing: objects.missing }, "object store integrity check FAILED");

  const snap = await takeSnapshot({ db: data.database, objectsDir: data.paths.store, snapshotsDir: data.paths.snapshots, keysDir: data.paths.keys });
  logger.info({ dir: snap.dir, objects: snap.manifest.objects.count }, "snapshot taken");
  let mirrorOk: boolean | null = null;
  if (opts.mirror) {
    try {
      const m = await mirrorSnapshot(snap.dir, opts.mirror);
      logger.info({ mirror: opts.mirror, copied: m.copied }, "snapshot mirrored");
      mirrorOk = true;
    } catch (err) {
      logger.error({ err, mirror: opts.mirror }, "snapshot mirror FAILED; the second location is not reachable");
      mirrorOk = false;
    }
  }
  opts.report?.({ ledgerOk: report.ok, objectsBad: objects.corrupt.length + objects.missing.length, mirrorOk });

  await pruneSnapshots(data.paths.snapshots, keep);
}

export async function pruneSnapshots(snapshotsDir: string, keep: number): Promise<string[]> {
  const entries = (await readdir(snapshotsDir, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith("._"));
  const names = entries.map((e) => e.name).sort();
  const doomed = names.slice(0, Math.max(0, names.length - keep));
  for (const name of doomed) await rm(join(snapshotsDir, name), { recursive: true, force: true });
  return doomed;
}

/** Schedule the nightly job; returns a stop function. */
export function scheduleNightly(data: Data, logger: Logger, opts: MaintenanceOptions = {}): () => void {
  const hour = opts.hour ?? 3;
  const now = opts.now ?? (() => new Date());
  let timer: NodeJS.Timeout | null = null;
  const arm = () => {
    timer = setTimeout(() => {
      runNightly(data, logger, opts.keep, { mirror: opts.mirror ?? null, ...(opts.sweep ? { sweep: opts.sweep } : {}), ...(opts.report ? { report: opts.report } : {}) }).catch((err: unknown) => logger.error({ err }, "nightly maintenance failed"));
      arm();
    }, msUntilHour(hour, now()));
    timer.unref();
  };
  arm();
  return () => {
    if (timer) clearTimeout(timer);
  };
}
