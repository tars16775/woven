import { GateStatus } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import type { ZodTypeProvider } from "../zod.ts";

/** The Gate as the dashboard sees it. Opening and closing are actions (gate.set), so they leave receipts. */
export const gateRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get("/gate", { schema: { response: { 200: GateStatus } } }, async () => services.gate.status());

  app.post(
    "/gate",
    { preHandler: requireSession, schema: { body: z.object({ open: z.boolean() }), response: { 200: GateStatus } } },
    async (req) => {
      const p = req.session!.person;
      if (p.role !== "owner" && p.role !== "adult") throw Object.assign(new Error("Only an adult can open or close the Gate."), { statusCode: 403 });
      const record = await services.actions.run(p.householdId, { kind: "person", id: p.id, role: p.role }, { capability: "gate.set", target: "gate", parameters: { open: req.body.open } });
      if (record.status !== "succeeded") throw Object.assign(new Error(record.error ?? record.decision.reason), { statusCode: 409 });
      return services.gate.status();
    },
  );
};
