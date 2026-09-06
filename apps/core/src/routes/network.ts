import { NetworkView } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { requireSession } from "../auth/guard.ts";
import type { ZodTypeProvider } from "../zod.ts";

/** What the box sees of the home network (phase 43). Observed on the Mac; owned on the box. */
export const networkRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  app.get("/network", { preHandler: requireSession, schema: { response: { 200: NetworkView } } }, async () => app.deps.services.network.scan());
};
