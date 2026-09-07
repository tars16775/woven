"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PrivacyPanel } from "@/components/privacy-panel";
import { Card, Meter, PageHeader, Pill, WherePill } from "@/components/dashboard/ui";
import { MemoryCard } from "@/components/dashboard/memory-card";
import { privacy, type PrivacySummary } from "@/lib/core/ask";
import { explainAction } from "@/lib/core/actions";
import { useCore } from "@/lib/core/store";
import { RoomNote } from "@/components/dashboard/room-note";

const bytes = (n: number) => (n < 1e3 ? `${n} B` : n < 1e6 ? `${(n / 1e3).toFixed(1)} KB` : n < 1e9 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e9).toFixed(2)} GB`);

/** A receipt type as a person would read it. */
function typeLabel(type: string): string {
  return type.replace(/[._]/g, " ");
}

/**
 * The Privacy page against the household's own Core (gap 15). Every number
 * here is the ledger's: what stayed inside, what crossed, what each crossing
 * sent. No projections and nothing invented.
 */
export function LivePrivacy() {
  const connection = useCore();
  const rows = connection.phase === "connected" ? connection.rows.length : 0;
  const [summary, setSummary] = useState<PrivacySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refresh when the ledger grows: the summary is only ever what the receipts say.
  useEffect(() => {
    let alive = true;
    privacy
      .summary()
      .then((s) => alive && setSummary(s))
      .catch((err: unknown) => alive && setError(explainAction(err)));
    return () => {
      alive = false;
    };
  }, [rows]);

  const sub = summary ? `${summary.insideShare}% inside over ${summary.days} days · ${summary.crossings} ${summary.crossings === 1 ? "crossing" : "crossings"}, each approved by a person` : "Counting from the ledger…";

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Privacy"
        sub={<span data-testid="privacy-sub">{sub}</span>}
        action={
          <Pill tone="good">
            <span data-testid="privacy-live">From the ledger</span>
          </Pill>
        }
      />

      <RoomNote id="room:privacy" />
      <div className="mb-4">
        <MemoryCard />
      </div>
      {error && (
        <p role="alert" className="mb-4 text-[13px] text-ask">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-4">
          <Card dark>
            <div className="font-display text-[30px] font-medium leading-none tracking-[-0.02em]">{summary ? `${summary.insideShare}% stayed in this box` : "…"}</div>
            <div className="mt-2 text-[14px] text-ash-2">
              {summary ? `${summary.events} receipts in ${summary.days} days · ${summary.inside} inside · ${summary.crossings} through the Gate · ${bytes(summary.bytesCrossedToday)} crossed today` : "Reading the receipts."}
            </div>
            {summary && <Meter value={summary.inside} max={Math.max(1, summary.events)} className="mt-4" />}
          </Card>
          <PrivacyPanel />
        </div>
        <div className="grid gap-4">
          <Card title={`Receipts by kind, ${summary?.days ?? 7} days`}>
            {summary && summary.byType.length === 0 ? (
              <p className="text-[14px] text-ash">Nothing in the window yet.</p>
            ) : (
              <ul className="divide-y divide-ink/6" data-testid="privacy-by-type">
                {(summary?.byType ?? []).slice(0, 12).map((c) => (
                  <li key={c.type} className="flex items-center justify-between py-2.5 text-[14px] first:pt-0 last:pb-0">
                    <span className="font-medium">{typeLabel(c.type)}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-[12px] text-ash">{c.count}</span>
                      <WherePill where={c.type === "gate.crossing" ? "cloud" : "local"} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Crossings">
            {summary && summary.crossings7d.length === 0 ? (
              <p className="text-[14px] text-ash" data-testid="privacy-no-crossings">
                Nothing has crossed the Gate in {summary.days} days.
              </p>
            ) : (
              <ul className="divide-y divide-ink/6">
                {(summary?.crossings7d ?? []).map((b) => (
                  <li key={`${b.at}-${b.host}`} className="py-2.5 text-[14px] first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{b.host ?? "unknown host"}</span>
                      <span className="font-mono text-[11px] text-ash">{new Date(b.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-ash">
                      Sent: {b.sent ?? "not recorded"} · {bytes(b.bytesOut)}
                      {b.approvedBy ? ` · approved by ${b.approvedBy}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Your data">
            <p className="text-[14px] text-ash">
              Export everything, delete a memory or delete your account from{" "}
              <Link href="/dashboard/settings" className="font-medium text-ink underline-offset-2 hover:underline">
                Settings
              </Link>
              . Exports are produced on the box and never cross the Gate.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
