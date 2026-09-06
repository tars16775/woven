"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Field, inputClass } from "@/components/dashboard/ui";
import { Dialog, DialogActions } from "@/components/dashboard/dialog";
import { useToast } from "@/components/dashboard/toast";
import { explainAction, routines as api, type HomeState, type NewRoutine, type Routine } from "@/lib/core/actions";

type StepDraft = { device: string; what: "on" | "off" | "lock" | "unlock" | "setpoint"; setpoint: number };

const triggerLabel = (t: Routine["trigger"]) =>
  t.kind === "manual" ? "When you run it" : t.kind === "time" ? `Every day at ${t.at}` : t.kind === "presence" ? (t.when === "everyone_away" ? "Everyone away" : "First person home") : `“${t.phrase}”`;

function stepsFor(draft: StepDraft[], devices: HomeState["devices"]): NewRoutine["steps"] {
  return draft.map((d) => {
    const dev = devices.find((x) => x.id === d.device)!;
    if (dev.kind === "lock") return { capability: d.what === "unlock" ? "lock.unlock" : "lock.lock", target: dev.id, parameters: {} };
    if (dev.kind === "thermostat") return { capability: "climate.set_temperature", target: dev.id, parameters: { setpointC: d.setpoint } };
    if (dev.kind === "plug") return { capability: "plug.set", target: dev.id, parameters: { on: d.what === "on" } };
    if (dev.kind === "speaker") return { capability: "media.set", target: dev.id, parameters: { playing: d.what === "on" } };
    return { capability: "light.set", target: dev.id, parameters: { on: d.what === "on" } };
  });
}

const describeStep = (s: Routine["steps"][number], devices: HomeState["devices"]) => {
  const name = devices.find((d) => d.id === s.target)?.name ?? s.target;
  if (s.capability === "lock.lock") return `lock ${name}`;
  if (s.capability === "lock.unlock") return `unlock ${name}`;
  if (s.capability === "climate.set_temperature") return `${name} to ${String(s.parameters.setpointC)} °C`;
  return `${name} ${s.parameters.on === false || s.parameters.playing === false ? "off" : "on"}`;
};

