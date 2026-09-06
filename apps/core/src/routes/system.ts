import { CoreConfig, CoreStatus } from "@woven/schema";
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
        gate: app.deps.services.gate.cached().state,
        dataRoot: config.dataRoot,
      });
    },
  );

  app.get("/system/config", { schema: { response: { 200: CoreConfig } } }, async () => {
    const { config, version, tls } = app.deps;
    return CoreConfig.parse({
      version,
      name: config.name,
      port: config.port,
      origins: config.origins,
      mdns: config.mdns,
      tls: tls
        ? {
            enabled: true,
            caFingerprint: tls.ca.fingerprint,
            caNotAfter: tls.ca.notAfter,
            serverNotAfter: tls.server.notAfter,
            names: tls.server.dns,
            addresses: tls.server.ips,
            trustUrl: `http://${config.name}:${config.trustPort}`,
          }
        : { enabled: false },
    });
  });
};
