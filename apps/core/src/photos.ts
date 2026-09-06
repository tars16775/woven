import { createReadStream } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import exifr from "exifr";
import sharp from "sharp";
import { Photo, type Namespace, type Person, type PhotoStats, type PhotoTimeline } from "@woven/schema";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "./db/index.ts";
import { files, photos } from "./db/schema.ts";
import { sha256File, walkFiles, type FilesService } from "./files.ts";
import type { HouseholdService } from "./household.ts";
import type { Ledger } from "./ledger.ts";
import type { ContentStore } from "./store/index.ts";

const nextId = monotonicFactory();
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp", "image/tiff", "image/gif", "image/avif"]);
const EXT_MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic", ".heif": "image/heif", ".webp": "image/webp", ".tif": "image/tiff", ".tiff": "image/tiff", ".gif": "image/gif", ".avif": "image/avif" };

export function mimeForName(name: string): string | null {
  const m = /\.[a-z0-9]+$/i.exec(name);
  return m ? (EXT_MIME[m[0].toLowerCase()] ?? null) : null;
}
export const isImage = (mime: string | null | undefined) => !!mime && IMAGE_MIMES.has(mime);

/**
 * Photos (phase 20). An image file becomes a photo: EXIF read on the box,
 * a 512px thumbnail and a 2048px preview rendered once and stored as
 * objects (so every viewer gets the same bytes and nothing is re-encoded per
 * request). Faces are not detected; the site promises that stays off.
 */
