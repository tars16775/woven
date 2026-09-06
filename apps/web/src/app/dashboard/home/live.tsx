"use client";

import { useEffect, useState } from "react";
import { Button, Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { Approvals } from "@/components/dashboard/approvals";
import { RoutinesCard } from "@/components/dashboard/routines-card";
import { actions, describe, explainAction, home, type ActionRecord, type HomeState } from "@/lib/core/actions";
import { useCore } from "@/lib/core/store";

const kindLabel: Record<string, string> = { light: "Light", plug: "Plug", thermostat: "Thermostat", lock: "Lock", sensor: "Sensor", camera: "Camera", robot: "Robot", speaker: "Speaker" };

function readingOf(d: HomeState["devices"][number]): string | null {
  const s = d.state;
  if (d.kind === "light") return typeof s.brightness === "number" && s.on ? `${s.brightness}%` : null;
  if (d.kind === "thermostat") return `${String(s.setpointC)} °C`;
  if (d.kind === "lock") return s.locked ? "Locked" : "Unlocked";
  if (d.kind === "sensor") return typeof s.temperatureC === "number" ? `${s.temperatureC} °C` : s.open === true ? "Open" : s.open === false ? "Closed" : s.motion ? "Motion" : "Clear";
  if (d.kind === "robot") return s.docked ? `Docked · ${String(s.battery)}%` : "Cleaning";
  return null;
}

/**
 * The Home page against a real Core: devices from the adapter, every toggle
 * an action with a receipt, class D through the approval flow, presence the
 * household sets until phones report it.
 */
export function LiveHomeControls() {
  const core = useCore();
  const say = useToast();
  const [state, setState] = useState<HomeState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<ActionRecord | null>(null);
  const head = core.phase === "connected" ? (core.rows[0]?.seq ?? 0) : 0;

  useEffect(() => {
    let alive = true;
    home
      .state()
      .then((s) => alive && setState(s))
      .catch((err: unknown) => alive && say(explainAction(err)));
    return () => {
      alive = false;
    };
    // Re-read after every ledger row: some other device or person may have changed the house.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head]);

  const refresh = async () => setState(await home.state());

  const act = async (label: string, req: Parameters<typeof actions.run>[0]) => {
    if (busy) return;
    setBusy(label);
    try {
      const result = await actions.run(req);
      if (result.status === "prepared") setAsk(result);
      else say(describe(result));
      await refresh();
    } catch (err) {
      say(explainAction(err));
    } finally {
      setBusy(null);
    }
  };

  const toggle = (d: HomeState["devices"][number]) => {
    const on = d.kind === "lock" ? !d.state.locked : Boolean(d.state.on ?? d.state.playing);
    if (d.kind === "lock") return act(d.id, { capability: on ? "lock.lock" : "lock.unlock", target: d.id, parameters: {} });
    if (d.kind === "light") return act(d.id, { capability: "light.set", target: d.id, parameters: { on: !on } });
    if (d.kind === "plug") return act(d.id, { capability: "plug.set", target: d.id, parameters: { on: !on } });
    if (d.kind === "speaker") return act(d.id, { capability: "media.set", target: d.id, parameters: { playing: !on } });
  };

  const approveNow = async () => {
    if (!ask) return;
    setBusy(ask.id);
    try {
      const approved = await actions.approve(ask.id);
      const done = approved.status === "approved" ? await actions.execute(ask.id) : approved;
      say(describe(done));
      setAsk(null);
      await refresh();
    } catch (err) {
      say(explainAction(err));
    } finally {
      setBusy(null);
    }
  };

  const setPresence = async (adultsHome: boolean) => {
    try {
      await home.setPresence(adultsHome);
      await refresh();
      say(adultsHome ? "Marked as home. Class D actions are automatic for adults while someone is here." : "Marked as away. Unlocks will ask first.");
    } catch (err) {
      say(explainAction(err));
    }
  };

  if (!state) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Home" sub="Reading the house…" />
      </div>
    );
  }

  const offline = state.devices.filter((d) => !d.reachable).length;
  const occupied = state.rooms.filter((r) => r.occupied).length;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Home"
        sub={
          <>
            {state.devices.length} devices · {occupied} of {state.rooms.length} rooms occupied · {offline === 0 ? "all reachable" : `${offline} unreachable`} · {state.adapter} adapter
          </>
        }
        action={
          <div className="flex items-center gap-2" data-testid="presence">
            <Pill tone={state.presence.adultsHome ? "good" : "neutral"}>{state.presence.adultsHome ? "Someone is home" : "Nobody home"}</Pill>
            <Button kind="soft" onClick={() => setPresence(!state.presence.adultsHome)}>
              {state.presence.adultsHome ? "Mark as away" : "I'm home"}
            </Button>
          </div>
        }
      />

      <Approvals />

      <div className="grid gap-4 md:grid-cols-2">
        {state.rooms.map((room) => (
          <Card key={room.id} title={room.name} action={<Pill tone={room.occupied ? "good" : "neutral"}>{room.occupied ? "Occupied" : "Empty"}</Pill>}>
            <ul className="divide-y divide-ink/6">
              {state.devices
                .filter((d) => d.roomId === room.id)
                .map((d) => {
                  const controllable = d.kind === "light" || d.kind === "plug" || d.kind === "speaker" || d.kind === "lock";
                  const isOn = d.kind === "lock" ? !d.state.locked : Boolean(d.state.on ?? d.state.playing);
                  const reading = readingOf(d);
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0" data-testid={`device-${d.id}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[14px]">
                          <span className={`block h-[6px] w-[6px] rounded-full ${d.reachable ? (isOn ? "bg-amber" : "bg-ink/25") : "bg-[#c0392b]"}`} />
                          <span className="font-medium">{d.name}</span>
                          <span className="text-ash">{kindLabel[d.kind]}</span>
                        </div>
                        <div className="mt-0.5 pl-[14px] font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
                          {d.protocol} · class {d.riskClass}
                          {!d.reachable && " · unreachable"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {reading && <span className="text-[13px] text-ash">{reading}</span>}
                        {controllable && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isOn}
                            aria-label={`${d.name} ${d.kind === "lock" ? (isOn ? "unlocked" : "locked") : isOn ? "on" : "off"}`}
                            disabled={!d.reachable || busy !== null}
                            aria-busy={busy === d.id}
                            onClick={() => toggle(d)}
                            className={`relative block h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${isOn ? "bg-amber" : "bg-chassis-2"}`}
                          >
                            <span className={`absolute top-[3px] block h-[18px] w-[18px] rounded-full bg-white transition-transform ${isOn ? "translate-x-[23px]" : "translate-x-[3px]"}`} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </Card>
        ))}
      </div>

      <RoutinesCard devices={state.devices} onRan={() => void refresh()} />

      <p className="mt-4 text-[12px] text-ash">Every switch is an action with a receipt.</p>

      <Dialog open={ask !== null} onClose={() => setAsk(null)} kicker={ask ? `Class ${ask.riskClass} · asks first` : ""} title={ask?.preview ?? ""} tone="ask">
        <p className="mt-2 text-[14px] text-ash">
          {ask?.decision.reason}
          {ask?.approval?.factors.includes("presence") ? " Someone must be home for this; mark yourself home first if you are." : ""} This will be written to Activity with your name.
        </p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={approveNow} disabled={busy !== null} data-autofocus>
            Approve and do it
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setAsk(null)}>
            Not now
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
