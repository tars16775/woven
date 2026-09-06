import { CoreStatus } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * What the Core page and the Overview card show: identity and live metrics
 * straight from the hardware layer. Authentication arrives in phase 8; until
 * then this is LAN-only by virtue of where the core listens.
 */
export const systemRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  app.get(
    "/system/status",
    { schema: { response: { 200: CoreStatus } } },
    async () => {
      const { hardware, version, startedAt, config } = app.deps;
      const [identity, metrics] = await Promise.all([hardware.identity(), hardware.metrics()]);
      return CoreStatus.parse({
        version,
        startedAt: startedAt.toISOString(),
        hardware: identity,
        metrics,
        // The Gate process arrives in phase 15. Until it runs, say so.
        gate: "absent",
        dataRoot: config.dataRoot,
      });
    },
  );
};