export class PhotoService {
  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly store: ContentStore,
    private readonly household: HouseholdService,
    private readonly filesService: FilesService,
  ) {}

  private readonly inflight = new Map<string, Promise<Photo | null>>();
  /** Called after a new photo row exists (the search index hangs off this). */
  onIndexed: (() => void) | null = null;

  /** Index one file that is already in the store. Idempotent per file, and one at a time per file. */
  index(fileId: string): Promise<Photo | null> {
    const running = this.inflight.get(fileId);
    if (running) return running;
    const p = this.indexNow(fileId).finally(() => this.inflight.delete(fileId));
    this.inflight.set(fileId, p);
    return p;
  }

  private async indexNow(fileId: string): Promise<Photo | null> {
    const f = this.db.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).get();
    if (!f || !isImage(f.mime ?? mimeForName(f.name))) return null;
    const existing = this.db.select().from(photos).where(eq(photos.fileId, fileId)).get();
    if (existing) return this.toPhoto(existing, f.name);

    const chunks: Buffer[] = [];
    for await (const c of this.store.open(f.sha256)) chunks.push(c as Buffer);
    const bytes = Buffer.concat(chunks);
    let width = 0;
    let height = 0;
    let takenAt = f.modifiedAt;
    let camera: string | null = null;
    let lat: number | null = null;
    let lon: number | null = null;
    try {
      const meta = await sharp(bytes, { failOn: "none" }).rotate().metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
    } catch {
      return null; // not something sharp can read
    }
    try {
      const ex = (await exifr.parse(bytes, { pick: ["DateTimeOriginal", "CreateDate", "Make", "Model"] })) as Record<string, unknown> | undefined;
      const when = (ex?.DateTimeOriginal ?? ex?.CreateDate) as Date | undefined;
      if (when instanceof Date && !Number.isNaN(when.getTime())) takenAt = when.toISOString();
      const make = typeof ex?.Make === "string" ? ex.Make.trim() : "";
      const model = typeof ex?.Model === "string" ? ex.Model.trim() : "";
      camera = [make, model.startsWith(make) ? model.slice(make.length).trim() : model].filter(Boolean).join(" ") || null;
      const gps = (await exifr.gps(bytes).catch(() => null)) as { latitude?: number; longitude?: number } | null;
      if (typeof gps?.latitude === "number" && typeof gps.longitude === "number") {
        lat = gps.latitude;
        lon = gps.longitude;
      }
    } catch {
      // no EXIF: the file's own date stands
    }
    const thumb = await this.store.put(await sharp(bytes, { failOn: "none" }).rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer());
    const preview = await this.store.put(await sharp(bytes, { failOn: "none" }).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer());
    const id = nextId();
    this.db
      .insert(photos)
      .values({ id, fileId, householdId: f.householdId, ownerId: f.ownerId, namespace: f.namespace, sha256: f.sha256, takenAt, width, height, camera, lat, lon, thumbSha: thumb.sha256, previewSha: preview.sha256, createdAt: new Date().toISOString() })
      .onConflictDoNothing()
      .run();
    this.onIndexed?.();
    return this.toPhoto(this.db.select().from(photos).where(eq(photos.fileId, fileId)).get()!, f.name);
  }

  /** Index every image file this person owns that is not yet a photo. */
  async indexAll(owner: Person): Promise<number> {
    const rows = this.db.select().from(files).where(and(eq(files.ownerId, owner.id), isNull(files.deletedAt))).all();
    let n = 0;
    for (const f of rows) {
      if (!isImage(f.mime ?? mimeForName(f.name))) continue;
      if (this.db.select({ id: photos.id }).from(photos).where(eq(photos.fileId, f.id)).get()) continue;
      if (await this.index(f.id)) n += 1;
    }
    return n;
  }

  /** Import a folder on the box (an export from another library) as this person's photos. */
  async importFolder(owner: Person, folder: string, namespace: Namespace = "personal"): Promise<{ files: number; photos: number }> {
    const root = resolve(folder);
    let seen = 0;
    let indexed = 0;
    for await (const file of walkFiles(root)) {
      const mime = mimeForName(basename(file));
      if (!mime) continue;
      seen += 1;
      const sha256 = await sha256File(file);
      if (!(await this.store.has(sha256))) await this.store.put(createReadStream(file));
      const relDir = relative(root, dirname(file));
      const { size, mtime } = await import("node:fs/promises").then((fs) => fs.stat(file));
      const entry = this.filesService.add(owner, { name: basename(file), path: `/Photos/${basename(root)}${relDir ? `/${relDir}` : ""}`, namespace, sha256, size, mime, source: "import", modifiedAt: mtime.toISOString() });
      const known = !!this.db.select({ id: photos.id }).from(photos).where(eq(photos.fileId, entry.id)).get() && !this.inflight.has(entry.id);
      if (!known && (await this.index(entry.id))) indexed += 1;
    }
    this.ledger.append({ type: "action.executed", householdId: owner.householdId, actor: { kind: "person", id: owner.id }, where: "inside", target: basename(root), sensitivity: "low", payload: { capability: "photos.import", planned: { folder: basename(root) }, observed: { files: seen, photos: indexed } } });
    return { files: seen, photos: indexed };
  }

  private visible(reader: Person) {
    return (row: typeof photos.$inferSelect) => this.household.canRead(reader, row.namespace as Namespace, row.ownerId);
  }

  timeline(reader: Person, cursor: string | null, limit = 120): PhotoTimeline {
    const where = cursor ? and(eq(photos.householdId, reader.householdId), isNull(photos.deletedAt), lt(photos.takenAt, cursor)) : and(eq(photos.householdId, reader.householdId), isNull(photos.deletedAt));
    const rows = this.db.select({ p: photos, name: files.name }).from(photos).innerJoin(files, eq(files.id, photos.fileId)).where(where).orderBy(desc(photos.takenAt), desc(photos.id)).all();
    const ok = this.visible(reader);
    const mine = rows.filter((r) => ok(r.p));
    const page = mine.slice(0, limit);
    const total = this.db.select().from(photos).where(and(eq(photos.householdId, reader.householdId), isNull(photos.deletedAt))).all().filter(ok).length;
    return { photos: page.map((r) => this.toPhoto(r.p, r.name)), cursor: mine.length > limit ? page[page.length - 1]!.p.takenAt : null, total };
  }

  stats(reader: Person): PhotoStats {
    const ok = this.visible(reader);
    const rows = this.db.select().from(photos).where(and(eq(photos.householdId, reader.householdId), isNull(photos.deletedAt))).all().filter(ok);
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const months = new Map<string, number>();
    for (const r of rows) months.set(r.takenAt.slice(0, 7), (months.get(r.takenAt.slice(0, 7)) ?? 0) + 1);
    return {
      total: rows.length,
      newThisWeek: rows.filter((r) => r.createdAt > weekAgo).length,
      withPlace: rows.filter((r) => r.lat !== null).length,
      months: [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, count]) => ({ month, count })),
    };
  }

  derived(reader: Person, id: string, kind: "thumb" | "preview"): { sha256: string; mime: string } {
    const row = this.db.select().from(photos).where(and(eq(photos.id, id), isNull(photos.deletedAt))).get();
    if (!row || row.householdId !== reader.householdId || !this.household.canRead(reader, row.namespace as Namespace, row.ownerId)) throw Object.assign(new Error("No such photo."), { statusCode: 404 });
    return { sha256: kind === "thumb" ? row.thumbSha : row.previewSha, mime: "image/jpeg" };
  }

  /** When a file is deleted its photo goes with it; derived objects are removed if nothing else uses them. */
  async forget(fileId: string): Promise<void> {
    const row = this.db.select().from(photos).where(eq(photos.fileId, fileId)).get();
    if (!row) return;
    this.db.update(photos).set({ deletedAt: new Date().toISOString() }).where(eq(photos.id, row.id)).run();
    for (const sha of [row.thumbSha, row.previewSha]) {
      const used = this.db.select({ id: photos.id }).from(photos).where(and(isNull(photos.deletedAt), sql`(${photos.thumbSha} = ${sha} or ${photos.previewSha} = ${sha})`)).get();
      if (!used) await this.store.remove(sha);
    }
  }

  private toPhoto(row: typeof photos.$inferSelect, name: string): Photo {
    return Photo.parse({ id: row.id, fileId: row.fileId, ownerId: row.ownerId, namespace: row.namespace, name, takenAt: row.takenAt, width: row.width, height: row.height, camera: row.camera, place: row.lat !== null && row.lon !== null ? { lat: row.lat, lon: row.lon } : null });
  }
}
