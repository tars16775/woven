import { NewRoutine, Routine, RoutineRun, Ulid } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import type { ZodTypeProvider } from "../zod.ts";

/** Routines (phase 27): scenes and schedules, each step an ordinary action with a receipt. */
export const routineRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get("/routines", { preHandler: requireSession, schema: { response: { 200: z.object({ routines: z.array(Routine) }) } } }, async (req) => ({ routines: services.routines.list(req.session!.person.householdId) }));
  app.post("/routines", { preHandler: requireSession, schema: { body: NewRoutine, response: { 201: Routine } } }, async (req, reply) => reply.status(201).send(services.routines.create(req.body, req.session!.person)));
  app.patch("/routines/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), body: NewRoutine.partial(), response: { 200: Routine } } }, async (req) => services.routines.update(req.params.id, req.body, req.session!.person));
  app.delete("/routines/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: z.object({ removed: z.literal(true) }) } } }, async (req) => {
    services.routines.remove(req.params.id, req.session!.person);
    return { removed: true as const };
  });
  app.post("/routines/:id/run", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: RoutineRun } } }, async (req) =>
    services.routines.run(req.params.id, { householdId: req.session!.person.householdId, startedBy: "person", personId: req.session!.person.id }),
  );
  /** Tandem and the app say a phrase; the matching routine runs. */
  app.post("/routines/say", { preHandler: requireSession, schema: { body: z.object({ phrase: z.string().trim().min(1).max(60) }), response: { 200: RoutineRun.nullable() } } }, async (req) => {
    const r = services.routines.byPhrase(req.session!.person.householdId, req.body.phrase);
    return r ? services.routines.run(r.id, { householdId: r.householdId, startedBy: "phrase", personId: req.session!.person.id }) : null;
  });
};
