import { MediaItem, Ulid } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import { FileError } from "../files.ts";
import type { ZodTypeProvider } from "../zod.ts";

/** The media library and a stream a browser or the TV can play (phase 22). */
export const mediaRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get("/media", { preHandler: requireSession, schema: { querystring: z.object({ kind: z.enum(["video", "audio"]).optional() }), response: { 200: z.object({ items: z.array(MediaItem), tools: z.object({ ffmpeg: z.boolean(), ffprobe: z.boolean() }) }) } } }, async (req) => ({
    items: services.media.list(req.session!.person, req.query.kind),
    tools: { ffmpeg: !!services.media.tools.ffmpeg, ffprobe: !!services.media.tools.ffprobe },
  }));

  /** Probe files that landed before ffprobe was around, or that a client did not wait for. */
  app.post("/media/index", { preHandler: requireSession, schema: { response: { 200: z.object({ probed: z.number().int() }) } } }, async (req) => {
    const p = req.session!.person;
    let n = 0;
    for (const ns of services.household.namespacesFor(p.role)) {
      const walk = async (path: string): Promise<void> => {
        const l = services.files.list(p, ns, path);
        for (const f of l.files) if (await services.media.probe(f.id)) n += 1;
        for (const d of l.folders) await walk(d.path);
      };
      await walk("/");
    }
    return { probed: n };
  });

  /**
   * The bytes a player asks for: the original with byte ranges when a browser
   * plays it as is, otherwise a fragmented MP4 transcoded on the fly.
   */
  app.get("/media/:id/stream", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }) } }, async (req, reply) => {
    const found = services.media.get(req.session!.person, req.params.id);
    if (!found) throw new FileError(404, "No such media.");
    if (found.item.playable) return reply.redirect(`/v1/files/${found.item.fileId}/content`, 307);
    const t = await services.media.transcode(found.sha256, found.item.kind);
    if (!t) throw new FileError(409, "This file needs transcoding and ffmpeg is not installed on the box.");
    req.raw.on("close", t.stop);
    return reply.type(t.mime).header("cache-control", "no-store").send(t.stream);
  });
};
