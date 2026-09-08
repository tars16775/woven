import { CamerasState } from "@woven/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireRole, requireSession } from "../auth/guard.ts";
import { cameraEvents, cameras } from "../db/schema.ts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * Cameras (dashboard design phase 14, backend).
 *
 * The room was designed first and this is built to it, which is why the
 * shapes match `packages/schema` exactly and the client in the dashboard
 * needed no changes.
 *
 * Two decisions worth naming.
 *
 * **`capture` comes from the hardware layer, never from the data.** A Core
 * with an empty camera list might be a box nobody has paired anything to, or
 * a Mac that can never pair anything at all, and those are completely
 * different sentences to show a person. `@woven/hal` is the only thing that
 * knows which, so it is the only thing asked.
 *
 * **Pause is one switch for the household** and it lives in settings.json
 * rather than on each row, so it survives a restart. A pause that forgets
 * itself when the box reboots is not a pause anybody can rely on.
 *
 * Nothing here reaches a vendor cloud. Addresses are LAN addresses, clips are
 * objects in this Core's own store, and detection is the box's own.
 */
export const cameraRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();

  /** Everything the room reads, in one answer. */
  app.get("/cameras", { preHandler: requireSession, schema: { response: { 200: CamerasState } } }, async (req) => {
    const { data, hardware, settings } = app.deps;
    const householdId = req.session!.household.id;
    const capture = hardware.capabilities.capture ? "present" : "absent";
    const pausedAll = settings?.get().camerasPaused ?? false;

    const rows = data.database.db.select().from(cameras).where(eq(cameras.householdId, householdId)).all();
    const events = data.database.db
      .select()
      .from(cameraEvents)
      .where(eq(cameraEvents.householdId, householdId))
      .orderBy(desc(cameraEvents.at))
      .limit(50)
      .all();

    return CamerasState.parse({
      capture,
      pausedAll,
      cameras: rows.map((c) => ({
        id: c.id,
        name: c.name,
        place: c.place,
        // The household's pause wins over whatever the camera last reported,
        // so the grid cannot show "live" while the switch says otherwise.
        state: pausedAll && c.state === "live" ? "paused" : c.state,
        transport: c.transport,
        retentionDays: c.retentionDays,
        lastEventAt: c.lastEventAt,
        detection: c.detection,
      })),
      events: events.map((e) => ({
        id: e.id,
        cameraId: e.cameraId,
        at: e.at,
        kind: e.kind,
        clipSeconds: e.clipSeconds,
      })),
    });
  });

  /** Stop or resume every camera at once. An adult's decision, and a receipt. */
  app.post(
    "/cameras/pause",
    { preHandler: requireRole("adult"), schema: { body: z.object({ paused: z.boolean() }), response: { 200: z.object({ pausedAll: z.boolean() }) } } },
    async (req) => {
      const { data, settings } = app.deps;
      if (!settings) throw Object.assign(new Error("This Core cannot remember a pause."), { statusCode: 409 });
      const paused = req.body.paused;
      settings.set({ camerasPaused: paused });
      const p = req.session!.person;
      data.ledger.append({
        type: paused ? "cameras.paused" : "cameras.resumed",
        householdId: req.session!.household.id,
        actor: { kind: "person", id: p.id },
        where: "inside",
        payload: { by: p.name },
      });
      return { pausedAll: paused };
    },
  );

  /** Detection on or off for one camera, without stopping the stream. */
  app.post(
    "/cameras/:id/detection",
    {
      preHandler: requireRole("adult"),
      schema: { params: z.object({ id: z.string() }), body: z.object({ detection: z.boolean() }), response: { 200: z.object({ detection: z.boolean() }) } },
    },
    async (req) => {
      const { data } = app.deps;
      const householdId = req.session!.household.id;
      const row = data.database.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, req.params.id), eq(cameras.householdId, householdId)))
        .get();
      if (!row) throw Object.assign(new Error("No camera by that name on this box."), { statusCode: 404 });
      data.database.db
        .update(cameras)
        .set({ detection: req.body.detection, updatedAt: new Date().toISOString() })
        .where(eq(cameras.id, row.id))
        .run();
      return { detection: req.body.detection };
    },
  );

  /** How many days of clips this camera keeps before the box deletes them. */
  app.post(
    "/cameras/:id/retention",
    {
      preHandler: requireRole("adult"),
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({ days: z.number().int().min(0).max(365) }),
        response: { 200: z.object({ retentionDays: z.number() }) },
      },
    },
    async (req) => {
      const { data } = app.deps;
      const householdId = req.session!.household.id;
      const row = data.database.db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, req.params.id), eq(cameras.householdId, householdId)))
        .get();
      if (!row) throw Object.assign(new Error("No camera by that name on this box."), { statusCode: 404 });
      data.database.db
        .update(cameras)
        .set({ retentionDays: req.body.days, updatedAt: new Date().toISOString() })
        .where(eq(cameras.id, row.id))
        .run();
      return { retentionDays: req.body.days };
    },
  );

  /**
   * A still from the live stream. Capture is the box's job, so on a Core
   * without it this answers plainly rather than 404ing into a broken image:
   * the dashboard only asks for a snapshot of a camera it was told is live,
   * and a Core with no capture never lists one.
   */
  app.get("/cameras/:id/snapshot", { preHandler: requireSession, schema: { params: z.object({ id: z.string() }) } }, async (req, reply) => {
    if (!app.deps.hardware.capabilities.capture) {
      return reply.code(409).send({ error: "This Core has no camera capture." });
    }
    return reply.code(501).send({ error: "Capture is not implemented on this Core yet." });
  });
};
