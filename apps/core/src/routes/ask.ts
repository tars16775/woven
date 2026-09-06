import { AskAnswer, PilotNumbers, PrivacySummary } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/guard.ts";
import { listSnapshots } from "../integrity.ts";
import { privacySummary } from "../privacy.ts";
import type { ZodTypeProvider } from "../zod.ts";

/**
 * Ask (gap 11), the privacy summary (gap 15) and the pilot numbers (gap
 * 30): three routes that only ever say what the box can compute for itself.
 */
export const askRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();
  const { services, data, hardware, config } = app.deps;

  app.post(
    "/ask",
    { preHandler: requireSession, schema: { body: z.object({ question: z.string().trim().min(1).max(500) }), response: { 200: AskAnswer } } },
    async (req) => services.ask.answer(req.session!.person, req.body.question),
  );

  app.get("/privacy/summary", { preHandler: requireSession, schema: { response: { 200: PrivacySummary } } }, async () => privacySummary(data.ledger));

  /** Numbers the pilot page and the Core page show, every one computed here and now. */
  app.get("/pilot/numbers", { preHandler: requireSession, schema: { response: { 200: PilotNumbers } } }, async (req) => {
    const [storage, snaps] = await Promise.all([hardware.storage(), listSnapshots(data.paths.snapshots, config.snapshotMirror)]);
    const summary = privacySummary(data.ledger);
    const files = services.files.summary(req.session!.person, storage);
    const photos = services.photos.stats(req.session!.person);
    const view = services.household.view();
    const integrity = data.ledger.head();
    return {
      computedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      people: view.setup ? view.people.length : 0,
      files: { items: files.byNamespace.reduce((n, x) => n + x.items, 0), bytes: files.totalBytes, uniqueBytes: files.uniqueBytes },
      photos: photos.total,
      ledgerRows: integrity?.seq ?? 0,
      snapshots: { count: snaps.length, lastAt: snaps[0]?.takenAt ?? null, mirrored: snaps.filter((s) => s.mirrored).length },
      crossings7d: summary.crossings,
      insideShare7d: summary.insideShare,
      bytesCrossedToday: summary.bytesCrossedToday,
      alerts: services.alerts.list().length,
      gate: services.gate.cached().state,
      storage: { usedBytes: storage.usedBytes, totalBytes: storage.totalBytes, freeBytes: storage.freeBytes },
    };
  });
};
