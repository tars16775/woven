import { FileEntry, FileListing, FilesSummary, Namespace, StartUpload, Ulid, UploadSession } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import { FileError } from "../files.ts";
import type { ZodTypeProvider } from "../zod.ts";

const MAX_CHUNK = 4 * 1024 * 1024 + 1024;

/** Browse, upload, download, move, share (phases 18 and 19). Every route needs a session; namespace rules are the service's. */
export const fileRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services, hardware } = app.deps;

  // Chunk bodies are raw bytes, larger than the JSON limit, streamed straight to disk.
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: MAX_CHUNK }, (_req, body, done) => done(null, body));

  app.get(
    "/files",
    { preHandler: requireSession, schema: { querystring: z.object({ namespace: Namespace.default("personal"), path: z.string().default("/") }), response: { 200: FileListing } } },
    async (req) => services.files.list(req.session!.person, req.query.namespace, req.query.path),
  );

  app.get("/files/summary", { preHandler: requireSession, schema: { response: { 200: FilesSummary } } }, async (req) => {
    const m = await hardware.metrics();
    return services.files.summary(req.session!.person, { usedBytes: m.diskUsedBytes, totalBytes: m.diskTotalBytes });
  });

  app.get("/files/have/:sha256", { preHandler: requireSession, schema: { params: z.object({ sha256: z.string().length(64) }), response: { 200: z.object({ have: z.boolean() }) } } }, async (req) => ({
    have: await services.files.has(req.params.sha256),
  }));

  app.get("/files/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: FileEntry } } }, async (req) => {
    const { entry } = services.files.open(req.session!.person, req.params.id);
    return entry;
  });

  app.get("/files/:id/content", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), querystring: z.object({ download: z.coerce.boolean().default(false) }) } }, async (req, reply) => {
    const { entry } = services.files.open(req.session!.person, req.params.id);
    const disposition = req.query.download ? "attachment" : "inline";
    void reply
      .type(entry.mime ?? "application/octet-stream")
      .header("accept-ranges", "bytes")
      .header("content-disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(entry.name)}`)
      .header("cache-control", "private, max-age=31536000, immutable");
    // Byte ranges so video and audio players can seek (phase 22).
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
    if (range && entry.size > 0) {
      let start = range[1] ? Number(range[1]) : NaN;
      let end = range[2] ? Number(range[2]) : NaN;
      if (Number.isNaN(start)) {
        start = Math.max(0, entry.size - end);
        end = entry.size - 1;
      } else if (Number.isNaN(end) || end >= entry.size) end = entry.size - 1;
      if (start > end || start >= entry.size) return reply.status(416).header("content-range", `bytes */${entry.size}`).send();
      return reply
        .status(206)
        .header("content-range", `bytes ${start}-${end}/${entry.size}`)
        .header("content-length", String(end - start + 1))
        .send(app.deps.data.store.open(entry.sha256, { start, end }));
    }
    return reply.header("content-length", String(entry.size)).send(app.deps.data.store.open(entry.sha256));
  });

  app.post(
    "/files/:id/move",
    { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), body: z.object({ path: z.string().optional(), name: z.string().trim().min(1).max(255).optional(), namespace: Namespace.optional() }), response: { 200: FileEntry } } },
    async (req) => services.files.move(req.session!.person, req.params.id, req.body),
  );

  app.delete("/files/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: z.object({ removed: z.literal(true) }) } } }, async (req) => {
    await services.files.remove(req.session!.person, req.params.id);
    return { removed: true as const };
  });

  /* Uploads */
  app.post("/files/uploads", { preHandler: requireSession, schema: { body: StartUpload, response: { 201: UploadSession } } }, async (req, reply) =>
    reply.status(201).send(await services.files.startUpload(req.session!.person, req.body)),
  );
  app.get("/files/uploads/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: UploadSession } } }, async (req) => services.files.status(req.session!.person, req.params.id));
  app.put(
    "/files/uploads/:id/chunks/:index",
    { preHandler: requireSession, schema: { params: z.object({ id: Ulid, index: z.coerce.number().int().min(0) }), response: { 200: UploadSession } } },
    async (req) => {
      const body = req.body;
      if (!Buffer.isBuffer(body)) throw new FileError(400, "Send the chunk as application/octet-stream.");
      const { Readable } = await import("node:stream");
      return services.files.putChunk(req.session!.person, req.params.id, req.params.index, Readable.from([body]));
    },
  );
  app.post("/files/uploads/:id/complete", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 201: FileEntry } } }, async (req, reply) =>
    reply.status(201).send(await services.files.completeUpload(req.session!.person, req.params.id)),
  );
};
