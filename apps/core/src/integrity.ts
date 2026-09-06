import { cp, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import type { Db } from "./db/index.ts";
import { openDatabase } from "./db/index.ts";
import { blobs } from "./db/schema.ts";
import { Ledger } from "./ledger.ts";
import { restoreSnapshot } from "./snapshot.ts";
import { ContentStore } from "./store/index.ts";

export type StoreReport = { checked: number; total: number; corrupt: string[]; missing: string[]; sampled: boolean };

/**
 * Re-hash objects against their addresses (phase 23). Every object when the
 * store is small; a random sample above `sampleAbove`, so a nightly check
 * stays short on a terabyte of photos and still catches a failing drive.
 */
export async function verifyStore(db: Db, store: ContentStore, opts: { sampleAbove?: number; sample?: number } = {}): Promise<StoreReport> {
  const all = db.select({ sha256: blobs.sha256 }).from(blobs).all().map((b) => b.sha256);
  const sampleAbove = opts.sampleAbove ?? 2000;
  const sampled = all.length > sampleAbove;
  const picked = sampled ? shuffle(all).slice(0, opts.sample ?? 500) : all;
  const corrupt: string[] = [];
  const missing: string[] = [];
  for (const sha of picked) {
    if (!(await store.has(sha))) missing.push(sha);
    else if (!(await store.verify(sha))) corrupt.push(sha);
  }
  return { checked: picked.length, total: all.length, corrupt, missing, sampled };
}

export type SnapshotInfo = { name: string; takenAt: string; objects: number; bytes: number; mirrored: boolean };

export async function listSnapshots(snapshotsDir: string, mirrorDir: string | null): Promise<SnapshotInfo[]> {
  let names: string[] = [];
  try {
    names = (await readdir(snapshotsDir, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith("._")).map((e) => e.name);
  } catch {
    return [];
  }
  const out: SnapshotInfo[] = [];
  for (const name of names.sort().reverse()) {
    try {
      const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(join(snapshotsDir, name, "manifest.json"), "utf8")) as { takenAt: string; objects: { count: number; bytes: number }; database: { bytes: number } };
      let mirrored = false;
      if (mirrorDir) {
        try {
          mirrored = (await stat(join(mirrorDir, name, "manifest.json"))).isFile();
        } catch {
          mirrored = false;
        }
      }
      out.push({ name, takenAt: manifest.takenAt, objects: manifest.objects.count, bytes: manifest.objects.bytes + manifest.database.bytes, mirrored });
    } catch {
      // a half-written snapshot: not listed, pruned in time
    }
  }
  return out;
}

/** Copy a snapshot to the second location (another drive, a folder the household chose). Idempotent. */
export async function mirrorSnapshot(snapshotDir: string, mirrorDir: string): Promise<{ copied: boolean }> {
  const name = snapshotDir.split("/").pop()!;
  const dest = join(mirrorDir, name);
  try {
    if ((await stat(join(dest, "manifest.json"))).isFile()) return { copied: false };
  } catch {
    // not there yet
  }
  const tmp = `${dest}.partial`;
  await rm(tmp, { recursive: true, force: true });
  await cp(snapshotDir, tmp, { recursive: true, errorOnExist: false });
  await (await import("node:fs/promises")).rename(tmp, dest);
  return { copied: true };
}

export type DrillReport = {
  snapshot: string;
  takenAt: string;
  ok: boolean;
  ledger: { ok: boolean; rows: number };
  objects: StoreReport;
  durationMs: number;
  problem: string | null;
};

/**
 * The restore drill: take the newest snapshot, restore it into a scratch
 * folder, open the database, verify the chain and the objects, throw the
 * scratch away. A backup that has never been restored is a hope, not a plan.
 */
export async function restoreDrill(snapshotsDir: string, mirrorDir: string | null = null): Promise<DrillReport> {
  const started = Date.now();
  const [latest] = await listSnapshots(snapshotsDir, mirrorDir);
  if (!latest) throw new Error("There is no snapshot to restore yet.");
  const scratch = await mkdtemp(join(os.tmpdir(), "woven-drill-"));
  try {
    const dbPath = join(scratch, "db", "woven.sqlite");
    const objectsDir = join(scratch, "store", "objects");
    await restoreSnapshot({ snapshotDir: join(snapshotsDir, latest.name), dbPath, objectsDir });
    const opened = openDatabase(dbPath);
    try {
      const ledger = new Ledger(opened.db).verify();
      const store = new ContentStore(objectsDir, join(scratch, "store", "tmp"));
      const objects = await verifyStore(opened.db, store, { sampleAbove: 500, sample: 200 });
      const ok = ledger.ok && objects.corrupt.length === 0 && objects.missing.length === 0;
      return { snapshot: latest.name, takenAt: latest.takenAt, ok, ledger: { ok: ledger.ok, rows: ledger.rows }, objects, durationMs: Date.now() - started, problem: ok ? null : !ledger.ok ? "the restored ledger does not verify" : `${objects.corrupt.length} corrupt, ${objects.missing.length} missing objects` };
    } finally {
      opened.close();
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
