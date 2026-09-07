"use client";

import { Fragment, useMemo, useState } from "react";
import { Card, Meter, PageHeader, Pill, WherePill, whereRan } from "@/components/dashboard/ui";
import type { Where } from "@/lib/dashboard/types";
import { receiptLines, toActivity, type LiveActivityItem } from "@/lib/core/activity";
import { useCore } from "@/lib/core/store";
import { RoomNote } from "@/components/dashboard/room-note";

const filters: { id: "all" | Where; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "local", label: "Inside" },
  { id: "device", label: "Device" },
  { id: "policy", label: "Policy" },
  { id: "cloud", label: "Gate" },
];

export function ActivityLedger() {
  const [filter, setFilter] = useState<"all" | Where>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const connection = useCore();

  // The ledger, and nothing else: these are the household's own receipts.
  const activity: LiveActivityItem[] = useMemo(
    () => (connection.phase === "connected" ? connection.rows.map((r) => toActivity(r)) : []),
    [connection],
  );
  const rows = useMemo(() => activity.filter((a) => filter === "all" || a.where === filter), [activity, filter]);
  const days: LiveActivityItem["day"][] = ["today", "yesterday", "earlier"];
  const stayed = activity.filter((a) => a.where !== "cloud").length;
  const crossings = activity.filter((a) => a.where === "cloud").length;
  const share = activity.length ? Math.round((stayed / activity.length) * 100) : 100;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Where your data went"
        sub="Every consequential action, who asked, where it ran, and what left."
        action={
          <Pill tone="good">
            <span data-testid="activity-live">Live from the ledger</span>
          </Pill>
        }
      />

      <RoomNote id="room:activity" />

      <Card dark>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-display text-[30px] font-medium leading-none tracking-[-0.02em]">{share}% stayed in this box</div>
            <div className="mt-2 text-[14px] text-ash-2">
              {activity.length === 0
                ? "No receipts yet. Every consequential action writes one, and they appear here as they happen."
                : `${crossings} crossings in the last ${activity.length} receipts · each one written before anything left`}
            </div>
          </div>
          <div className="w-full md:w-[300px]">
            <Meter value={stayed} max={Math.max(1, activity.length)} />
          </div>
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter activity">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              filter === f.id ? "bg-ink text-bone" : "bg-white text-ink/80 ring-1 ring-ink/8 hover:ring-ink/20"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {days.map((day) => {
        const items = rows.filter((r) => r.day === day);
        if (items.length === 0) return null;
        return (
          <section key={day} className="mt-6">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-ash">
              {day === "today" ? "Today" : day === "yesterday" ? "Yesterday" : "Earlier"}
            </h2>
            <ul className="overflow-hidden rounded-[14px] bg-white ring-1 ring-ink/5">
              {items.map((a) => {
                const open = openId === a.id;
                return (
                  <li key={a.id} className="border-b border-ink/6 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : a.id)}
                      aria-expanded={open}
                      className="grid w-full grid-cols-[52px_100px_1fr_auto] items-baseline gap-3 px-4 py-3 text-left text-[14px] hover:bg-bone/60 md:grid-cols-[60px_120px_1fr_auto]"
                    >
                      <span className="font-mono text-[12px] text-ash">{a.time}</span>
                      <span className="font-medium">{a.title}</span>
                      <span className="min-w-0 truncate text-ink/80">{a.detail}</span>
                      <WherePill where={a.where} />
                    </button>
                    {open && (
                      <dl className="grid gap-x-8 gap-y-2 bg-bone/60 px-4 py-3 text-[13px] md:grid-cols-[120px_1fr] md:pl-[calc(60px+12px)]">
                        <dt className="text-ash">Asked by</dt>
                        <dd>{a.actor}</dd>
                        <dt className="text-ash">Ran</dt>
                        <dd>{whereRan[a.where]}</dd>
                        <dt className="text-ash">Sent</dt>
                        <dd>{a.sent ?? "Nothing left the box"}</dd>
                        {receiptLines(a).map(([k, v]) => (
                          <Fragment key={k}>
                            <dt className="text-ash">{k}</dt>
                            <dd className="break-words">{v}</dd>
                          </Fragment>
                        ))}
                        <dt className="text-ash">Receipt</dt>
                        <dd className="font-mono text-[12px]">{a.hash ? `#${a.seq} · ${a.hash.slice(0, 24)}…` : `rcp_${a.id}_${a.time.replace(":", "")}`}</dd>
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {activity.length === 0 && (
        <p className="mt-6 text-[14px] text-ash" data-testid="ledger-empty">
          Nothing has happened on this Core yet.
        </p>
      )}

      <p className="mt-6 text-[12px] text-ash">
        Tap any item for details · voice, home and camera data never cross the Gate.
      </p>
    </div>
  );
}
