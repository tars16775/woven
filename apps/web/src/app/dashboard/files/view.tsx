"use client";

import { useState } from "react";
import { Card, Meter, PageHeader, Pill, Button } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useScheduledBackups } from "@/components/dashboard/state";
import { core, folders, people } from "@/lib/dashboard/data";

/** A pairing code the box would show on its screen: two groups, no ambiguous glyphs. */
function pairingCode() {
  const glyphs = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => glyphs[Math.floor(Math.random() * glyphs.length)];
  return `${pick()}${pick()}${pick()} ${pick()}${pick()}${pick()}`;
}

export function FilesView() {
  const devices = folders.filter((f) => f.kind === "device");
  const shared = folders.filter((f) => f.kind === "folder");
  const scheduled = useScheduledBackups();
  const [code, setCode] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Files"
        sub={`${core.storageUsedTb} of ${core.storageTb} TB used · encrypted at rest · nothing synced to a third party`}
        action={
          <Button kind="primary" className="px-5 py-2" onClick={() => setCode(pairingCode())}>
            Add a device
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-display text-[28px] font-medium leading-none tracking-[-0.02em]">{core.storageUsedTb} TB</div>
            <div className="mt-1.5 text-[13px] text-ash">of {core.storageTb} TB · bay 2 empty · add up to 16 TB without a settings menu</div>
          </div>
          <div className="w-full md:w-[360px]">
            <Meter value={core.storageUsedTb} max={core.storageTb} />
            <div className="mt-1.5 flex justify-between text-[11px] text-ash">
              <span>Photos 296 GB · Devices 831 GB · Media 88 GB</span>
              <span>{Math.round((1 - core.storageUsedTb / core.storageTb) * 100)}% free</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Devices backing up">
          <ul className="divide-y divide-ink/6">
            {devices.map((d) => {
              const stale = d.synced.includes("days");
              const tonight = scheduled.includes(d.name);
              return (
                <li key={d.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-[14px] font-medium">{d.name}</div>
                    <div className="mt-0.5 text-[12px] text-ash">
                      {d.items.toLocaleString()} items · {d.size}
                    </div>
                  </div>
                  {tonight ? <Pill tone="good">Tonight</Pill> : <Pill tone={stale ? "warn" : "good"}>{stale ? `Last ${d.synced}` : d.synced}</Pill>}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Shared folders">
          <ul className="divide-y divide-ink/6">
            {shared.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="text-[14px] font-medium">{d.name}</div>
                  <div className="mt-0.5 text-[12px] text-ash">
                    {d.items.toLocaleString()} items · {d.size}
                  </div>
                </div>
                <span className="text-[12px] text-ash">{d.synced}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="People and namespaces" className="mt-4">
        <ul className="grid gap-3 sm:grid-cols-3">
          {people.map((p) => (
            <li key={p.id} className="rounded-[12px] bg-bone px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[13px] font-medium text-bone">{p.initial}</span>
                <div>
                  <div className="text-[14px] font-medium">{p.name}</div>
                  <div className="text-[12px] capitalize text-ash">
                    {p.role} · {p.devices} devices
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[12px] text-ash">Private files are visible only to {p.name}. Shared folders follow household roles.</div>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={code !== null} onClose={() => setCode(null)} kicker="Pairing · inside only" title="Add a device">
        <p className="mt-2 text-[14px] text-ash">Open Woven on the new device, choose Join a household, and enter this code. The box confirms the pairing on its own screen.</p>
        <div className="mt-4 rounded-[12px] bg-bone px-5 py-4 text-center">
          <div className="font-mono text-[32px] font-medium tracking-[0.18em]" aria-label={`Pairing code ${code ?? ""}`}>
            {code}
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash">Valid for 10 minutes · works on this Wi-Fi only</div>
        </div>
        <DialogActions>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setCode(pairingCode())}>
            New code
          </Button>
          <Button kind="primary" className="flex-1 py-2.5" onClick={() => setCode(null)} data-autofocus>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
