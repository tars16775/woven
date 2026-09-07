"use client";

import { useEffect, useState } from "react";
import { Card, Pill } from "@/components/dashboard/ui";
import { pilot, type PilotNumbers } from "@/lib/core/ask";
import { explainAction } from "@/lib/core/actions";

const bytes = (n: number) => (n < 1e6 ? `${(n / 1e3).toFixed(0)} KB` : n < 1e9 ? `${(n / 1e6).toFixed(1)} MB` : n < 1e12 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e12).toFixed(2)} TB`);
const uptime = (s: number) => (s < 3600 ? `${Math.floor(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`);

/**
 * The numbers this Core can vouch for (gap 30), computed on the box the
 * moment the card asks. Nothing here is projected or carried over from the
 * nothing invented: an empty household shows zeros.
 */
export function PilotCard() {
  const [n, setN] = useState<PilotNumbers | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      pilot
        .numbers()
        .then((x) => alive && setN(x))
        .catch((err: unknown) => alive && setError(explainAction(err)));
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const rows: [string, string][] = n
    ? [
        ["Up", uptime(n.uptimeSeconds)],
        ["People", String(n.people)],
        ["Files", `${n.files.items} · ${bytes(n.files.bytes)} (${bytes(n.files.uniqueBytes)} unique on disk)`],
        ["Photos", String(n.photos)],
        ["Receipts in the ledger", String(n.ledgerRows)],
        ["Snapshots", n.snapshots.count === 0 ? "none yet" : `${n.snapshots.count} · ${n.snapshots.mirrored} mirrored · last ${new Date(n.snapshots.lastAt!).toLocaleString()}`],
        ["Inside, 7 days", `${n.insideShare7d}% · ${n.crossings7d} ${n.crossings7d === 1 ? "crossing" : "crossings"}`],
        ["Crossed today", bytes(n.bytesCrossedToday)],
        ["Gate", n.gate],
        ["Storage", `${bytes(n.storage.usedBytes)} of ${bytes(n.storage.totalBytes)} · ${bytes(n.storage.freeBytes)} free`],
      ]
    : [];

  return (
    <Card title="Numbers, computed now" action={n ? <Pill tone="good">{new Date(n.computedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Pill> : undefined}>
      {error ? (
        <p role="alert" className="text-[13px] text-ask">
          {error}
        </p>
      ) : !n ? (
        <p className="text-[13px] text-ash">Counting…</p>
      ) : (
        <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2" data-testid="pilot-numbers">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-ink/6 pb-2">
              <dt className="text-ash">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-[12px] text-ash">Every figure is counted on the box when this card loads. Nothing is estimated.</p>
    </Card>
  );
}
