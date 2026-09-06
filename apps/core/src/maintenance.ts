import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "./logger.ts";
import { CORE_HOUSEHOLD_ID, type Data } from "./data.ts";
import { takeSnapshot } from "./snapshot.ts";

export type MaintenanceOptions = {
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
export async function runNightly(data: Data, logger: Logger, keep = 14): Promise<void> {
  const report = data.ledger.verify();
  data.ledger.append({
    type: "core.integrity_checked",
    householdId: CORE_HOUSEHOLD_ID,
    actor: { kind: "core", id: "core" },
    where: "inside",
    sensitivity: "low",
    payload: { ok: report.ok, rows: report.rows, nightly: true },
  });
  if (!report.ok) logger.error({ report }, "ledger integrity check FAILED");

  const snap = await takeSnapshot({ db: data.database, objectsDir: data.paths.store, snapshotsDir: data.paths.snapshots });
  logger.info({ dir: snap.dir, objects: snap.manifest.objects.count }, "snapshot taken");

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
      runNightly(data, logger, opts.keep).catch((err: unknown) => logger.error({ err }, "nightly maintenance failed"));
      arm();
    }, msUntilHour(hour, now()));
    timer.unref();
  };
  arm();
  return () => {
    if (timer) clearTimeout(timer);
  };
}
