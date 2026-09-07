"use client";

import { useState } from "react";
import { Button, Card, PageHeader } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { setGateOpen, useGateOpen } from "@/components/dashboard/state";
import { useCore } from "@/lib/core/store";
import { timeOf } from "@/lib/core/format";
import { LiveInside, LiveOutside, useNetworkScan } from "./live-cards";
import type { LedgerRow } from "@woven/schema";

const formatBytes = (n: number) => (n < 1e3 ? `${n} bytes` : n < 1e6 ? `${(n / 1e3).toFixed(1)} KB` : `${(n / 1e6).toFixed(1)} MB`);

/** The last few times something actually crossed, read from the receipts on hand. */
function crossings(rows: LedgerRow[]) {
  return rows
    .filter((r) => r.type === "gate.crossing")
    .slice(0, 5)
    .map((r) => {
      const observed = (r.payload as { observed?: { bytesOut?: unknown } }).observed;
      const out = observed && typeof observed.bytesOut === "number" ? observed.bytesOut : 0;
      return { id: r.id, time: timeOf(r.occurredAt), kind: r.target ?? "Crossing", detail: r.actor.kind === "core" ? "the Core asked" : `${r.actor.kind} ${r.actor.id}`, bytes: formatBytes(out) };
    });
}

/** Two networks in one box, read from the Core that answered. */
export function NetworkView() {
  const gateOpen = useGateOpen();
  const core = useCore();
  const scan = useNetworkScan(core.phase === "connected");
  const [confirm, setConfirm] = useState(false);
  const say = useToast();
  const gate = core.phase === "connected" ? crossings(core.rows) : [];

  const closeGate = async () => {
    setConfirm(false);
    const problem = await setGateOpen(false);
    say(problem ?? "The Gate is closed · receipt written. Nothing crosses until you open it again.");
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
        <LiveInside view={scan.view} error={scan.error} />

        <section
          aria-labelledby="gate-title"
          className={`rounded-[14px] border p-5 transition-colors ${gateOpen ? "border-amber/50 bg-amber/8" : "border-ink/15 bg-chassis/40"}`}
        >
          <h2 id="gate-title" className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${gateOpen ? "text-ask" : "text-ash"}`}>
            The Gate
          </h2>
          <div className="mt-2 font-display text-[24px] font-medium tracking-[-0.02em]">{gateOpen ? "Open · asks first" : "Closed · nothing crosses"}</div>
          {!gateOpen && <p className="mt-2 text-[13px] text-ash">No crossings, no updates, no remote access until you open it. The Outside still routes the internet for the house.</p>}
          {gate.length === 0 ? (
            <p className="mt-4 text-[13px] text-ash" data-testid="gate-empty">
              Nothing has crossed yet. Every crossing writes a receipt, and they appear here as they happen.
            </p>
          ) : (
            <ul className={`mt-4 space-y-3 ${gateOpen ? "" : "opacity-60"}`} data-testid="gate-crossings">
              {gate.map((g) => (
                <li key={g.id} className="text-[13px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{g.kind}</span>
                    <span className="font-mono text-[11px] text-ash">{g.time}</span>
                  </div>
                  <div className="text-[12px] text-ash">{g.detail}</div>
                  <div className={`font-mono text-[11px] uppercase tracking-[0.12em] ${gateOpen ? "text-ask" : "text-ash"}`}>{g.bytes}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <LiveOutside view={scan.view} />
      </div>

      <Card className="mt-4">
        <p className="text-[13px] text-ash">
          The Outside runs on its own network processor with its own memory. The Inside reaches the internet only through the Gate, which forwards approved
          tasks, verifies signed updates, and carries your key when you are away. The Gate keeps a record of every crossing and never stores your content.
        </p>
      </Card>

      <Dialog open={confirm} onClose={() => setConfirm(false)} kicker="Class C · reversible from here" title="Close the Gate?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          Nothing crosses until you open it again: no crossings, no updates, and no remote access with your key. The Outside keeps routing the internet for
          everyone in the house.
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
