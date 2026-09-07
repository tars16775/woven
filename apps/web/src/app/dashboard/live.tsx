"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Alert, BackupStatus, HomeState, PilotNumbers, PrivacySummary, PushSubscriptionView, RemoteStatus } from "@woven/schema";
import { Card, Pill, Stat, WherePill } from "@/components/dashboard/ui";
import { Approvals } from "@/components/dashboard/approvals";
import { PowerCard } from "@/components/dashboard/power-card";
import { useSession } from "@/lib/auth";
import { home, push, remote } from "@/lib/core/actions";
import { pilot, privacy } from "@/lib/core/ask";
import { bytes, system } from "@/lib/core/files";
import { identity } from "@/lib/core/identity";
import { memoryLabel, storageLabel, temperatureLabel, useLiveCore } from "@/lib/core/live";
import { useCore } from "@/lib/core/store";
import { toActivity } from "@/lib/core/activity";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

type Facts = {
  numbers: PilotNumbers | null;
  summary: PrivacySummary | null;
  alerts: Alert[];
  homeState: HomeState | null;
  passkeys: number | null;
  backups: BackupStatus | null;
  pushDevices: PushSubscriptionView[] | null;
  remoteStatus: RemoteStatus | null;
};

/**
 * The Overview against the household's own Core. Every figure is the box's,
 * computed when the page asks. A new house also gets a short list of what is
 * worth setting up, each item checked against what the Core actually has.
 */
