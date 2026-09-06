import { createHash, randomBytes } from "node:crypto";
import type { Person, Share } from "@woven/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "./db/index.ts";
import { files, shares } from "./db/schema.ts";
import { FileError, type FilesService } from "./files.ts";
import type { Ledger } from "./ledger.ts";

const nextId = monotonicFactory();
export const MAX_SHARE_HOURS = 24 * 30;

/**
 * Expiring share links (gap 19). A link is a random token whose hash the
 * box keeps, tied to one file, one person and an expiry, optionally a
 * download cap. Anyone holding the link can fetch that one file until it
 * expires or is revoked; nothing else on the box is reachable through it.
 * Every creation, use and revocation is a receipt.
 */
export class ShareService {
  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly files: FilesService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  create(person: Person, fileId: string, opts: { expiresInHours?: number; maxDownloads?: number | null } = {}): { share: Share; token: string } {
    if (person.role === "guest") throw new FileError(403, "Guests cannot make share links.");
    const row = this.files.get(person, fileId);
    const hours = Math.min(MAX_SHARE_HOURS, Math.max(1, opts.expiresInHours ?? 24 * 7));
    const token = randomBytes(32).toString("base64url");
    const now = this.now();
    const id = nextId();
    const expiresAt = new Date(now.getTime() + hours * 3_600_000).toISOString();
    this.db.transaction((tx) => {
      tx.insert(shares).values({ id, fileId: row.id, householdId: row.householdId, createdBy: person.id, tokenHash: hash(token), expiresAt, maxDownloads: opts.maxDownloads ?? null, downloads: 0, createdAt: now.toISOString() }).run();
      this.ledger.append({ type: "file.shared", householdId: row.householdId, actor: { kind: "person", id: person.id }, where: "inside", target: row.id, namespace: row.namespace as Share["namespace"], sensitivity: "normal", payload: { shareId: id, expiresAt, maxDownloads: opts.maxDownloads ?? null, name: row.name } });
    });
    return { share: this.get(id)!, token };
  }

  /** The person's own links; the owner sees every link in the household. */
  list(person: Person): Share[] {
    const rows = this.db.select().from(shares).where(and(eq(shares.householdId, person.householdId), isNull(shares.revokedAt))).orderBy(desc(shares.createdAt)).all();
    return rows.filter((r) => person.role === "owner" || r.createdBy === person.id).map((r) => this.toShare(r)).filter((s): s is Share => s !== null);
  }

  revoke(person: Person, id: string): Share {
    const row = this.db.select().from(shares).where(and(eq(shares.id, id), isNull(shares.revokedAt))).get();
    if (!row || row.householdId !== person.householdId) throw new FileError(404, "No such link.");
    if (row.createdBy !== person.id && person.role !== "owner") throw new FileError(403, "Only whoever made the link, or the owner, can revoke it.");
    const now = this.now().toISOString();
    this.db.transaction((tx) => {
      tx.update(shares).set({ revokedAt: now }).where(eq(shares.id, id)).run();
      this.ledger.append({ type: "file.share_revoked", householdId: row.householdId, actor: { kind: "person", id: person.id }, where: "inside", target: row.fileId, sensitivity: "low", payload: { shareId: id } });
    });
    return this.get(id)!;
  }

  /** A live link's file, or null: expired, revoked, exhausted and unknown tokens all look the same from outside. */
  resolve(token: string): { share: Share; file: typeof files.$inferSelect } | null {
    if (!token || token.length < 32) return null;
    const row = this.db.select().from(shares).where(and(eq(shares.tokenHash, hash(token)), isNull(shares.revokedAt))).get();
    if (!row) return null;
    const nowIso = this.now().toISOString();
    if (row.expiresAt <= nowIso) return null;
    if (row.maxDownloads !== null && row.downloads >= row.maxDownloads) return null;
    const file = this.db.select().from(files).where(and(eq(files.id, row.fileId), isNull(files.deletedAt))).get();
    if (!file) return null;
    const share = this.toShare(row);
    return share ? { share, file } : null;
  }

  /** Count a download. The receipt says which link, never who fetched it: the box does not keep strangers' addresses. */
  used(shareId: string): void {
    const row = this.db.select().from(shares).where(eq(shares.id, shareId)).get();
    if (!row) return;
    const now = this.now().toISOString();
    this.db.transaction((tx) => {
      tx.update(shares).set({ downloads: row.downloads + 1, lastUsedAt: now }).where(eq(shares.id, shareId)).run();
      this.ledger.append({ type: "file.share_used", householdId: row.householdId, actor: { kind: "core", id: "share-link" }, where: "inside", target: row.fileId, sensitivity: "normal", payload: { shareId, downloads: row.downloads + 1 } });
    });
  }

  private get(id: string): Share | null {
    const row = this.db.select().from(shares).where(eq(shares.id, id)).get();
    return row ? this.toShare(row) : null;
  }

  private toShare(row: typeof shares.$inferSelect): Share | null {
    const file = this.db.select().from(files).where(eq(files.id, row.fileId)).get();
    if (!file) return null;
    return {
      id: row.id,
      fileId: row.fileId,
      name: file.name,
      size: file.size,
      mime: file.mime,
      namespace: file.namespace as Share["namespace"],
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      maxDownloads: row.maxDownloads,
      downloads: row.downloads,
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
      live: row.revokedAt === null && row.expiresAt > this.now().toISOString() && (row.maxDownloads === null || row.downloads < row.maxDownloads) && file.deletedAt === null,
    };
  }
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
