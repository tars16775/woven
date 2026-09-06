import { Photo, PhotoStats, PhotoTimeline, Ulid } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import type { ZodTypeProvider } from "../zod.ts";

/** The photo timeline, thumbnails and previews, and import from a folder on the box (phase 20). */
export const photoRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get(
    "/photos",
    { preHandler: requireSession, schema: { querystring: z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(120) }), response: { 200: PhotoTimeline } } },
    async (req) => services.photos.timeline(req.session!.person, req.query.cursor ?? null, req.query.limit),
  );
  app.get("/photos/stats", { preHandler: requireSession, schema: { response: { 200: PhotoStats } } }, async (req) => services.photos.stats(req.session!.person));

  for (const kind of ["thumb", "preview"] as const) {
    app.get(`/photos/:id/${kind}`, { preHandler: requireSession, schema: { params: z.object({ id: Ulid }) } }, async (req, reply) => {
      const { sha256, mime } = services.photos.derived(req.session!.person, req.params.id, kind);
      return reply.type(mime).header("cache-control", "private, max-age=31536000, immutable").send(app.deps.data.store.open(sha256));
    });
  }

  /** Search by what is in the photos (phase 21). Empty results with `ready: false` until the model is on the box. */
  app.get(
    "/photos/search",
    { preHandler: requireSession, schema: { querystring: z.object({ q: z.string().trim().min(1).max(200), limit: z.coerce.number().int().min(1).max(200).default(60) }), response: { 200: z.object({ ready: z.boolean(), results: z.array(Photo.extend({ score: z.number() })), indexed: z.number().int(), total: z.number().int() }) } } },
    async (req) => {
      const ready = await services.photoIndex.ready();
      const r = ready ? await services.photoIndex.search(req.session!.person, req.query.q, req.query.limit) : { results: [], indexed: 0, total: 0 };
      return { ready, ...r };
    },
  );

  /** Index images already uploaded (older files, or a client that did not wait). */
  app.post("/photos/index", { preHandler: requireSession, schema: { response: { 200: z.object({ indexed: z.number().int() }) } } }, async (req) => ({ indexed: await services.photos.indexAll(req.session!.person) }));
  app.post("/photos/index/:fileId", { preHandler: requireSession, schema: { params: z.object({ fileId: Ulid }), response: { 200: Photo.nullable() } } }, async (req) => {
    services.files.get(req.session!.person, req.params.fileId);
    return services.photos.index(req.params.fileId);
  });

  /** A folder on the box, for example an export from another library. Owners and adults only; the path never leaves the machine. */
  app.post(
    "/photos/import",
    { preHandler: requireSession, schema: { body: z.object({ folder: z.string().min(1).max(1024) }), response: { 200: z.object({ files: z.number().int(), photos: z.number().int() }) } } },
    async (req) => {
      const p = req.session!.person;
      if (p.role !== "owner" && p.role !== "adult") throw Object.assign(new Error("Only an adult can import a folder."), { statusCode: 403 });
      return services.photos.importFolder(p, req.body.folder);
    },
  );
};
