"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Card, Pill, Stat, WherePill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { scheduleBackup, useCamerasPaused, useGateOpen, useScheduledBackups } from "@/components/dashboard/state";
import { activity, cameras, core, folders, people, photoStats, rooms, suggestions } from "@/lib/dashboard/data";
import { memoryLabel, storageLabel, storageUsedLabel, temperatureLabel, useLiveCore } from "@/lib/core/live";
import { useCore } from "@/lib/core/store";
import { toActivity } from "@/lib/core/activity";
import { Approvals } from "@/components/dashboard/approvals";
import { useSession } from "@/lib/auth";
import { LiveOverview } from "./live";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const insideByDay = [99.4, 100, 99.1, 100, 99.8, 100, 99.6];

const leaseSummary = [
  ["Renews", "September 16, 2026 · automatic unless either side gives 30 days notice"],
  ["Rent", "$2,150 a month last year · the renewal letter proposes $2,240 (+4.2%)"],
  ["Deposit", "$2,150 held · returned within 21 days of moving out"],
  ["Notice", "Reply by September 1 to negotiate · after that the new rent stands"],
];

/** The box's own numbers when a Core issued the session; the preview house otherwise. */
export function OverviewView() {
  const connection = useCore();
  const session = useSession();
  if (connection.phase === "connected" && session && !session.simulated) return <LiveOverview />;
  return <PreviewOverview />;
}

function PreviewOverview() {
  const session = useSession();
  const [summary, setSummary] = useState(false);
  const say = useToast();
  const scheduled = useScheduledBackups();
  const camerasPaused = useCamerasPaused();
  const gateOpen = useGateOpen();
  const connection = useCore();
  const machine = useLiveCore();

  const devices = rooms.reduce((n, r) => n + r.devices.length, 0);
  const live = camerasPaused ? 0 : cameras.filter((c) => c.live).length;
  const today =
    connection.phase === "connected" && connection.rows.length
      ? connection.rows.slice(0, 5).map((r) => toActivity(r))
      : activity.filter((a) => a.day === "today").slice(0, 5);
  const mayaScheduled = scheduled.includes("Maya's laptop");

  const backUpTonight = () => {
    scheduleBackup("Maya's laptop");
    say("Maya's laptop will back up tonight over Wi-Fi, once it is on the charger.");
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="font-display text-[34px] font-medium leading-none tracking-[-0.02em] md:text-[40px]">
        {greeting()}, {session?.name?.split(" ")[0] ?? people[0].name}
      </h1>
      <p className="mt-2 text-[14px] text-ash">
        {machine.connected ? `Everything is running at home · ${machine.model} · up ${machine.uptime}` : "Everything is running at home · Woven Core+"}
      </p>

      <div className="mt-6">
        <Approvals compact />
      </div>

      {/* The one card that matters */}
      <div className="dash-lock mt-6 flex flex-col gap-4 rounded-[16px] bg-graphite p-5 text-bone ring-1 ring-white/8 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-center gap-4">
          <span className="orb shrink-0" style={{ ["--orb" as string]: "14px" }} />
          <div>
            <div className="font-display text-[24px] font-medium leading-none tracking-[-0.02em]">All inside</div>
            <div className="mt-1.5 text-[14px] text-ash-2">
              {gateOpen
                ? core.bytesCrossedToday === 0
                  ? "0 bytes crossed the Gate today"
                  : `${core.bytesCrossedToday} crossed the Gate today`
                : "Gate closed · nothing crosses"}{" "}
              · {core.insideShare7d}% inside this week
            </div>
          </div>
        </div>
        <div className="flex items-end gap-6 md:gap-10">
          <div className="hidden flex-col items-end sm:flex" aria-label="Share of work done inside, last seven days">
            <div className="flex h-9 items-end gap-[3px]">
              {insideByDay.map((v, i) => (
                <span
                  key={i}
                  title={`${v}% inside`}
                  className={`block w-[6px] rounded-[2px] ${i === 6 ? "bg-amber-2" : "bg-bone/30"}`}
                  style={{ height: `${Math.max(18, (v - 97) * 12)}px` }}
                />
              ))}
            </div>
            <div className="mt-1.5 text-[11px] text-ash-2">7 days</div>
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
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Files" value={storageUsedLabel(machine)} sub={`${folders.filter((f) => f.kind === "device").length} devices syncing`} href="/dashboard/files" />
        <Stat label="Photos" value={photoStats.total.toLocaleString()} sub={`${photoStats.newThisWeek} new · indexed`} href="/dashboard/photos" />
        <Stat label="Home" value={`${devices} devices`} sub="Goodnight scene 22:30" href="/dashboard/home" />
        <Stat label="Cameras" value={camerasPaused ? "Paused" : `${live} live`} sub={camerasPaused ? "Resume from Cameras" : "1 event today"} href="/dashboard/cameras" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title="Tandem suggests">
          <ul className="divide-y divide-ink/6">
            {suggestions.map((s) => {
              let action: ReactNode;
              if (s.id === "lease") {
                action = (
                  <Button kind="soft" onClick={() => setSummary(true)}>
                    {s.action}
                  </Button>
                );
              } else if (s.id === "backup") {
                action = mayaScheduled ? (
                  <Pill tone="good">Tonight</Pill>
                ) : (
                  <Button kind="soft" onClick={backUpTonight}>
                    {s.action}
                  </Button>
                );
              } else {
                action = (
                  <Link href="/dashboard/core#drives" className="inline-flex items-center rounded-[8px] bg-bone px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-chassis">
                    {s.action}
                  </Link>
                );
              }
              return (
                <li key={s.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex gap-3">
                    <span className="mt-[7px] block h-[8px] w-[8px] shrink-0 rounded-full bg-amber" />
                    <div>
                      <div className="text-[15px] font-medium">{s.title}</div>
                      <div className="mt-0.5 text-[13px] text-ash">
                        {s.id === "backup" && mayaScheduled ? "Scheduled for tonight over Wi-Fi. Tandem will tell you when it is done." : s.detail}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0">{action}</span>
                </li>
              );
            })}
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
        </Card>
      </div>

      <Link
        href="/dashboard/ask"
        className="mt-6 flex items-center gap-3 rounded-full bg-white px-4 py-3 text-[15px] text-ash ring-1 ring-ink/8 transition-colors hover:ring-ink/20"
      >
        <span className="orb" style={{ ["--orb" as string]: "10px" }} />
        Ask Tandem anything…
        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bone">↑</span>
      </Link>

      <Dialog open={summary} onClose={() => setSummary(false)} kicker="Files/Home · 2 documents · read inside" title="Your lease, in four lines" size="md">
        <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-[90px_1fr]">
          {leaseSummary.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ash">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-ash">Read from the PDF and last year&apos;s statements on the box. Nothing crossed the Gate.</p>
        <DialogActions>
          <Link href="/dashboard/ask" className="btn btn-primary min-w-0 flex-1" onClick={() => setSummary(false)}>
            Ask about it
          </Link>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setSummary(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
