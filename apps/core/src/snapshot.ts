import { constants, promises as fs, type Dirent } from "node:fs";
import { join, relative } from "node:path";
import Database from "better-sqlite3";
import type { OpenedDatabase } from "./db/index.ts";

export type SnapshotManifest = {
  version: 1;
  takenAt: string;
  database: { file: string; bytes: number };
  objects: { count: number; bytes: number };
};

/**
 * A consistent copy of the household: the database via SQLite's online
 * backup API (safe while the core is running) and the object store cloned
 * file by file. On APFS the clone is copy-on-write, so a snapshot of a
 * terabyte of photos costs seconds and almost no space until files change.
 */
export async function takeSnapshot(opts: { db: OpenedDatabase; objectsDir: string; snapshotsDir: string; now?: Date }): Promise<{ dir: string; manifest: SnapshotManifest }> {
  const now = opts.now ?? new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const dir = join(opts.snapshotsDir, stamp);
  await fs.mkdir(join(dir, "objects"), { recursive: true });

  const dbFile = join(dir, "woven.sqlite");
  await opts.db.sqlite.backup(dbFile);
  const dbBytes = (await fs.stat(dbFile)).size;

  let count = 0;
  let bytes = 0;
  for await (const file of walk(opts.objectsDir)) {
    const rel = relative(opts.objectsDir, file);
    const dest = join(dir, "objects", rel);
    await fs.mkdir(join(dest, ".."), { recursive: true });
    await fs.copyFile(file, dest, constants.COPYFILE_FICLONE);
    count += 1;
    bytes += (await fs.stat(file)).size;
  }

  const manifest: SnapshotManifest = {
    version: 1,
    takenAt: now.toISOString(),
    database: { file: "woven.sqlite", bytes: dbBytes },
    objects: { count, bytes },
  };
  await fs.writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return { dir, manifest };
}

/**
 * Restore a snapshot into an empty data layout. Refuses to overwrite an
 * existing database: restoring over a live household is a decision a person
 * makes explicitly by moving the old one aside first.
 */
export async function restoreSnapshot(opts: { snapshotDir: string; dbPath: string; objectsDir: string }): Promise<SnapshotManifest> {
  const manifest = JSON.parse(await fs.readFile(join(opts.snapshotDir, "manifest.json"), "utf8")) as SnapshotManifest;
  if (manifest.version !== 1) throw new Error(`unknown snapshot version ${String(manifest.version)}`);
  if (await exists(opts.dbPath)) throw new Error(`refusing to overwrite existing database at ${opts.dbPath}`);

  await fs.mkdir(join(opts.dbPath, ".."), { recursive: true });
  await fs.copyFile(join(opts.snapshotDir, manifest.database.file), opts.dbPath);
  // Sanity: the copied database must open and be intact.
  const check = new Database(opts.dbPath, { readonly: true });
  const result = check.pragma("integrity_check", { simple: true }) as string;
  check.close();
  if (result !== "ok") throw new Error(`restored database failed integrity check: ${result}`);

  const src = join(opts.snapshotDir, "objects");
  for await (const file of walk(src)) {
    const dest = join(opts.objectsDir, relative(src, file));
    await fs.mkdir(join(dest, ".."), { recursive: true });
    await fs.copyFile(file, dest, constants.COPYFILE_FICLONE);
  }
  return manifest;
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith("._")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
