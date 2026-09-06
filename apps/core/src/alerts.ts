import type { Alert } from "@woven/schema";

/**
 * Alerts (phase 47): the few things the household should hear about, shown
 * on the screen and the Core page. Raised by checks, cleared when the
 * check passes again. Never carries content, only the state of the box.
 */
export class Alerts {
  private readonly active = new Map<string, Alert>();
  onChange: ((alerts: Alert[]) => void) | null = null;

  raise(id: string, level: Alert["level"], title: string, detail: string): void {
    const existing = this.active.get(id);
    if (existing && existing.level === level && existing.detail === detail) return;
    this.active.set(id, { id, level, title, detail, since: existing?.since ?? new Date().toISOString() });
    this.onChange?.(this.list());
  }

  clear(id: string): void {
    if (this.active.delete(id)) this.onChange?.(this.list());
  }

  list(): Alert[] {
    const order = { urgent: 0, warn: 1, info: 2 };
    return [...this.active.values()].sort((a, b) => order[a.level] - order[b.level] || a.since.localeCompare(b.since));
  }
}

/** The checks that raise or clear alerts from what the box already knows. */
export function assess(alerts: Alerts, facts: { diskFreeBytes: number; diskTotalBytes: number; ledgerOk: boolean; objectsBad: number; mirrorConfigured: boolean; mirrorOk: boolean | null; certDaysLeft: number | null; gate: "open" | "closed" | "absent"; lastSnapshotAgeHours: number | null; lowCodes?: { name: string; left: number }[] }): void {
  const freePct = facts.diskTotalBytes ? (facts.diskFreeBytes / facts.diskTotalBytes) * 100 : 100;
  if (freePct < 3) alerts.raise("disk", "urgent", "The volume is almost full", `${freePct.toFixed(1)}% free. Backups and photos will stop landing.`);
  else if (freePct < 10) alerts.raise("disk", "warn", "The volume is filling up", `${freePct.toFixed(0)}% free. Add a drive or clear space soon.`);
  else alerts.clear("disk");

  if (!facts.ledgerOk) alerts.raise("ledger", "urgent", "The ledger does not verify", "A receipt was changed or damaged. Restore from a snapshot and check the box.");
  else alerts.clear("ledger");

  if (facts.objectsBad > 0) alerts.raise("objects", "urgent", "Damaged files on the volume", `${facts.objectsBad} objects no longer match their hash. The drive may be failing; run a restore drill.`);
  else alerts.clear("objects");

  if (facts.mirrorConfigured && facts.mirrorOk === false) alerts.raise("mirror", "warn", "The second backup location is not reachable", "Last night's snapshot was not copied. Check the second drive.");
  else alerts.clear("mirror");
  if (!facts.mirrorConfigured) alerts.raise("no-mirror", "info", "Snapshots have one copy", "Set a second location so a failed drive is not the end of the story.");
  else alerts.clear("no-mirror");

  if (facts.certDaysLeft !== null && facts.certDaysLeft < 14) alerts.raise("cert", "warn", "The core's certificate is about to renew", `${facts.certDaysLeft} days left. It renews on its own at start; restart the core if devices complain.`);
  else alerts.clear("cert");

  if (facts.gate === "absent") alerts.raise("gate", "warn", "No Gate is running", "Nothing can cross. Restart the core to start it.");
  else alerts.clear("gate");

  if (facts.lastSnapshotAgeHours !== null && facts.lastSnapshotAgeHours > 48) alerts.raise("snapshot", "warn", "No recent snapshot", `The last one is ${Math.round(facts.lastSnapshotAgeHours / 24)} days old.`);
  else alerts.clear("snapshot");

  const low = facts.lowCodes ?? [];
  if (low.length) alerts.raise("recovery-codes", "info", "Recovery codes are running low", `${low.map((p) => `${p.name} has ${p.left}`).join(", ")}. Print a new set from Settings before they are gone.`);
  else alerts.clear("recovery-codes");
}