export function LiveOverview() {
  const session = useSession();
  const connection = useCore();
  const machine = useLiveCore();
  const [facts, setFacts] = useState<Facts>({ numbers: null, summary: null, alerts: [], homeState: null, passkeys: null, backups: null, pushDevices: null, remoteStatus: null });
  const rows = connection.phase === "connected" ? connection.rows : [];
  const off = connection.phase === "connected" && connection.status?.power?.power === "off";
  const adult = session?.role === "owner" || session?.role === "adult";

  useEffect(() => {
    if (off) return;
    let alive = true;
    const quiet = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    void Promise.all([quiet(pilot.numbers()), quiet(privacy.summary()), quiet(identity.alerts()), quiet(home.state()), quiet(identity.passkeys()), adult ? quiet(system.backups()) : Promise.resolve(null), quiet(push.list()), quiet(remote.status())]).then(([numbers, summary, alerts, homeState, keys, backups, pushDevices, remoteStatus]) => {
      if (!alive) return;
      setFacts({ numbers, summary, alerts: alerts ?? [], homeState, passkeys: keys?.passkeys.length ?? null, backups, pushDevices, remoteStatus });
    });
    return () => {
      alive = false;
    };
  }, [rows.length, off, adult]);

  const today = rows.slice(0, 6).map((r) => toActivity(r));
  const receiptsToday = rows.filter((r) => new Date(r.occurredAt).toDateString() === new Date().toDateString()).length;
  const devices = facts.homeState?.devices.length ?? null;
  const urgent = facts.alerts.filter((a) => a.level !== "info");

  const setup: { done: boolean | null; title: string; detail: string; href: string }[] = [
    { done: facts.passkeys === null ? null : facts.passkeys > 0, title: "A passkey on this device", detail: "Sign in with Touch ID or Face ID; recovery codes are the fallback.", href: "/dashboard/settings" },
    { done: facts.backups === null ? null : !!facts.backups.mirror, title: "A second place for snapshots", detail: "Another drive keeps a copy of every nightly snapshot.", href: "/dashboard/core" },
    { done: facts.numbers === null ? null : facts.numbers.files.items > 0, title: "Something backed up", detail: "Upload from Files, or run woven-backup on another Mac.", href: "/dashboard/files" },
    { done: facts.pushDevices === null ? null : facts.pushDevices.length > 0, title: "Notifications on a device", detail: "Urgent alerts reach you even when this page is closed.", href: "/dashboard/settings" },
    { done: facts.remoteStatus === null ? null : facts.remoteStatus.devices > 0, title: "Reach it from away", detail: facts.remoteStatus?.enabled ? "Pair this browser while you are at home." : "Set a relay address on the Core to turn this on.", href: "/dashboard/settings" },
  ];
  const left = setup.filter((s) => s.done === false);

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="font-display text-[34px] font-medium leading-none tracking-[-0.02em] md:text-[40px]">
        {greeting()}, {session?.name?.split(" ")[0] ?? "there"}
      </h1>
      <p className="mt-2 text-[14px] text-ash" data-testid="overview-sub">
        {off ? "The Core is switched off." : `${machine.model} · up ${machine.uptime} · ${facts.numbers ? `${facts.numbers.people} ${facts.numbers.people === 1 ? "person" : "people"}` : "…"}`}
      </p>

      <div className="mt-6">
        <PowerCard compact />
      </div>

      {!off && urgent.length > 0 && (
        <Card className="mt-4" title="Needs a look" action={<Pill tone="warn">{urgent.length}</Pill>}>
          <ul className="divide-y divide-ink/6" data-testid="overview-alerts">
            {urgent.map((a) => (
              <li key={a.id} className="py-2.5 text-[14px] first:pt-0 last:pb-0">
                <span className="font-medium">{a.title}</span> <span className="text-ash">{a.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!off && (
        <div className="mt-4">
          <Approvals compact />
        </div>
      )}

      <div className="dash-lock mt-4 flex flex-col gap-4 rounded-[16px] bg-graphite p-5 text-bone ring-1 ring-white/8 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-center gap-4">
          <span className="orb shrink-0" style={{ ["--orb" as string]: "14px" }} />
          <div>
            <div className="font-display text-[24px] font-medium leading-none tracking-[-0.02em]">{off ? "Switched off" : machine.gate === "open" ? "Gate open · asks first" : "All inside"}</div>
            <div className="mt-1.5 text-[14px] text-ash-2">
              {facts.summary ? `${facts.summary.insideShare}% inside over ${facts.summary.days} days · ${facts.summary.crossings} ${facts.summary.crossings === 1 ? "crossing" : "crossings"} · ${bytes(facts.summary.bytesCrossedToday)} left today` : "Counting from the ledger…"}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-6 text-right md:gap-10">
          <div>
            <dd className="font-display text-[20px] font-medium">{memoryLabel(machine)}</dd>
            <dt className="text-[12px] text-ash-2">Memory</dt>
          </div>
          <div>
            <dd className="font-display text-[20px] font-medium">{storageLabel(machine)}</dd>
            <dt className="text-[12px] text-ash-2">Storage</dt>
          </div>
          <div>
            <dd className="font-display text-[20px] font-medium">{machine.temperatureC === null ? `up ${machine.uptime}` : temperatureLabel(machine)}</dd>
            <dt className="text-[12px] text-ash-2">{machine.temperatureC === null ? "Uptime" : machine.fan}</dt>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="overview-stats">
        <Stat label="Files" value={facts.numbers ? bytes(facts.numbers.files.bytes) : "…"} sub={facts.numbers ? `${facts.numbers.files.items} ${facts.numbers.files.items === 1 ? "file" : "files"} · stored once` : "counting"} href="/dashboard/files" />
        <Stat label="Photos" value={facts.numbers ? facts.numbers.photos.toLocaleString() : "…"} sub={facts.numbers?.photos ? "indexed on the box" : "none yet"} href="/dashboard/photos" />
        <Stat label="Home" value={devices === null ? "…" : `${devices} ${devices === 1 ? "device" : "devices"}`} sub={facts.homeState ? `${facts.homeState.adapter} · ${facts.homeState.presence.adultsHome ? "someone home" : "nobody home"}` : "reading"} href="/dashboard/home" />
        <Stat label="Receipts today" value={String(receiptsToday)} sub={facts.numbers ? `${facts.numbers.ledgerRows} in the ledger` : "counting"} href="/dashboard/activity" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title={left.length ? "Worth setting up" : "Set up"} action={left.length ? <Pill tone="neutral">{left.length} left</Pill> : <Pill tone="good">Done</Pill>}>
          <ul className="divide-y divide-ink/6" data-testid="overview-setup">
            {setup.map((s) => (
              <li key={s.title} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex gap-3">
                  <span className={`mt-[6px] block h-[8px] w-[8px] shrink-0 rounded-full ${s.done ? "bg-local" : s.done === null ? "bg-ink/20" : "bg-amber"}`} />
                  <div>
                    <div className="text-[15px] font-medium">{s.title}</div>
                    <div className="mt-0.5 text-[13px] text-ash">{s.detail}</div>
                  </div>
                </div>
                {s.done ? (
                  <Pill tone="good">Done</Pill>
                ) : (
                  <Link href={s.href} className="inline-flex shrink-0 items-center rounded-[8px] bg-bone px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-chassis">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Today"
          action={
            <Link href="/dashboard/activity" className="text-[13px] font-medium text-ash hover:text-ink">
              All activity
            </Link>
          }
        >
          {today.length === 0 ? (
            <p className="text-[14px] text-ash">No receipts yet today.</p>
          ) : (
            <ul className="divide-y divide-ink/6">
              {today.map((a) => (
                <li key={a.id} className="grid grid-cols-[44px_1fr_auto] items-baseline gap-3 py-2.5 text-[13px] first:pt-0 last:pb-0">
                  <span className="font-mono text-[11px] text-ash">{a.time}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{a.title}</span> <span className="text-ash">{a.detail}</span>
                  </span>
                  <WherePill where={a.where} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Link href="/dashboard/ask" className="mt-6 flex items-center gap-3 rounded-full bg-white px-4 py-3 text-[15px] text-ash ring-1 ring-ink/8 transition-colors hover:ring-ink/20">
        <span className="orb" style={{ ["--orb" as string]: "10px" }} />
        Ask the box…
        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bone">↑</span>
      </Link>
    </div>
  );
}
