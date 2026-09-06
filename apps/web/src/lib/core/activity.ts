import type { LedgerRow } from "@woven/schema";
import type { ActivityItem, Where } from "@/lib/dashboard/data";
import { timeOf } from "./format";

const titles: Record<string, string> = {
  "household.created": "Household created",
  "person.created": "Person added",
  "person.removed": "Person removed",
  "session.started": "Signed in",
  "session.ended": "Signed out",
  "action.prepared": "Action prepared",
  "action.approved": "Action approved",
  "action.declined": "Action declined",
  "action.executed": "Action ran",
  "action.verified": "Action verified",
  "action.failed": "Action failed",
  "gate.crossing": "Crossing",
  "gate.closed": "Gate closed",
  "gate.opened": "Gate opened",
  "update.verified": "Update verified",
  "update.installed": "Update installed",
  "memory.created": "Memory kept",
  "memory.deleted": "Memory forgotten",
  "core.started": "Core started",
  "core.integrity_checked": "Ledger verified",
};

const whereOf: Record<LedgerRow["where"], Where> = { inside: "local", gate: "cloud", device: "device", policy: "policy" };

const kindOf = (type: string): ActivityItem["kind"] =>
  type.startsWith("gate.") ? "gate" : type.startsWith("action.") ? "home" : type.startsWith("memory.") ? "tandem" : type.startsWith("update.") || type.startsWith("core.") ? "core" : "core";

function detailOf(row: LedgerRow): string {
  const p = row.payload;
  if (row.type === "core.integrity_checked") return p.ok === true ? `${String(p.rows)} rows, chain intact` : "chain broken";
  if (row.type === "core.started") return `version ${String(p.version ?? "")}${p.kind ? ` on ${String(p.kind)}` : ""}`.trim();
  if (row.type === "household.created") return String(p.name ?? "");
  if (row.type === "person.created") return `${String(p.role ?? "")} · ${row.target ?? ""}`.replace(/ · $/, "");
  if (row.target) return row.target;
  const keys = Object.keys(p);
  return keys.length ? keys.map((k) => `${k} ${String(p[k])}`).join(" · ").slice(0, 80) : "";
}

function dayOf(iso: string, now = new Date()): ActivityItem["day"] | "earlier" {
  const d = new Date(iso);
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return "today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return same(d, y) ? "yesterday" : "earlier";
}

export type LiveActivityItem = Omit<ActivityItem, "day"> & { day: ActivityItem["day"] | "earlier"; seq: number; hash: string; payload?: Record<string, unknown> };

/** A ledger row as the Activity page shows it. */
export function toActivity(row: LedgerRow, now = new Date()): LiveActivityItem {
  return {
    id: row.id,
    time: timeOf(row.occurredAt),
    day: dayOf(row.occurredAt, now),
    kind: kindOf(row.type),
    title: titles[row.type] ?? row.type,
    detail: detailOf(row),
    where: whereOf[row.where],
    actor: row.actor.kind === "core" ? "the Core" : `${row.actor.kind} ${row.actor.id}`,
    ...(row.sent ? { sent: row.sent } : {}),
    seq: row.seq,
    hash: row.hash,
    payload: row.payload,
  };
}

/** The receipt lines a person reads when they open an item: what was planned, what was observed, who said yes. */
export function receiptLines(item: LiveActivityItem): [string, string][] {
  const p = item.payload ?? {};
  const out: [string, string][] = [];
  const show = (v: unknown) => (v && typeof v === "object" ? Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} ${String(x)}`).join(" · ") || "nothing" : String(v));
  if ("planned" in p) out.push(["Planned", show(p.planned)]);
  if ("observed" in p) out.push(["Observed", show(p.observed)]);
  if (typeof p.approvedBy === "string") out.push(["Approved by", p.approvedBy]);
  if (typeof p.reason === "string") out.push(["Reason", p.reason]);
  if (typeof p.preview === "string") out.push(["Preview", p.preview]);
  if (typeof p.capability === "string") out.push(["Capability", p.capability]);
  return out;
}
