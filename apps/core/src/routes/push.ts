import { PushSubscriptionView } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import type { ZodTypeProvider } from "../zod.ts";

const Subscription = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(80).max(120), auth: z.string().min(16).max(40) }),
  label: z.string().trim().max(80).optional(),
});

/** Notifications (gap 17): the VAPID public key, this person's subscriptions, and a test send. */
export const pushRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get("/push/vapid", { preHandler: requireSession, schema: { response: { 200: z.object({ publicKey: z.string() }) } } }, async () => ({ publicKey: (await services.push.keys()).publicKey }));

  app.post("/push/subscriptions", { preHandler: requireSession, schema: { body: Subscription, response: { 201: PushSubscriptionView } } }, async (req, reply) =>
    reply.status(201).send(services.push.subscribe(req.session!.person, { endpoint: req.body.endpoint, keys: req.body.keys }, req.body.label ?? null)),
  );

  app.get("/push/subscriptions", { preHandler: requireSession, schema: { response: { 200: z.object({ subscriptions: z.array(PushSubscriptionView) }) } } }, async (req) => ({ subscriptions: services.push.list(req.session!.person) }));

  app.delete("/push/subscriptions/:id", { preHandler: requireSession, schema: { params: z.object({ id: z.string() }), response: { 200: z.object({ removed: z.boolean() }) } } }, async (req) => ({
    removed: services.push.unsubscribe(req.session!.person, req.params.id),
  }));

  app.post("/push/test", { preHandler: requireSession, schema: { response: { 200: z.object({ sent: z.number().int(), failed: z.number().int(), dropped: z.number().int(), skipped: z.string().nullable() }) } } }, async (req) =>
    services.push.send(req.session!.person, { title: "Woven", body: `Notifications reach this device. Sent ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`, url: "/dashboard/settings", tag: "test" }),
  );
};
