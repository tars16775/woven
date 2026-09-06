import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, type Dirent } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { FileEntry, type FileListing, type FilesSummary, type Namespace, type Person, type StartUpload, type UploadSession } from "@woven/schema";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "./db/index.ts";
import { blobs, files, uploads } from "./db/schema.ts";
import type { HouseholdService } from "./household.ts";
import type { Ledger } from "./ledger.ts";
import type { ContentStore } from "./store/index.ts";

const nextId = monotonicFactory();
export const CHUNK_SIZE = 4 * 1024 * 1024;

export class FileError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413,
    message: string,
  ) {
    super(message);
    this.name = "FileError";
  }
}

/** "/a/b/" and "a/b" both become "/a/b"; "" and "/" are the root. */
export function normalizePath(p: string): string {
  const parts = p.split("/").map((x) => x.trim()).filter((x) => x && x !== "." && x !== "..");
  return `/${parts.join("/")}`;
}

/**
 * Files (phases 18 and 19): a person's view of blobs. Every file has an
 * owner and a namespace; who may read it follows the household's rules
 * (personal is one person's, household is everyone's). Bytes are
 * content-addressed, so the same photo backed up from three laptops is
 * stored once.
 */
export class FilesService {
  /** Called after a file is registered (photo indexing hangs off this). */
  onAdded: ((entry: FileEntry) => void) | null = null;
  onRemoved: ((fileId: string) => Promise<void>) | null = null;

  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly store: ContentStore,
    private readonly household: HouseholdService,
    private readonly tmpDir: string,
  ) {}

  private canRead(reader: Person, namespace: Namespace, ownerId: string) {
    return this.household.canRead(reader, namespace, ownerId);
  }

  /** Namespaces this person may browse; private ones only show their own files. */
  private visible(reader: Person, namespace: Namespace) {
    if (!this.household.namespacesFor(reader.role).includes(namespace)) throw new FileError(403, `A ${reader.role} cannot see the ${namespace} namespace.`);
    const own = and(eq(files.householdId, reader.householdId), eq(files.namespace, namespace), isNull(files.deletedAt));
    return this.canRead(reader, namespace, "__someone_else__") ? own : and(own, eq(files.ownerId, reader.id));
  }

  list(reader: Person, namespace: Namespace, path: string): FileListing {
    const dir = normalizePath(path);
    const prefix = dir === "/" ? "/" : `${dir}/`;
    const rows = this.db
      .select()
      .from(files)
      .where(and(this.visible(reader, namespace), dir === "/" ? sql`1=1` : like(files.path, `${dir}%`)))
      .all()
      .filter((f) => f.path === dir || f.path.startsWith(prefix));
    const here = rows.filter((f) => f.path === dir).sort((a, b) => a.name.localeCompare(b.name));
    const sub = new Map<string, { items: number; bytes: number }>();
    for (const f of rows) {
      if (f.path === dir) continue;
      const rest = f.path.slice(prefix.length);
      const first = rest.split("/")[0]!;
      const cur = sub.get(first) ?? { items: 0, bytes: 0 };
      cur.items += 1;
      cur.bytes += f.size;
      sub.set(first, cur);
    }
    return {
      namespace,
      path: dir,
      folders: [...sub.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, v]) => ({ name, path: `${prefix}${name}`, ...v })),
      files: here.map(toEntry),
    };
  }

  /** Files whose name contains the words asked for, across every namespace the reader may see. Names only: nothing reads inside documents. */
  search(reader: Person, needle: string, limit = 20): FileEntry[] {
    const words = needle.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return [];
    const out: FileEntry[] = [];
    for (const namespace of this.household.namespacesFor(reader.role)) {
      const rows = this.db.select().from(files).where(this.visible(reader, namespace)).all();
      for (const f of rows) {
        const name = f.name.toLowerCase();
        if (words.every((w) => name.includes(w))) out.push(toEntry(f));
      }
    }
    return out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, limit);
  }

  get(reader: Person, id: string) {
    const row = this.db.select().from(files).where(and(eq(files.id, id), isNull(files.deletedAt))).get();
    if (!row || row.householdId !== reader.householdId) throw new FileError(404, "No such file.");
    if (!this.canRead(reader, row.namespace as Namespace, row.ownerId)) throw new FileError(403, "That file is not yours to see.");
    return row;
  }

  open(reader: Person, id: string): { entry: FileEntry; stream: Readable } {
    const row = this.get(reader, id);
    return { entry: toEntry(row), stream: this.store.open(row.sha256) };
  }

  /** Register bytes already in the store as a file; dedup by hash is implicit. */
  add(owner: Person, input: { name: string; path: string; namespace: Namespace; sha256: string; size: number; mime?: string | null; source?: string | null; modifiedAt?: string }): FileEntry {
    if (!this.household.namespacesFor(owner.role).includes(input.namespace)) throw new FileError(403, `A ${owner.role} cannot put files in ${input.namespace}.`);
    const path = normalizePath(input.path);
    const now = new Date().toISOString();
    const id = nextId();
    const entry = this.db.transaction((tx) => {
      if (!tx.select({ sha256: blobs.sha256 }).from(blobs).where(eq(blobs.sha256, input.sha256)).get()) {
        tx.insert(blobs).values({ sha256: input.sha256, size: input.size, mime: input.mime ?? null, createdAt: now }).run();
      }
      // Same owner, same folder, same name: the newer bytes replace the older entry (a backup re-run), the old row is tombstoned.
      const existing = tx.select().from(files).where(and(eq(files.ownerId, owner.id), eq(files.namespace, input.namespace), eq(files.path, path), eq(files.name, input.name), isNull(files.deletedAt))).get();
      if (existing?.sha256 === input.sha256) return toEntry(existing);
      if (existing) tx.update(files).set({ deletedAt: now }).where(eq(files.id, existing.id)).run();
      tx.insert(files)
        .values({ id, householdId: owner.householdId, ownerId: owner.id, namespace: input.namespace, path, name: input.name, sha256: input.sha256, size: input.size, mime: input.mime ?? mimeGuess(input.name), source: input.source ?? null, createdAt: now, modifiedAt: input.modifiedAt ?? now })
        .run();
      return toEntry(tx.select().from(files).where(eq(files.id, id)).get()!);
    });
    if (entry.id === id) this.onAdded?.(entry);
    return entry;
  }

  /** Put bytes and register them in one go (small uploads, the backup client). */
  async put(owner: Person, input: { name: string; path: string; namespace: Namespace; mime?: string | null; source?: string | null; modifiedAt?: string }, bytes: Readable | Buffer): Promise<FileEntry> {
    const stored = await this.store.put(bytes);
    return this.add(owner, { ...input, sha256: stored.sha256, size: stored.size });
  }

  has(sha256: string): Promise<boolean> {
    return this.store.has(sha256);
  }

  move(actor: Person, id: string, to: { path?: string | undefined; name?: string | undefined; namespace?: Namespace | undefined }): FileEntry {
    const row = this.get(actor, id);
    if (row.ownerId !== actor.id && actor.role !== "owner") throw new FileError(403, "Only the file's owner can move it.");
    const namespace = to.namespace ?? (row.namespace as Namespace);
    if (!this.household.namespacesFor(actor.role).includes(namespace)) throw new FileError(403, `A ${actor.role} cannot put files in ${namespace}.`);
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      tx.update(files).set({ path: to.path ? normalizePath(to.path) : row.path, name: to.name?.trim() || row.name, namespace, modifiedAt: now }).where(eq(files.id, id)).run();
      if (namespace !== row.namespace) {
        this.ledger.append({ type: "action.executed", householdId: row.householdId, actor: { kind: "person", id: actor.id }, where: "inside", target: id, namespace, sensitivity: "low", payload: { capability: "file.share", planned: { from: row.namespace, to: namespace }, observed: { namespace } } });
      }
    });
    return toEntry(this.db.select().from(files).where(eq(files.id, id)).get()!);
  }

  /** Tombstone; the object is removed only when no live file references it. */
  async remove(actor: Person, id: string): Promise<void> {
    const row = this.get(actor, id);
    if (row.ownerId !== actor.id && actor.role !== "owner") throw new FileError(403, "Only the file's owner can delete it.");
    this.db.update(files).set({ deletedAt: new Date().toISOString() }).where(eq(files.id, id)).run();
    await this.onRemoved?.(id);
    const still = this.db.select({ id: files.id }).from(files).where(and(eq(files.sha256, row.sha256), isNull(files.deletedAt))).get();
    if (!still) await this.store.remove(row.sha256);
  }

  summary(reader: Person, disk: { usedBytes: number; totalBytes: number }): FilesSummary {
    const rows = this.db.select().from(files).where(and(eq(files.householdId, reader.householdId), isNull(files.deletedAt))).all().filter((f) => this.canRead(reader, f.namespace as Namespace, f.ownerId));
    const ns = new Map<string, { items: number; bytes: number }>();
    const src = new Map<string, { items: number; bytes: number; lastAt: string }>();
    const unique = new Map<string, number>();
    for (const f of rows) {
      const n = ns.get(f.namespace) ?? { items: 0, bytes: 0 };
      n.items += 1;
      n.bytes += f.size;
      ns.set(f.namespace, n);
      const s = src.get(f.source ?? "dashboard") ?? { items: 0, bytes: 0, lastAt: f.modifiedAt };
      s.items += 1;
      s.bytes += f.size;
      if (f.modifiedAt > s.lastAt) s.lastAt = f.modifiedAt;
      src.set(f.source ?? "dashboard", s);
      unique.set(f.sha256, f.size);
    }
    return {
      byNamespace: [...ns.entries()].map(([namespace, v]) => ({ namespace: namespace as Namespace, ...v })),
      sources: [...src.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
      totalBytes: rows.reduce((n, f) => n + f.size, 0),
      uniqueBytes: [...unique.values()].reduce((n, b) => n + b, 0),
      disk,
    };
  }

  /* Resumable, chunked uploads (phase 18) */

  async startUpload(owner: Person, input: StartUpload): Promise<UploadSession> {
    if (!this.household.namespacesFor(owner.role).includes(input.namespace)) throw new FileError(403, `A ${owner.role} cannot put files in ${input.namespace}.`);
    const alreadyStored = input.sha256 ? await this.store.has(input.sha256) : false;
    const id = nextId();
    const now = new Date().toISOString();
    this.db
      .insert(uploads)
      .values({ id, ownerId: owner.id, householdId: owner.householdId, namespace: input.namespace, path: normalizePath(input.path), name: input.name, size: input.size, mime: input.mime ?? null, sha256: input.sha256 ?? null, chunkSize: CHUNK_SIZE, received: "[]", source: input.source ?? "dashboard", createdAt: now, updatedAt: now })
      .run();
    await mkdir(join(this.tmpDir, id), { recursive: true });
    return { id, chunkSize: CHUNK_SIZE, chunks: Math.ceil(input.size / CHUNK_SIZE), received: [], alreadyStored };
  }

  session(owner: Person, id: string) {
    const row = this.db.select().from(uploads).where(eq(uploads.id, id)).get();
    if (!row || row.ownerId !== owner.id) throw new FileError(404, "No such upload.");
    return row;
  }

  status(owner: Person, id: string): UploadSession {
    const row = this.session(owner, id);
    return { id, chunkSize: row.chunkSize, chunks: Math.ceil(row.size / row.chunkSize), received: JSON.parse(row.received) as number[], alreadyStored: false };
  }

  async putChunk(owner: Person, id: string, index: number, body: Readable): Promise<UploadSession> {
    const row = this.session(owner, id);
    const chunks = Math.ceil(row.size / row.chunkSize);
    if (index < 0 || index >= chunks) throw new FileError(400, `Chunk ${index} is outside this upload (${chunks} chunks).`);
    const dest = join(this.tmpDir, id, String(index));
    await pipeline(body, createWriteStream(dest, { mode: 0o600 }));
    const got = (await stat(dest)).size;
    const expected = index === chunks - 1 ? row.size - index * row.chunkSize : row.chunkSize;
    if (got !== expected) {
      await rm(dest, { force: true });
      throw new FileError(400, `Chunk ${index} should be ${expected} bytes, got ${got}.`);
    }
    const received = new Set(JSON.parse(row.received) as number[]);
    received.add(index);
    const list = [...received].sort((a, b) => a - b);
    this.db.update(uploads).set({ received: JSON.stringify(list), updatedAt: new Date().toISOString() }).where(eq(uploads.id, id)).run();
    return { id, chunkSize: row.chunkSize, chunks, received: list, alreadyStored: false };
  }

  /** Assemble the chunks into one object, verify the hash the client promised, register the file. */
  async completeUpload(owner: Person, id: string): Promise<FileEntry> {
    const row = this.session(owner, id);
    const chunks = Math.ceil(row.size / row.chunkSize);
    const received = JSON.parse(row.received) as number[];
    const dir = join(this.tmpDir, id);
    let entry: FileEntry;
    if (row.sha256 && (await this.store.has(row.sha256))) {
      entry = this.add(owner, { name: row.name, path: row.path, namespace: row.namespace as Namespace, sha256: row.sha256, size: row.size, mime: row.mime, source: row.source });
    } else {
      if (received.length !== chunks) throw new FileError(409, `Upload incomplete: ${received.length} of ${chunks} chunks.`);
      const parts = Array.from({ length: chunks }, (_, i) => join(dir, String(i)));
      const stored = await this.store.put(Readable.from(concat(parts)));
      if (row.sha256 && stored.sha256 !== row.sha256) {
        await this.store.remove(stored.sha256);
        throw new FileError(400, "The bytes did not hash to what the client promised.");
      }
      if (stored.size !== row.size) throw new FileError(400, `Expected ${row.size} bytes, stored ${stored.size}.`);
      entry = this.add(owner, { name: row.name, path: row.path, namespace: row.namespace as Namespace, sha256: stored.sha256, size: stored.size, mime: row.mime, source: row.source });
    }
    await rm(dir, { recursive: true, force: true });
    this.db.delete(uploads).where(eq(uploads.id, id)).run();
    return entry;
  }

  /** Abandoned uploads older than a day go away. */
  async sweepUploads(maxAgeMs = 86_400_000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const stale = this.db.select({ id: uploads.id }).from(uploads).where(sql`${uploads.updatedAt} < ${cutoff}`).all();
    for (const s of stale) {
      await rm(join(this.tmpDir, s.id), { recursive: true, force: true });
      this.db.delete(uploads).where(eq(uploads.id, s.id)).run();
    }
    return stale.length;
  }
}

async function* concat(paths: string[]) {
  for (const p of paths) for await (const chunk of createReadStream(p)) yield chunk as Buffer;
}

export async function sha256File(path: string): Promise<string> {
  const h = createHash("sha256");
  for await (const c of createReadStream(path)) h.update(c as Buffer);
  return h.digest("hex");
}

/** Every regular file under a folder, skipping AppleDouble sidecars and hidden folders. */
export async function* walkFiles(dir: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(p);
    else if (e.isFile()) yield p;
  }
}

const EXT: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic", ".heif": "image/heif", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown", ".mp4": "video/mp4", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".m4a": "audio/mp4" };
/** A type from the name when the client gave none. */
export function mimeGuess(name: string): string | null {
  const m = /\.[a-z0-9]+$/i.exec(name);
  return m ? (EXT[m[0].toLowerCase()] ?? null) : null;
}

function toEntry(row: typeof files.$inferSelect): FileEntry {
  return FileEntry.parse({ id: row.id, ownerId: row.ownerId, namespace: row.namespace, path: row.path, name: row.name, sha256: row.sha256, size: row.size, mime: row.mime, source: row.source, createdAt: row.createdAt, modifiedAt: row.modifiedAt });
}
