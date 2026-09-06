import { LedgerRow } from "@woven/schema";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { CORE_HOUSEHOLD_ID } from "../data.ts";
import { requireSession } from "../auth/guard.ts";
import type { ZodTypeProvider } from "../zod.ts";

const Integrity = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), rows: z.number().int(), head: z.string().nullable(), checkedAt: z.iso.datetime() }),
  z.object({ ok: z.literal(false), rows: z.number().int(), brokenAtSeq: z.number().int(), reason: z.string(), checkedAt: z.iso.datetime() }),
]);

/**
 * The ledger as the Activity page sees it. Reading is open on the LAN until
 * phase 8 adds sessions; the integrity check is what "Verify" on the Core
 * page will call.
 */
export const ledgerRoutes: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/ledger/recent",
    {
      preHandler: requireSession,
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(500).default(50) }),
        response: { 200: z.object({ rows: z.array(LedgerRow) }) },
      },
    },
    // One box, one household: the feed is everything the box did, its own start-ups included.
    async (req) => ({ rows: app.deps.data.ledger.recent(undefined, req.query.limit) }),
  );

  app.get("/ledger/integrity", { preHandler: requireSession, schema: { response: { 200: Integrity } } }, async () => {
    const { ledger } = app.deps.data;
    const report = ledger.verify();
    // The check is itself an event: a ledger that says it was verified, and when.
    ledger.append({
      type: "core.integrity_checked",
      householdId: CORE_HOUSEHOLD_ID,
      actor: { kind: "core", id: "core" },
      where: "inside",
      sensitivity: "low",
      payload: { ok: report.ok, rows: report.rows },
    });
    return { ...report, checkedAt: new Date().toISOString() };
  });
};
