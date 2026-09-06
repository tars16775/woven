import type { FastifyReply, FastifyRequest } from "fastify";
import type { ContentStore } from "../store/index.ts";

/**
 * Serve one object from the store with byte ranges (phase 22), shared by the
 * file, media and share-link routes so players can seek and every path
 * behaves the same. The caller has already decided the person may see it.
 */
export function serveObject(store: ContentStore, req: FastifyRequest, reply: FastifyReply, obj: { sha256: string; size: number; mime: string | null; name: string }, opts: { disposition: "inline" | "attachment"; cacheControl: string }) {
  void reply
    .type(obj.mime ?? "application/octet-stream")
    .header("accept-ranges", "bytes")
    .header("content-disposition", `${opts.disposition}; filename*=UTF-8''${encodeURIComponent(obj.name)}`)
    .header("cache-control", opts.cacheControl);
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  if (range && obj.size > 0) {
    let start = range[1] ? Number(range[1]) : NaN;
    let end = range[2] ? Number(range[2]) : NaN;
    if (Number.isNaN(start)) {
      start = Math.max(0, obj.size - end);
      end = obj.size - 1;
    } else if (Number.isNaN(end) || end >= obj.size) end = obj.size - 1;
    if (start > end || start >= obj.size) return reply.status(416).header("content-range", `bytes */${obj.size}`).send();
    return reply
      .status(206)
      .header("content-range", `bytes ${start}-${end}/${obj.size}`)
      .header("content-length", String(end - start + 1))
      .send(store.open(obj.sha256, { start, end }));
  }
  return reply.header("content-length", String(obj.size)).send(store.open(obj.sha256));
}
