import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyError } from "fastify";
import { zodSerializerCompiler, zodValidatorCompiler, type ZodTypeProvider } from "./zod.ts";
import type { Hardware } from "@woven/hal";
import type { Config } from "./config.ts";
import type { Logger } from "./logger.ts";
import type { Data } from "./data.ts";
import { ledgerRoutes } from "./routes/ledger.ts";
import { healthRoutes } from "./routes/health.ts";
import { systemRoutes } from "./routes/system.ts";

export type AppDeps = {
  config: Config;
  logger: Logger;
  hardware: Hardware;
  data: Data;
  version: string;
  startedAt: Date;
};

/**
 * Build the Fastify app without starting it, so tests can inject requests
 * and the server can own lifecycle.
 */
export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    loggerInstance: deps.logger,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    trustProxy: false,
    bodyLimit: 1024 * 1024, // 1 MiB; uploads use the store's chunked path, not JSON bodies
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  await app.register(sensible);
  await app.register(cors, {
    origin: deps.config.origins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  });

  app.decorate("deps", deps);

  // Every response says who answered, and nothing about the machine leaks in headers.
  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-woven-core", deps.version);
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.removeHeader("x-powered-by");
  });

  app.setNotFoundHandler((req, reply) => {
    void reply.status(404).send({ error: "Nothing at this address on the box.", requestId: req.id });
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, "request failed");
    void reply.status(status).send({
      error: status >= 500 ? "Something on the box failed. It has been logged." : err.message,
      requestId: req.id,
    });
  });

  await app.register(healthRoutes, { prefix: "/v1" });
  await app.register(systemRoutes, { prefix: "/v1" });
  await app.register(ledgerRoutes, { prefix: "/v1" });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }
}
