"use client";

import { ActionRecord, FileEntry, FileListing, FilesSummary, MediaItem, Photo, PhotoStats, PhotoTimeline, type Namespace } from "@woven/schema";
import { z } from "zod";
import { CoreError } from "./client";
import { NoCoreError } from "./identity";
import { coreClient } from "./store";

function base(): string {
  const c = coreClient();
  if (!c) throw new NoCoreError();
  return c.base;
}
async function call<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, { ...init, credentials: "include", cache: "no-store", headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) } });
  if (!res.ok) {
    let message = "";
    try {
      message = ((await res.json()) as { error?: string }).error ?? "";
    } catch {}
    throw new CoreError(res.status, message);
  }
  return schema.parse(await res.json());
}
const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

async function sha256Of(file: Blob): Promise<string | undefined> {
  if (file.size > 256 * 1024 * 1024 || !globalThis.crypto?.subtle) return undefined; // hashing a huge file in the tab is not worth the wait; the box hashes anyway
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const files = {
  list: (namespace: Namespace, path: string) => call(`/v1/files?namespace=${namespace}&path=${encodeURIComponent(path)}`, FileListing),
  summary: () => call("/v1/files/summary", FilesSummary),
  move: (id: string, to: { path?: string; name?: string; namespace?: Namespace }) => call(`/v1/files/${id}/move`, FileEntry, post(to)),
  remove: (id: string) => call(`/v1/files/${id}`, z.object({ removed: z.literal(true) }), { method: "DELETE" }),
  /** The address the browser can open or save; the session cookie goes along. */
  contentUrl: (id: string, download = false) => `${base()}/v1/files/${id}/content${download ? "?download=true" : ""}`,

  /**
   * Chunked, resumable upload: hash first so the box can say "already have
   * it", then send only the chunks it has not received.
   */
  async upload(file: File, opts: { namespace: Namespace; path: string; onProgress?: (sent: number, total: number) => void }): Promise<FileEntry> {
    const sha256 = await sha256Of(file);
    const session = await call("/v1/files/uploads", z.object({ id: z.string(), chunkSize: z.number(), chunks: z.number(), received: z.array(z.number()), alreadyStored: z.boolean() }), post({ name: file.name, path: opts.path, namespace: opts.namespace, size: file.size, mime: file.type || undefined, sha256, source: "dashboard" }));
    if (!session.alreadyStored) {
      const have = new Set(session.received);
      for (let i = 0; i < session.chunks; i += 1) {
        if (have.has(i)) continue;
        const chunk = file.slice(i * session.chunkSize, Math.min(file.size, (i + 1) * session.chunkSize));
        const res = await fetch(`${base()}/v1/files/uploads/${session.id}/chunks/${i}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/octet-stream" }, body: chunk });
        if (!res.ok) throw new CoreError(res.status, `Chunk ${i + 1} of ${session.chunks} failed.`);
        opts.onProgress?.(Math.min(file.size, (i + 1) * session.chunkSize), file.size);
      }
    }
    opts.onProgress?.(file.size, file.size);
    return call(`/v1/files/uploads/${session.id}/complete`, FileEntry, post({}));
  },
};

export const photos = {
  timeline: (cursor?: string | null) => call(`/v1/photos${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, PhotoTimeline),
  stats: () => call("/v1/photos/stats", PhotoStats),
  thumbUrl: (id: string) => `${base()}/v1/photos/${id}/thumb`,
  previewUrl: (id: string) => `${base()}/v1/photos/${id}/preview`,
  importFolder: (folder: string) => call("/v1/photos/import", z.object({ files: z.number(), photos: z.number() }), post({ folder })),
  indexAll: () => call("/v1/photos/index", z.object({ indexed: z.number() }), post({})),
  search: (q: string) => call(`/v1/photos/search?q=${encodeURIComponent(q)}`, z.object({ ready: z.boolean(), results: z.array(Photo.extend({ score: z.number() })), indexed: z.number(), total: z.number() })),
};

const ModelView = z.object({ name: z.string(), title: z.string(), purpose: z.string(), approxBytes: z.number(), installed: z.boolean(), bytes: z.number(), installedAt: z.string().nullable() });
export type ModelView = z.infer<typeof ModelView>;
export const models = {
  list: () => call("/v1/models", z.object({ models: z.array(ModelView) })).then((r) => r.models),
  /** Prepares the download as an action; the owner approves it (Waiting for a yes) and the box fetches it through the Gate. */
  install: (name: string) => call(`/v1/models/${name}/install`, ActionRecord, post({})),
};

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n < 1e12) return `${(n / 1e9).toFixed(1)} GB`;
  return `${(n / 1e12).toFixed(2)} TB`;
}

export type { FileEntry, FileListing, FilesSummary, Photo, PhotoStats };

export const media = {
  list: (kind?: "video" | "audio") => call(`/v1/media${kind ? `?kind=${kind}` : ""}`, z.object({ items: z.array(MediaItem), tools: z.object({ ffmpeg: z.boolean(), ffprobe: z.boolean() }) })),
  index: () => call("/v1/media/index", z.object({ probed: z.number() }), post({})),
  /** What a <video> or <audio> element plays; the box redirects to the original or transcodes. */
  streamUrl: (fileId: string) => `${base()}/v1/media/${fileId}/stream`,
};

export type { MediaItem };

