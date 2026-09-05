"use client";

import { useState } from "react";
import { Button, Card, PageHeader, Pill } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { rooms as initialRooms, routines as initialRoutines, type Device, type Room } from "@/lib/dashboard/data";

const kindLabel: Record<Device["kind"], string> = {
  light: "Light",
  plug: "Plug",
  thermostat: "Thermostat",
  lock: "Lock",
  sensor: "Sensor",
  camera: "Camera",
  robot: "Robot",
  speaker: "Speaker",
};

/**
 * Rooms and devices with the same rules as the box: class B toggles are
 * immediate, a lock asks first, sensors are read-only. Every change would
 * become a receipt.
 */
export function HomeControls() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [routines, setRoutines] = useState(initialRoutines);
  const [pending, setPending] = useState<{ room: string; device: string } | null>(null);
  const say = useToast();

  const toggle = (roomId: string, dev: Device) => {
    if (dev.kind === "lock") {
      if (dev.value === "Locked") {
        setPending({ room: roomId, device: dev.id });
      } else {
        setValue(roomId, dev.id, "Locked");
        say("Front door locked · verified by bolt sensor");
      }
      return;
    }
    setRooms((rs) =>
      rs.map((r) =>
        r.id !== roomId
          ? r
          : { ...r, devices: r.devices.map((d) => (d.id === dev.id ? { ...d, on: !d.on } : d)) },
      ),
    );
    say(`${dev.name} ${dev.on ? "off" : "on"} · inside · receipt written`);
  };

  const setValue = (roomId: string, devId: string, value: string) =>
    setRooms((rs) =>
      rs.map((r) =>
        r.id !== roomId
          ? r
          : { ...r, devices: r.devices.map((d) => (d.id === devId ? { ...d, value } : d)) },
      ),
    );

  const confirmUnlock = () => {
    if (!pending) return;
    setValue(pending.room, pending.device, "Unlocked");
    setPending(null);
    say("Front door unlocked · approved by Alex · receipt written");
  };

  const runRoutine = (id: string) => {
    const r = routines.find((x) => x.id === id);
    if (!r) return;
    say(`${r.name} running · ${r.actions}`);
    setRoutines((rs) => rs.map((x) => (x.id === id ? { ...x, lastRun: "Just now" } : x)));
  };

  const occupied = rooms.filter((r) => r.occupied).length;
  const total = rooms.reduce((n, r) => n + r.devices.length, 0);
  const offline = rooms.reduce((n, r) => n + r.devices.filter((d) => !d.reachable).length, 0);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Home"
        sub={
          <>
            {total} devices · {occupied} of {rooms.length} rooms occupied ·{" "}
            {offline === 0 ? "all reachable" : `${offline} unreachable`} · runs offline
          </>
        }
        action={
          <div className="flex gap-2">
            {routines
              .filter((r) => r.enabled)
              .slice(0, 3)
              .map((r) => (
                <Button key={r.id} onClick={() => runRoutine(r.id)}>
                  {r.name}
                </Button>
              ))}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => (
          <Card
            key={room.id}
            title={room.name}
            action={<Pill tone={room.occupied ? "good" : "neutral"}>{room.occupied ? "Occupied" : "Empty"}</Pill>}
          >
            <ul className="divide-y divide-ink/6">
              {room.devices.map((d) => {
                const controllable = d.kind === "light" || d.kind === "plug" || d.kind === "speaker" || d.kind === "lock";
                const isOn = d.kind === "lock" ? d.value === "Unlocked" : !!d.on;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
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
                      {d.value && <span className="text-[13px] text-ash">{d.value}</span>}
                      {controllable && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isOn}
                          aria-label={`${d.name} ${d.kind === "lock" ? (isOn ? "unlocked" : "locked") : isOn ? "on" : "off"}`}
                          disabled={!d.reachable}
                          onClick={() => toggle(room.id, d)}
                          className={`relative block h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${
                            isOn ? "bg-amber" : "bg-chassis-2"
                          }`}
                        >
                          <span
                            className={`absolute top-[3px] block h-[18px] w-[18px] rounded-full bg-white transition-transform ${
                              isOn ? "translate-x-[23px]" : "translate-x-[3px]"
                            }`}
                          />
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

      <Card title="Routines" className="mt-4">
        <ul className="divide-y divide-ink/6">
          {routines.map((r) => (
            <li key={r.id} className="grid items-center gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[160px_1fr_1fr_auto_auto]">
              <div className="text-[14px] font-medium">{r.name}</div>
              <div className="text-[13px] text-ash">{r.trigger}</div>
              <div className="text-[13px]">{r.actions}</div>
              <div className="font-mono text-[11px] text-ash">{r.lastRun}</div>
              <div className="flex items-center gap-2">
                <Button kind="soft" className="py-1" onClick={() => runRoutine(r.id)}>
                  Run
                </Button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`${r.name} enabled`}
                  onClick={() => setRoutines((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))}
                  className={`relative block h-6 w-11 rounded-full transition-colors ${r.enabled ? "bg-ink" : "bg-chassis-2"}`}
                >
                  <span className={`absolute top-[3px] block h-[18px] w-[18px] rounded-full bg-white transition-transform ${r.enabled ? "translate-x-[23px]" : "translate-x-[3px]"}`} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Approval card for a class D action */}
      <Dialog open={pending !== null} onClose={() => setPending(null)} kicker="Class D · asks first" title="Unlock the front door?" tone="ask">
        <p className="mt-2 text-[14px] text-ash">You are at home, so presence is satisfied. This unlock will be written to Activity with your name.</p>
        <DialogActions>
          <Button kind="primary" className="flex-1 py-2.5" onClick={confirmUnlock} data-autofocus>
            Unlock
          </Button>
          <Button kind="soft" className="flex-1 py-2.5" onClick={() => setPending(null)}>
            Keep locked
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
