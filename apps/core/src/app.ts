import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { join } from "node:path";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyError } from "fastify";
import { zodSerializerCompiler, zodValidatorCompiler, type ZodTypeProvider } from "./zod.ts";
import type { Hardware } from "@woven/hal";
import type { Config } from "./config.ts";
import type { Logger } from "./logger.ts";
import type { Data } from "./data.ts";
import { ledgerRoutes } from "./routes/ledger.ts";
import { eventRoutes } from "./routes/events.ts";
import { householdRoutes } from "./routes/household.ts";
import { authRoutes } from "./routes/auth.ts";
import { attachSession } from "./auth/guard.ts";
import { registerLimits } from "./auth/limits.ts";
import { CORE_HOUSEHOLD_ID } from "./data.ts";
import { HouseholdError } from "./household.ts";
import { PasskeyError } from "./auth/passkeys.ts";
import { ActionError } from "./actions/engine.ts";
import { DeviceError } from "./home/adapter.ts";
import { GateError } from "./gate/client.ts";
import { actionRoutes } from "./routes/actions.ts";
import { homeRoutes } from "./routes/home.ts";
import { gateRoutes } from "./routes/gate.ts";
import { fileRoutes } from "./routes/files.ts";
import { photoRoutes } from "./routes/photos.ts";
import { modelRoutes } from "./routes/models.ts";
import { mediaRoutes } from "./routes/media.ts";
import { networkRoutes } from "./routes/network.ts";
import { routineRoutes } from "./routes/routines.ts";
import { memoryRoutes } from "./routes/memory.ts";
import { FileError } from "./files.ts";
import type { Services } from "./services.ts";
import type { TlsMaterial } from "./tls.ts";
import { healthRoutes } from "./routes/health.ts";
import { systemRoutes } from "./routes/system.ts";
import { askRoutes } from "./routes/ask.ts";
import { shareRoutes } from "./routes/shares.ts";
import { remoteRoutes } from "./routes/remote.ts";
import type { RelayClient } from "./remote/client.ts";

export type AppDeps = {
  config: Config;
  logger: Logger;
  hardware: Hardware;
  data: Data;
  services: Services;
  /** Present when serving HTTPS; the app also exposes it on /v1/system/config. */
  tls?: TlsMaterial;
  version: string;
  startedAt: Date;
  /** Where the process log is, for diagnostics bundles. */
  logFile?: string;
  /** Ask the supervisor for a fresh process (exit code 75). Absent in tests. */
  restart?: () => void;
  /** The relay connection when remote access is on; the remote routes read its status. */
  relay?: RelayClient;
};

/**
 * Build the Fastify app without starting it, so tests can inject requests
 * and the server can own lifecycle.
 */
export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    ...(deps.tls ? { https: { key: deps.tls.server.keyPem, cert: deps.tls.server.certPem } } : {}),
    loggerInstance: deps.logger,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    trustProxy: false,
    bodyLimit: 1024 * 1024, // 1 MiB; uploads use the store's chunked path, not JSON bodies
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  await app.register(sensible);
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });
  await app.register(cookie);
  await registerLimits(app, (route, key) => {
    deps.services.metrics.bump("throttled");
    deps.data.ledger.append({ type: "action.declined", householdId: deps.services.household.household()?.id ?? CORE_HOUSEHOLD_ID, actor: { kind: "core", id: "core" }, where: "policy", target: route, sensitivity: "low", payload: { reason: "too many attempts", from: key.split("|")[0] } });
  });
  await app.register(cors, {
    origin: deps.config.origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["content-type", "x-woven-device", "range"],
    exposedHeaders: ["x-woven-device-secret", "content-range", "accept-ranges", "content-disposition"],
  });

  app.decorate("deps", deps);
  app.decorateRequest("session", null);
  app.addHook("onRequest", attachSession);
  // Metrics by route pattern and status class only; never the path a person asked for.
  app.addHook("onResponse", async (req, reply) => {
    const route = req.routeOptions.url ?? "(none)";
    deps.services.metrics.request(req.method, route, reply.statusCode, reply.elapsedTime);
  });

  // Every response says who answered, and nothing about the machine leaks in headers.
  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-woven-core", deps.version);
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.removeHeader("x-powered-by");
  });

  // The dashboard and site, served by the box itself: one process, one address (WOVEN_SITE).
  const site = deps.config.siteDir;
  if (site) {
    await app.register(fastifyStatic, { root: site, prefix: "/", wildcard: false, index: ["index.html"], extensions: ["html"], cacheControl: true, maxAge: "1h", immutable: false });
  }

  app.setNotFoundHandler((req, reply) => {
    if (site && req.method === "GET" && !req.url.startsWith("/v1/") && (req.headers.accept ?? "").includes("text/html")) {
      // The export writes "dashboard.html" next to a "dashboard/" folder; a directory hit does not try the file, so we do.
      const path = req.url.split("?")[0]!.replace(/\/+$/, "").replace(/\.\./g, "");
      const page = [`${path}.html`, `${path}/index.html`].map((f) => join(site, f)).find((f) => f.startsWith(site) && existsSync(f));
      if (page) return reply.type("text/html; charset=utf-8").sendFile(page.slice(site.length + 1));
      // A page the export did not pre-render (a deep link with a query, a typo): the site's own not-found page.
      const lost = ["404.html", "index.html"].map((f) => join(site, f)).find((f) => existsSync(f));
      if (lost) return reply.status(404).type("text/html; charset=utf-8").sendFile(lost.slice(site.length + 1));
    }
    void reply.status(404).send({ error: "Nothing at this address on the box.", requestId: req.id });
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof HouseholdError || err instanceof PasskeyError || err instanceof ActionError || err instanceof DeviceError || err instanceof GateError || err instanceof FileError) {
      void reply.status(err.status).send({ error: err.message, requestId: req.id });
      return;
    }
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, "request failed");
    void reply.status(status).send({
      error: status >= 500 ? "Something on the box failed. It has been logged." : err.message,
      requestId: req.id,
    });
  });

  await app.register(healthRoutes, { prefix: "/v1" });
  await app.register(systemRoutes, { prefix: "/v1" });
  await app.register(askRoutes, { prefix: "/v1" });
  await app.register(shareRoutes, { prefix: "/v1" });
  await app.register(remoteRoutes, { prefix: "/v1" });
  await app.register(ledgerRoutes, { prefix: "/v1" });
  await app.register(eventRoutes, { prefix: "/v1" });
  await app.register(householdRoutes, { prefix: "/v1" });
  await app.register(authRoutes, { prefix: "/v1" });
  await app.register(actionRoutes, { prefix: "/v1" });
  await app.register(homeRoutes, { prefix: "/v1" });
  await app.register(gateRoutes, { prefix: "/v1" });
  await app.register(fileRoutes, { prefix: "/v1" });
  await app.register(photoRoutes, { prefix: "/v1" });
  await app.register(modelRoutes, { prefix: "/v1" });
  await app.register(mediaRoutes, { prefix: "/v1" });
  await app.register(networkRoutes, { prefix: "/v1" });
  await app.register(routineRoutes, { prefix: "/v1" });
  await app.register(memoryRoutes, { prefix: "/v1" });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }
}
