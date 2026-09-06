import { HomeDevice, HomeState } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import { CORE_HOUSEHOLD_ID } from "../data.ts";
import { DeviceError } from "../home/adapter.ts";
import type { ZodTypeProvider } from "../zod.ts";

/** Rooms, devices and presence from whichever adapter owns them. Changes go through /v1/actions. */
export const homeRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services } = app.deps;

  app.get("/home", { preHandler: requireSession, schema: { response: { 200: HomeState } } }, async () => ({
    adapter: services.home.name,
    rooms: services.home.rooms(),
    devices: services.home.devices(),
    presence: services.presence.get(),
  }));

  app.get("/home/devices/:id", { preHandler: requireSession, schema: { params: z.object({ id: z.string() }), response: { 200: HomeDevice } } }, async (req) => {
    const d = services.home.device(req.params.id);
    if (!d) throw new DeviceError(404, "No such device.");
    return d;
  });

  /** "I'm home" / "Everyone's out" from the dashboard, until phones report it. Recorded, because class D leans on it. */
  app.post(
    "/home/presence",
    { preHandler: requireSession, schema: { body: z.object({ adultsHome: z.boolean() }), response: { 200: HomeState.shape.presence } } },
    async (req) => {
      const p = req.session!.person;
      if (p.role !== "owner" && p.role !== "adult") throw Object.assign(new Error("Only an adult can set presence."), { statusCode: 403 });
      services.presence.set(req.body.adultsHome, `${p.name} from the dashboard`);
      app.deps.data.ledger.append({
        type: "action.executed",
        householdId: p.householdId || CORE_HOUSEHOLD_ID,
        actor: { kind: "person", id: p.id },
        where: "inside",
        target: "presence",
        sensitivity: "low",
        payload: { capability: "presence.set", planned: { adultsHome: req.body.adultsHome }, observed: services.presence.get() },
      });
      return services.presence.get();
    },
  );
};
