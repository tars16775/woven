import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "../zod.ts";
import { z } from "zod";

/** Liveness. Cheap, unauthenticated, says nothing about the household. */
export const healthRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: z.object({
            ok: z.literal(true),
            version: z.string(),
            uptimeSeconds: z.number().nonnegative(),
          }),
        },
      },
    },
    async () => ({
      ok: true as const,
      version: app.deps.version,
      uptimeSeconds: Math.round((Date.now() - app.deps.startedAt.getTime()) / 1000),
    }),
  );
};
