import type { LedgerRow, PrivacySummary } from "@woven/schema";
import type { Ledger } from "./ledger.ts";

/**
 * The privacy numbers (gap 15), computed from the ledger and nothing else:
 * how much of what the box did stayed inside, what crossed the Gate, what
 * each crossing sent, and how many bytes left today. Every figure on the
 * Privacy page comes from here, so the page can only say what the receipts
 * say.
 */
export function privacySummary(ledger: Ledger, now = new Date(), days = 7): PrivacySummary {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const rows = ledger.since(since);
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const startOfToday = midnight.toISOString();

  const byType = new Map<string, number>();
  let crossings = 0;
  let bytesCrossedToday = 0;
  const list: PrivacySummary["crossings7d"] = [];
  for (const r of rows) {
    byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
    if (r.type !== "gate.crossing") continue;
    crossings += 1;
    const bytes = bytesOut(r);
    if (r.occurredAt >= startOfToday) bytesCrossedToday += bytes;
    list.push({ at: r.occurredAt, host: r.target ?? null, sent: r.sent ?? null, bytesOut: bytes, approvedBy: approvedBy(r), capability: capabilityOf(r) });
  }
  list.sort((a, b) => b.at.localeCompare(a.at));
  const events = rows.length;
  const inside = events - crossings;
  return {
    days,
    since,
    events,
    inside,
    crossings,
    insideShare: events ? Math.round((inside / events) * 1000) / 10 : 100,
    bytesCrossedToday,
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    crossings7d: list.slice(0, 50),
  };
}

function bytesOut(r: LedgerRow): number {
  const observed = (r.payload as { observed?: { bytesOut?: unknown } }).observed;
  const n = observed && typeof observed.bytesOut === "number" ? observed.bytesOut : 0;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function approvedBy(r: LedgerRow): string | null {
  const v = (r.payload as { approvedBy?: unknown }).approvedBy;
  return typeof v === "string" ? v : r.actor.kind === "person" ? r.actor.id : null;
}

function capabilityOf(r: LedgerRow): string | null {
  const v = (r.payload as { capability?: unknown }).capability;
  return typeof v === "string" ? v : null;
}
