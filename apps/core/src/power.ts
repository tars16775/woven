import type { Alerts } from "./alerts.ts";
import { CORE_HOUSEHOLD_ID } from "./data.ts";
import type { GateClient } from "./gate/client.ts";
import type { Ledger } from "./ledger.ts";
import type { SettingsStore } from "./settings.ts";

export type PowerState = { power: "on" | "off"; since: string | null; by: string | null };

/**
 * The kill switch. "Off" is a state the Core holds, not a process that
 * died: the Gate closes, the relay drops, routines and the nightly job
 * stop, and every route but health, status, sign-in and the switch itself
 * answers 503. The static dashboard keeps being served so the switch can be
 * flipped back. The state is written to settings.json, so a Core that
 * restarts while off comes back off. Every flip is a receipt.
 */
export class Power {
  private state: PowerState;
  private readonly hooks: { onOff: () => void | Promise<void>; onOn: () => void | Promise<void> }[] = [];

  constructor(
    private readonly settings: SettingsStore,
    private readonly gate: GateClient,
    private readonly ledger: Ledger,
    private readonly alerts: Alerts,
  ) {
    const saved = settings.get();
    this.state = { power: saved.power ?? "on", since: saved.powerSince ?? null, by: saved.powerBy ?? null };
  }

  /** Something that must stop when the Core goes off and start again when it comes on (the relay, timers). */
  attach(hook: { onOff: () => void | Promise<void>; onOn: () => void | Promise<void> }): void {
    this.hooks.push(hook);
  }

  get on(): boolean {
    return this.state.power === "on";
  }

  get(): PowerState {
    return { ...this.state };
  }

  async off(by: { id: string; name: string }): Promise<PowerState> {
    if (!this.on) return this.get();
    const now = new Date().toISOString();
    this.state = { power: "off", since: now, by: by.id };
    this.settings.set({ power: "off", powerSince: now, powerBy: by.id });
    // The Gate closes first, so nothing leaves while the rest winds down. It stays closed after "on" until the owner opens it.
    await this.gate.setOpen(false, by.id).catch(() => undefined);
    for (const h of this.hooks) await h.onOff();
    this.ledger.append({ type: "core.power", householdId: CORE_HOUSEHOLD_ID, actor: { kind: "person", id: by.id }, where: "inside", sensitivity: "high", payload: { power: "off", by: by.name } });
    this.alerts.raise("power", "warn", "The Core is switched off", `${by.name} switched it off. Nothing runs, nothing leaves, nothing answers until it is switched on again.`);
    return this.get();
  }

  async on_(by: { id: string; name: string }): Promise<PowerState> {
    if (this.on) return this.get();
    const now = new Date().toISOString();
    this.state = { power: "on", since: now, by: by.id };
    this.settings.set({ power: "on", powerSince: now, powerBy: by.id });
    for (const h of this.hooks) await h.onOn();
    this.ledger.append({ type: "core.power", householdId: CORE_HOUSEHOLD_ID, actor: { kind: "person", id: by.id }, where: "inside", sensitivity: "high", payload: { power: "on", by: by.name } });
    this.alerts.clear("power");
    return this.get();
  }

  /** At start: a Core that was off stays off, and says so. */
  async resume(): Promise<void> {
    if (this.on) {
      for (const h of this.hooks) await h.onOn();
      return;
    }
    await this.gate.setOpen(false, "power").catch(() => undefined);
    this.alerts.raise("power", "warn", "The Core is switched off", "It was off when it last stopped and stays off until someone switches it on.");
  }
}

/** Routes that keep answering while the Core is off: enough to see the state and flip the switch. */
export const ALWAYS_ON = [/^\/v1\/health$/, /^\/v1\/system\/status$/, /^\/v1\/system\/power$/, /^\/v1\/system\/alerts$/, /^\/v1\/auth\//, /^\/v1\/household\/setup$/, /^\/v1\/screen/];