/** Routines against a real Core (phase 27): run, switch on or off, make new ones from the devices the box knows. */
export function RoutinesCard({ devices, onRan }: { devices: HomeState["devices"]; onRan?: () => void }) {
  const say = useToast();
  const [list, setList] = useState<Routine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<"manual" | "time" | "everyone_away" | "first_home" | "phrase">("manual");
  const [at, setAt] = useState("22:30");
  const [phrase, setPhrase] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([]);

  const refresh = () => api.list().then(setList).catch((err: unknown) => say(explainAction(err)));
  useEffect(() => {
    let alive = true;
    api
      .list()
      .then((r) => alive && setList(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const run = async (r: Routine) => {
    setBusy(r.id);
    try {
      const result = await api.run(r.id);
      say(`${r.name}: ${result.summary}`);
      await refresh();
      onRan?.();
    } catch (err) {
      say(explainAction(err));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (r: Routine) => {
    try {
      await api.update(r.id, { enabled: !r.enabled });
      await refresh();
    } catch (err) {
      say(explainAction(err));
    }
  };

  const remove = async (r: Routine) => {
    try {
      await api.remove(r.id);
      await refresh();
      say(`${r.name} deleted.`);
    } catch (err) {
      say(explainAction(err));
    }
  };

  const controllable = devices.filter((d) => ["light", "plug", "speaker", "lock", "thermostat"].includes(d.kind));

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || steps.length === 0) return;
    const t: NewRoutine["trigger"] = trigger === "manual" ? { kind: "manual" } : trigger === "time" ? { kind: "time", at } : trigger === "phrase" ? { kind: "phrase", phrase: phrase.trim() || name.trim().toLowerCase() } : { kind: "presence", when: trigger };
    try {
      await api.create({ name: name.trim(), trigger: t, steps: stepsFor(steps, devices), enabled: true });
      setMaking(false);
      setName("");
      setSteps([]);
      await refresh();
      say("Routine made. Every step is an action with a receipt.");
    } catch (err) {
      say(explainAction(err));
    }
  };

  return (
    <Card
      title="Routines"
      className="mt-4"
      action={
        <Button kind="soft" onClick={() => setMaking(true)} data-testid="new-routine">
          New routine
        </Button>
      }
    >
      {list.length === 0 ? (
        <p className="text-[14px] text-ash">No routines yet.</p>
      ) : (
        <ul className="divide-y divide-ink/6" data-testid="routines">
          {list.map((r) => (
            <li key={r.id} className="grid items-center gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[160px_1fr_1fr_auto_auto]">
              <div className="text-[14px] font-medium">{r.name}</div>
              <div className="text-[13px] text-ash">{triggerLabel(r.trigger)}</div>
              <div className="truncate text-[13px]" title={r.steps.map((s) => describeStep(s, devices)).join(" · ")}>
                {r.steps.map((s) => describeStep(s, devices)).join(" · ")}
              </div>
              <div className="font-mono text-[11px] text-ash">{r.lastResult ? r.lastResult : r.lastRunAt ? new Date(r.lastRunAt).toLocaleString() : "Never run"}</div>
              <div className="flex items-center gap-2">
                <Button kind="soft" className="py-1" onClick={() => run(r)} disabled={busy !== null} aria-busy={busy === r.id} aria-label={`Run ${r.name}`}>
                  Run
                </Button>
                <button type="button" role="switch" aria-checked={r.enabled} aria-label={`${r.name} enabled`} onClick={() => toggle(r)} className={`relative block h-6 w-11 rounded-full transition-colors ${r.enabled ? "bg-ink" : "bg-chassis-2"}`}>
                  <span className={`absolute top-[3px] block h-[18px] w-[18px] rounded-full bg-white transition-transform ${r.enabled ? "translate-x-[23px]" : "translate-x-[3px]"}`} />
                </button>
                <Button kind="quiet" className="py-1" onClick={() => remove(r)} aria-label={`Delete ${r.name}`}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-ash">A routine can do no more than the person who made it. A step that asks first (a lock with nobody home) waits as an approval card instead of running.</p>

      <Dialog open={making} onClose={() => setMaking(false)} kicker="Home" title="New routine" size="md">
        <form onSubmit={create} className="mt-4 space-y-4">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Movie night" data-autofocus required />
          </Field>
          <Field label="When">
            <select className={inputClass} value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)}>
              <option value="manual">When I run it</option>
              <option value="time">Every day at a time</option>
              <option value="everyone_away">When everyone leaves</option>
              <option value="first_home">When the first person comes home</option>
              <option value="phrase">When someone says a phrase</option>
            </select>
          </Field>
          {trigger === "time" && (
            <Field label="Time">
              <input className={inputClass} type="time" value={at} onChange={(e) => setAt(e.target.value)} />
            </Field>
          )}
          {trigger === "phrase" && (
            <Field label="Phrase">
              <input className={inputClass} value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="movie time" />
            </Field>
          )}
          <Field label="Steps">
            <ul className="space-y-2">
              {steps.map((s, i) => {
                const dev = devices.find((d) => d.id === s.device);
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <select className={`${inputClass} w-auto flex-1`} value={s.device} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, device: e.target.value } : x)))}>
                      {controllable.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    {dev?.kind === "thermostat" ? (
                      <input className={`${inputClass} w-24`} type="number" min={15} max={28} step={0.5} value={s.setpoint} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, what: "setpoint", setpoint: Number(e.target.value) } : x)))} />
                    ) : (
                      <select className={`${inputClass} w-auto`} value={s.what} onChange={(e) => setSteps((all) => all.map((x, j) => (j === i ? { ...x, what: e.target.value as StepDraft["what"] } : x)))}>
                        {dev?.kind === "lock" ? (
                          <>
                            <option value="lock">lock</option>
                            <option value="unlock">unlock</option>
                          </>
                        ) : (
                          <>
                            <option value="on">on</option>
                            <option value="off">off</option>
                          </>
                        )}
                      </select>
                    )}
                    <Button kind="quiet" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} aria-label="Remove step">
                      ×
                    </Button>
                  </li>
                );
              })}
            </ul>
            <Button kind="soft" className="mt-2" onClick={() => setSteps((all) => [...all, { device: controllable[0]?.id ?? "", what: controllable[0]?.kind === "lock" ? "lock" : "on", setpoint: 21 }])} disabled={controllable.length === 0} data-testid="add-step">
              Add a step
            </Button>
          </Field>
          <DialogActions>
            <Button kind="primary" type="submit" className="flex-1 py-2.5" disabled={!name.trim() || steps.length === 0}>
              Make it
            </Button>
            <Button kind="soft" className="flex-1 py-2.5" onClick={() => setMaking(false)}>
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Card>
  );
}
