import { Memory, MemorySettings, NewMemory, Ulid } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import { QueryBool, type ZodTypeProvider } from "../zod.ts";

/** A person's memory, theirs alone (phase 36). */
export const memoryRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get("/memory", { preHandler: requireSession, schema: { querystring: z.object({ candidates: QueryBool(true) }), response: { 200: z.object({ memories: z.array(Memory), settings: MemorySettings }) } } }, async (req) => ({
    memories: services.memory.list(req.session!.person, { includeCandidates: req.query.candidates }),
    settings: services.memory.settingsFor(req.session!.person),
  }));
  app.post("/memory", { preHandler: requireSession, schema: { body: NewMemory, response: { 201: Memory } } }, async (req, reply) => reply.status(201).send(services.memory.remember(req.session!.person, req.body)));
  app.post("/memory/:id/confirm", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: Memory } } }, async (req) => services.memory.confirm(req.session!.person, req.params.id));
  app.patch("/memory/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), body: z.object({ text: z.string().trim().min(1).max(500) }), response: { 200: Memory } } }, async (req) => services.memory.edit(req.session!.person, req.params.id, req.body.text));
  app.delete("/memory/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: z.object({ forgotten: z.literal(true) }) } } }, async (req) => {
    services.memory.forget(req.session!.person, req.params.id);
    return { forgotten: true as const };
  });
  app.delete("/memory", { preHandler: requireSession, schema: { response: { 200: z.object({ forgotten: z.number().int() }) } } }, async (req) => ({ forgotten: services.memory.forgetAll(req.session!.person) }));
  app.put("/memory/settings", { preHandler: requireSession, schema: { body: MemorySettings, response: { 200: MemorySettings } } }, async (req) => services.memory.setSettings(req.session!.person, req.body));
};
