import { ActionRecord } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireRole, requireSession } from "../auth/guard.ts";
import { catalogue } from "../models.ts";
import type { ZodTypeProvider } from "../zod.ts";

const ModelView = z.object({ name: z.string(), title: z.string(), purpose: z.string(), approxBytes: z.number().int(), installed: z.boolean(), bytes: z.number().int(), installedAt: z.string().nullable() });

/** What the box can learn to do, and whether it has (phase 21 onward). Installing is an action: it asks first and leaves a receipt. */
export const modelRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get("/models", { preHandler: requireSession, schema: { response: { 200: z.object({ models: z.array(ModelView) }) } } }, async () => ({
    models: await Promise.all(catalogue.map(async (m) => ({ title: m.title, purpose: m.purpose, approxBytes: m.approxBytes, ...(await services.models.state(m.name)) }))),
  }));

  /** Prepare the download as a class C crossing; the owner approves it from the dashboard and it runs. */
  app.post("/models/:name/install", { preHandler: requireRole("owner", "adult"), schema: { params: z.object({ name: z.string() }), response: { 201: ActionRecord } } }, async (req, reply) => {
    const spec = services.models.spec(req.params.name);
    if (!spec) throw Object.assign(new Error("No such model."), { statusCode: 404 });
    const p = req.session!.person;
    const record = services.actions.prepare(p.householdId, { kind: "person", id: p.id, role: p.role }, { capability: "model.install", target: spec.repo, parameters: { model: spec.name, approxBytes: spec.approxBytes }, idempotencyKey: `model-install-${spec.name}-${Date.now()}` });
    return reply.status(201).send(record);
  });

  app.delete("/models/:name", { preHandler: requireRole("owner"), schema: { params: z.object({ name: z.string() }), response: { 200: z.object({ removed: z.literal(true) }) } } }, async (req) => {
    await services.models.remove(req.params.name);
    return { removed: true as const };
  });
};
