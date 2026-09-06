import { ActionRecord, ActionStatus, ApproveRequest, Capability, PrepareRequest, Ulid } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import { publicCapabilities } from "../actions/capabilities.ts";
import { ActionError } from "../actions/engine.ts";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * Prepare, approve, decline, execute (phases 12 to 14). The signed-in person
 * is the actor; agents get their own credentials in track H.
 */
export const actionRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;
  const who = (req: { session: { person: { id: string; role: "owner" | "adult" | "child" | "guest"; householdId: string } } | null }) => {
    const p = req.session!.person;
    return { actor: { kind: "person" as const, id: p.id, role: p.role }, householdId: p.householdId };
  };

  app.get("/capabilities", { schema: { response: { 200: z.object({ capabilities: z.array(Capability) }) } } }, async () => ({ capabilities: publicCapabilities() }));

  app.get(
    "/actions",
    { preHandler: requireSession, schema: { querystring: z.object({ status: ActionStatus.optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }), response: { 200: z.object({ actions: z.array(ActionRecord) }) } } },
    async (req) => ({ actions: services.actions.list(who(req).householdId, req.query.status, req.query.limit) }),
  );

  app.get("/actions/:id", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: ActionRecord } } }, async (req) => {
    const a = services.actions.get(req.params.id);
    if (!a || a.householdId !== who(req).householdId) throw new ActionError(404, "No such action.");
    return a;
  });

  app.post("/actions/prepare", { preHandler: requireSession, schema: { body: PrepareRequest, response: { 201: ActionRecord } } }, async (req, reply) => {
    const { actor, householdId } = who(req);
    return reply.status(201).send(services.actions.prepare(householdId, actor, req.body));
  });

  /** Prepare and, when the policy allows it outright, execute in one call: the dashboard's one-tap actions. */
  app.post("/actions/run", { preHandler: requireSession, schema: { body: PrepareRequest, response: { 200: ActionRecord } } }, async (req) => {
    const { actor, householdId } = who(req);
    return services.actions.run(householdId, actor, req.body);
  });

  app.post("/actions/:id/approve", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), body: ApproveRequest.default({}), response: { 200: ActionRecord } } }, async (req) => {
    const s = req.session!;
    return services.actions.approve(req.params.id, { ...s.person, sessionMethod: s.method }, req.body.assertion);
  });

  app.post("/actions/:id/decline", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: ActionRecord } } }, async (req) =>
    services.actions.decline(req.params.id, req.session!.person),
  );

  app.post("/actions/:id/execute", { preHandler: requireSession, schema: { params: z.object({ id: Ulid }), response: { 200: ActionRecord } } }, async (req) => {
    const { actor } = who(req);
    return services.actions.execute(req.params.id, actor);
  });
};
