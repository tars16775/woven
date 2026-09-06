import { RemoteDevice, RemotePairing, RemoteStatus } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireRole, requireSession } from "../auth/guard.ts";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * Remote access (gap 21): status, pairing and the list of paired devices.
 * Pairing only ever happens at home, on the home network: a request that
 * arrived through the relay cannot pair, so a stolen remote session cannot
 * mint more.
 */
const Problem = z.object({ error: z.string(), requestId: z.string() });

export const remoteRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services, config } = app.deps;

  app.get("/remote/status", { preHandler: requireSession, schema: { response: { 200: RemoteStatus } } }, async () => {
    const relay = app.deps.relay?.status();
    return {
      enabled: !!config.relay,
      relay: relay?.relay ?? config.relay,
      coreId: relay?.coreId ?? null,
      connected: relay?.connected ?? false,
      since: relay?.since ?? null,
      lastError: relay?.lastError ?? null,
      devices: services.remoteDevices.count(),
    };
  });

  app.post(
    "/remote/pair",
    { preHandler: requireRole("owner", "adult"), schema: { body: z.object({ label: z.string().trim().min(1).max(80) }), response: { 201: RemotePairing, 403: Problem, 409: Problem } } },
    async (req, reply) => {
      if (req.headers["x-woven-via"] === "relay") return reply.status(403).send({ error: "Pair at home, on the home network. A device that is already away cannot add another.", requestId: req.id });
      if (!config.relay) return reply.status(409).send({ error: "Remote access is off on this Core. Set WOVEN_RELAY and restart it.", requestId: req.id });
      const relay = app.deps.relay?.status();
      const paired = services.remoteDevices.pair(req.session!.person, req.body.label);
      return reply.status(201).send({ deviceId: paired.device.id, key: paired.key, token: paired.token, relay: config.relay, coreId: relay?.coreId ?? "", expiresAt: paired.expiresAt, household: services.household.household()?.name ?? "" });
    },
  );

  app.get("/remote/devices", { preHandler: requireSession, schema: { response: { 200: z.object({ devices: z.array(RemoteDevice) }) } } }, async (req) => ({ devices: services.remoteDevices.list(req.session!.person) }));

  app.delete("/remote/devices/:id", { preHandler: requireSession, schema: { params: z.object({ id: z.string() }), response: { 200: RemoteDevice } } }, async (req) => services.remoteDevices.revoke(req.session!.person, req.params.id));
};
