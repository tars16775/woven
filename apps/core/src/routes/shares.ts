import { SearchResult, Share, Ulid } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import { limits } from "../auth/limits.ts";
import { MAX_SHARE_HOURS } from "../shares.ts";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * Share links (gap 19) and search (gap 18). The two public routes, under
 * /s, are the only ones on the box that answer without a session: they hand
 * out one file per live link and nothing else, and they are rate limited.
 */
export const shareRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get(
    "/search",
    { preHandler: requireSession, schema: { querystring: z.object({ q: z.string().trim().min(1).max(200), limit: z.coerce.number().int().min(1).max(100).default(20) }), response: { 200: z.object({ results: z.array(SearchResult) }) } } },
    async (req) => ({ results: services.search.search(req.session!.person, req.query.q, req.query.limit) }),
  );

  app.post(
    "/files/:id/shares",
    {
      preHandler: requireSession,
      schema: {
        params: z.object({ id: Ulid }),
        body: z.object({ expiresInHours: z.number().int().min(1).max(MAX_SHARE_HOURS).default(24 * 7), maxDownloads: z.number().int().min(1).max(1000).nullable().default(null) }),
        response: { 201: z.object({ share: Share, token: z.string() }) },
      },
    },
    async (req, reply) => reply.status(201).send(services.shares.create(req.session!.person, req.params.id, req.body)),
  );

  app.get("/files/shares", { preHandler: requireSession, schema: { response: { 200: z.object({ shares: z.array(Share) }) } } }, async (req) => ({ shares: services.shares.list(req.session!.person) }));

  app.delete("/files/shares/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: Share } } }, async (req) => services.shares.revoke(req.session!.person, req.params.id));

  /* Public: one file per live link. */
  const Token = z.object({ token: z.string().min(32).max(64) });

  app.get("/s/:token/info", { ...limits.share, schema: { params: Token, response: { 200: z.object({ name: z.string(), size: z.number().int(), mime: z.string().nullable(), expiresAt: z.iso.datetime() }), 404: z.object({ error: z.string(), requestId: z.string() }) } } }, async (req, reply) => {
    const found = services.shares.resolve(req.params.token);
    if (!found) return reply.status(404).send({ error: "That link is not live.", requestId: req.id });
    return { name: found.file.name, size: found.file.size, mime: found.file.mime, expiresAt: found.share.expiresAt };
  });

  app.get("/s/:token", { ...limits.share, schema: { params: Token, querystring: z.object({ download: z.string().optional() }) } }, async (req, reply) => {
    const found = services.shares.resolve(req.params.token);
    if (!found) return reply.status(404).send({ error: "That link is not live.", requestId: req.id });
    const { file, share } = found;
    services.shares.used(share.id);
    const disposition = req.query.download === "false" ? "inline" : "attachment";
    void reply
      .type(file.mime ?? "application/octet-stream")
      .header("accept-ranges", "bytes")
      .header("content-disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      .header("cache-control", "private, no-store")
      .header("x-robots-tag", "noindex");
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
    if (range && file.size > 0) {
      let start = range[1] ? Number(range[1]) : NaN;
      let end = range[2] ? Number(range[2]) : NaN;
      if (Number.isNaN(start)) {
        start = Math.max(0, file.size - end);
        end = file.size - 1;
      } else if (Number.isNaN(end) || end >= file.size) end = file.size - 1;
      if (start > end || start >= file.size) return reply.status(416).header("content-range", `bytes */${file.size}`).send();
      return reply.status(206).header("content-range", `bytes ${start}-${end}/${file.size}`).header("content-length", String(end - start + 1)).send(app.deps.data.store.open(file.sha256, { start, end }));
    }
    return reply.header("content-length", String(file.size)).send(app.deps.data.store.open(file.sha256));
  });
};
