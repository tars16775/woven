import { and, eq, isNull, notInArray } from "drizzle-orm";
import type { Db } from "./db/index.ts";
import { files, photoEmbeddings, photos } from "./db/schema.ts";
import type { HouseholdService } from "./household.ts";
import type { ModelStore } from "./models.ts";
import type { Namespace, Person, Photo } from "@woven/schema";
import type { ContentStore } from "./store/index.ts";
import type { Logger } from "./logger.ts";

const MODEL = "photo-search";

/** Text and image to the same vector space; the real one is CLIP on the box, tests use a stub. */
export interface Embedder {
  readonly name: string;
  image(bytes: Buffer): Promise<Float32Array>;
  text(query: string): Promise<Float32Array>;
}

/**
 * Photo search (phase 21): an on-device embedding per photo, cosine
 * similarity at query time. No cloud, no faces. Embeddings live in their own
 * table so a model change re-indexes without touching the photos.
 */
export class PhotoIndex {
  private embedder: Embedder | null = null;
  private loading: Promise<Embedder | null> | null = null;
  private running = false;

  constructor(
    private readonly db: Db,
    private readonly store: ContentStore,
    private readonly household: HouseholdService,
    private readonly models: ModelStore,
    private readonly logger: Logger,
    private readonly loadEmbedder: (modelDir: string) => Promise<Embedder>,
  ) {}

  /** True when the model is on the box. */
  async ready(): Promise<boolean> {
    return this.models.isInstalled(MODEL);
  }

  private async getEmbedder(): Promise<Embedder | null> {
    if (this.embedder) return this.embedder;
    if (!(await this.ready())) return null;
    if (!this.loading) {
      const spec = this.models.spec(MODEL)!;
      this.loading = this.loadEmbedder(this.models.pathFor(spec))
        .then((e) => (this.embedder = e))
        .catch((err: unknown) => {
          this.logger.error({ err }, "photo search model failed to load");
          return null;
        })
        .finally(() => (this.loading = null));
    }
    return this.loading;
  }

  /** Embed every photo that has none yet. Safe to call often; only one run at a time. */
  async indexPending(limit = 500): Promise<number> {
    if (this.running) return 0;
    const emb = await this.getEmbedder();
    if (!emb) return 0;
    this.running = true;
    let n = 0;
    try {
      const done = this.db.select({ id: photoEmbeddings.photoId }).from(photoEmbeddings).where(eq(photoEmbeddings.model, emb.name)).all().map((r) => r.id);
      const pending = this.db
        .select()
        .from(photos)
        .where(done.length ? and(isNull(photos.deletedAt), notInArray(photos.id, done)) : isNull(photos.deletedAt))
        .limit(limit)
        .all();
      for (const p of pending) {
        try {
          const chunks: Buffer[] = [];
          for await (const c of this.store.open(p.previewSha)) chunks.push(c as Buffer);
          const v = await emb.image(Buffer.concat(chunks));
          this.db.insert(photoEmbeddings).values({ photoId: p.id, model: emb.name, vector: Buffer.from(v.buffer, v.byteOffset, v.byteLength), createdAt: new Date().toISOString() }).onConflictDoNothing().run();
          n += 1;
        } catch (err) {
          this.logger.warn({ err, photo: p.id }, "could not embed a photo");
        }
      }
    } finally {
      this.running = false;
    }
    return n;
  }

  async search(reader: Person, query: string, limit = 60): Promise<{ results: (Photo & { score: number })[]; indexed: number; total: number }> {
    const emb = await this.getEmbedder();
    const visible = this.db
      .select({ p: photos, name: files.name })
      .from(photos)
      .innerJoin(files, eq(files.id, photos.fileId))
      .where(and(eq(photos.householdId, reader.householdId), isNull(photos.deletedAt)))
      .all()
      .filter((r) => this.household.canRead(reader, r.p.namespace as Namespace, r.p.ownerId));
    if (!emb) return { results: [], indexed: 0, total: visible.length };
    const q = await emb.text(query);
    const rows = this.db.select().from(photoEmbeddings).where(eq(photoEmbeddings.model, emb.name)).all();
    const byId = new Map(rows.map((r) => [r.photoId, r.vector]));
    const scored: (Photo & { score: number })[] = [];
    for (const r of visible) {
      const buf = byId.get(r.p.id);
      if (!buf) continue;
      const v = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      scored.push({ ...toPhoto(r.p, r.name), score: cosine(q, v) });
    }
    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, limit), indexed: byId.size, total: visible.length };
  }
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function toPhoto(row: typeof photos.$inferSelect, name: string): Photo {
  return { id: row.id, fileId: row.fileId, ownerId: row.ownerId, namespace: row.namespace as Namespace, name, takenAt: row.takenAt, width: row.width, height: row.height, camera: row.camera, place: row.lat !== null && row.lon !== null ? { lat: row.lat, lon: row.lon } : null };
}

/** CLIP through transformers.js with the ONNX runtime, loaded from the model store only (never the network). */
export async function loadClip(modelDir: string): Promise<Embedder> {
  const tjs = await import("@huggingface/transformers");
  tjs.env.allowRemoteModels = false;
  tjs.env.allowLocalModels = true;
  // modelDir is <models>/<org>/<repo>; transformers.js resolves "<org>/<repo>" under localModelPath.
  const parts = modelDir.split("/");
  const repo = parts.slice(-2).join("/");
  tjs.env.localModelPath = parts.slice(0, -2).join("/");
  const [tokenizer, processor, text, vision] = await Promise.all([
    tjs.AutoTokenizer.from_pretrained(repo),
    tjs.AutoProcessor.from_pretrained(repo, {}),
    tjs.CLIPTextModelWithProjection.from_pretrained(repo, { dtype: "q8" }),
    tjs.CLIPVisionModelWithProjection.from_pretrained(repo, { dtype: "q8" }),
  ]);
  const norm = (t: { data: Float32Array | number[] }) => {
    const v = Float32Array.from(t.data as ArrayLike<number>);
    let n = 0;
    for (const x of v) n += x * x;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < v.length; i += 1) v[i] = v[i]! / n;
    return v;
  };
  return {
    name: "clip-vit-base-patch32-q8",
    image: async (bytes) => {
      const img = await tjs.RawImage.fromBlob(new Blob([new Uint8Array(bytes)]));
      const inputs = (await processor(img)) as Record<string, unknown>;
      const out = (await vision(inputs)) as { image_embeds: { data: Float32Array } };
      return norm(out.image_embeds);
    },
    text: async (query) => {
      const inputs = tokenizer([query], { padding: true, truncation: true });
      const out = (await text(inputs)) as { text_embeds: { data: Float32Array } };
      return norm(out.text_embeds);
    },
  };
}
