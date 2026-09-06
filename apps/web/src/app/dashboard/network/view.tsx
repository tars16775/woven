"use client";

import { useState } from "react";
import { Button, Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { setGateOpen, useGateOpen } from "@/components/dashboard/state";
import { useCore } from "@/lib/core/store";
import { useSession } from "@/lib/auth";
import { LiveInside, LiveOutside, useNetworkScan } from "./live-cards";
import { network } from "@/lib/dashboard/data";

export function NetworkView() {
  const gateOpen = useGateOpen();
  const core = useCore();
  const session = useSession();
  const live = core.phase === "connected" && !!session && !session.simulated;
  const scan = useNetworkScan(live);
  const [confirm, setConfirm] = useState(false);
  const say = useToast();

  const closeGate = async () => {
    setConfirm(false);
    const problem = await setGateOpen(false);
    say(problem ?? (core.phase === "connected" ? "The Gate is closed · receipt written. Nothing crosses until you open it again." : "The Gate is closed. Nothing crosses until you open it again."));
  };

  const openGate = async () => {
    const problem = await setGateOpen(true);
    say(problem ?? "The Gate is open and asks first, as before.");
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Network"
        sub="Two networks in one box. The Inside has no route to the internet. The Outside is the router."
        action={gateOpen ? <Button onClick={() => setConfirm(true)}>Close the Gate</Button> : <Button kind="primary" onClick={openGate}>Open the Gate</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.6fr_1fr]">
        {live ? <LiveInside view={scan.view} error={scan.error} /> : (
        <Card dark title="Inside">
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-medium">{network.inside.ssid}</span>
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">
              <span className="orb" style={{ ["--orb" as string]: "6px" }} /> no internet
            </span>
          </div>
          <ul className="mt-3 divide-y divide-white/8">
            {network.inside.devices.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-[12px] text-ash-2">
                    {d.kind} · {d.link}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-ash-2">{d.since}</span>
              </li>
            ))}
          </ul>
        </Card>
        )}

        <section
          aria-labelledby="gate-title"
          className={`rounded-[14px] border p-5 transition-colors ${gateOpen ? "border-amber/50 bg-amber/8" : "border-ink/15 bg-chassis/40"}`}
        >
          <h2 id="gate-title" className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${gateOpen ? "text-ask" : "text-ash"}`}>
            The Gate
          </h2>
          <div className="mt-2 font-display text-[24px] font-medium tracking-[-0.02em]">{gateOpen ? "Open · asks first" : "Closed · nothing crosses"}</div>
          {!gateOpen && <p className="mt-2 text-[13px] text-ash">No crossings, no updates, no remote access until you open it. The Outside still routes the internet for the house.</p>}
          <ul className={`mt-4 space-y-3 ${gateOpen ? "" : "opacity-60"}`}>
            {network.gate.map((g) => (
              <li key={g.time + g.kind} className="text-[13px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{g.kind}</span>
                  <span className="font-mono text-[11px] text-ash">{g.time}</span>
                </div>
                <div className="text-[12px] text-ash">{g.detail}</div>
                <div className={`font-mono text-[11px] uppercase tracking-[0.12em] ${gateOpen ? "text-ask" : "text-ash"}`}>{g.bytes}</div>
              </li>
            ))}
          </ul>
        </section>

        {live ? <LiveOutside view={scan.view} /> : (
        <Card title="Outside · router">
          <div className="text-[14px]">
            <div className="flex items-center justify-between">
              <span className="font-medium">Internet</span>
              <Pill tone="good">Up</Pill>
            </div>
            <div className="mt-0.5 text-[12px] text-ash">{network.outside.wan}</div>
          </div>
          <ul className="mt-3 divide-y divide-ink/6">
            {network.outside.devices.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-[12px] text-ash">
                    {d.kind} · {d.link}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-ash">{d.since}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-ash">Rules</div>
          <ul className="mt-2 divide-y divide-ink/6">
            {network.outside.rules.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-[12px] text-ash">{r.detail}</div>
                </div>
                <Pill tone={r.on ? "dark" : "neutral"}>{r.on ? "On" : "Off"}</Pill>
              </li>
            ))}
          </ul>
        </Card>
        )}
      </div>

      <Card className="mt-4">
        <p className="text-[13px] text-ash">
          The Outside runs on its own network processor with its own memory. The Inside reaches the internet only through the Gate, which forwards approved tasks, verifies signed updates, and carries your key when you are away. The Gate keeps a record of every crossing and never stores your content.
        </p>
      </Card>

      <Dialog open={confirm} onClose={() => setConfirm(false)} kicker="Class C · reversible from here" title="Close the Gate?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          Nothing crosses until you open it again: no crossings, no updates, and no remote access with your key. The Outside keeps routing the internet for everyone in the house.
        </p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={closeGate} data-autofocus>
            Close the Gate
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setConfirm(false)}>
            Leave it open
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
