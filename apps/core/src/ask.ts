import type { ActionRecord, AskAnswer, HomeDevice, Person } from "@woven/schema";
import type { Services } from "./services.ts";
import type { Ledger } from "./ledger.ts";

/**
 * Tandem lite (gap 11): the Ask page's answer engine until a model runs on
 * the box. Plain rules over what the household already keeps here: files,
 * photos, devices, backups, memory, routines, receipts. It never makes
 * anything up, says so when it does not know, and never crosses the Gate.
 * Anything that changes the house goes through the action engine like
 * every other request, so it asks first where the policy says so.
 */
export class Ask {
  constructor(
    private readonly services: Services,
    private readonly ledger: Ledger,
    private readonly disk: () => Promise<{ usedBytes: number; totalBytes: number; freeBytes: number }>,
  ) {}

  async answer(person: Person, question: string): Promise<AskAnswer> {
    const started = Date.now();
    const q = question.trim();
    const t = q.toLowerCase();
    const done = (text: string, source: string, extra: { action?: ActionRecord; items?: AskAnswer["items"] } = {}): AskAnswer => ({
      text,
      source,
      where: "local",
      ms: Date.now() - started,
      engine: "rules",
      action: extra.action ?? null,
      items: extra.items ?? [],
    });

    // Remember something, or say what is remembered.
    const remember = /^(?:please )?remember (?:that )?(.+)$/i.exec(q);
    if (remember) {
      const m = this.services.memory.remember(person, { text: remember[1]!.trim(), kind: "fact" });
      return done(`Remembered: “${m.text}”. It stays on the box; you can see and delete it under Privacy.`, "Memory");
    }
    if (/what do you (?:know|remember)|your memor/.test(t)) {
      const list = this.services.memory.list(person);
      if (!list.length) return done("Nothing yet. Say “remember …” and it stays here, on the box, until you delete it.", "Memory");
      return done(`${list.length} ${list.length === 1 ? "thing" : "things"}, all kept on the box:`, "Memory", { items: list.slice(0, 8).map((m) => ({ title: m.text, detail: m.kind, href: "/dashboard/privacy" })) });
    }

    // The home: state, and changes through the action engine.
    if (/\b(light|lamp|plug|switch)s?\b/.test(t) && /\b(on|off)\b/.test(t)) {
      const on = !/\boff\b/.test(t);
      const devices = this.services.home.devices().filter((d) => d.kind === "light" || d.kind === "plug");
      const picked = this.pickDevices(t, devices);
      if (!picked.length) {
        if (!devices.length) return done("There are no lights or plugs paired with this box yet. Pair one from Home.", "Home");
        return done(`Which one? I know ${devices.map((d) => d.name).join(", ")}.`, "Home", { items: devices.slice(0, 8).map((d) => ({ title: d.name, detail: this.roomName(d), href: "/dashboard/home" })) });
      }
      const target = picked[0]!;
      const record = await this.services.actions.run(person.householdId, { kind: "person", id: person.id, role: person.role }, { capability: target.kind === "light" ? "light.set" : "plug.set", target: target.id, parameters: { on } });
      const verb = on ? "on" : "off";
      if (record.status === "succeeded") return done(`${target.name} is ${verb}, read back from the device. Written to Activity.`, "Home", { action: record });
      if (record.status === "prepared") return done(`${target.name} ${verb} needs your approval first: ${record.decision.reason}`, "Home · permission engine", { action: record });
      return done(`I could not turn ${target.name} ${verb}: ${record.error ?? record.decision.reason}`, "Home", { action: record });
    }
    if (/\b(lock|door)s?\b/.test(t)) {
      const locks = this.services.home.devices().filter((d) => d.kind === "lock");
      if (!locks.length) return done("No lock is paired with this box.", "Home");
      const lines = locks.map((d) => `${d.name} is ${d.state.locked === true ? "locked" : d.state.locked === false ? "unlocked" : "in an unknown state"}`);
      return done(`${lines.join("; ")}. Unlocking is a class D action and asks first.`, "Home");
    }
    if (/\b(temperature|thermostat|heating|how (?:warm|cold))\b/.test(t)) {
      const th = this.services.home.devices().filter((d) => d.kind === "thermostat");
      if (!th.length) return done("No thermostat is paired with this box.", "Home");
      return done(th.map((d) => `${d.name}: ${fmtState(d)}`).join("; "), "Home");
    }
    if (/\b(device|room)s?\b/.test(t) && /\b(what|which|list|how many)\b/.test(t)) {
      const devices = this.services.home.devices();
      const rooms = this.services.home.rooms();
      return done(`${devices.length} ${devices.length === 1 ? "device" : "devices"} in ${rooms.length} ${rooms.length === 1 ? "room" : "rooms"}, through the ${this.services.home.name} adapter.`, "Home", { items: devices.slice(0, 10).map((d) => ({ title: d.name, detail: `${this.roomName(d)} · ${fmtState(d)}`, href: "/dashboard/home" })) });
    }

    // Photos: counts, and search when the model is on the box.
    if (/\b(photo|picture|pic|image)s?\b/.test(t)) {
      const stats = this.services.photos.stats(person);
      const of = /\b(?:of|with|from|showing)\s+(.+?)[?.!]*$/.exec(q);
      if (of && (await this.services.photoIndex.ready())) {
        const r = await this.services.photoIndex.search(person, of[1]!, 8);
        if (!r.results.length) return done(`Nothing that looks like “${of[1]}” among the ${r.indexed} photos indexed so far.`, "Photos · search on the box");
        return done(`${r.results.length} of the closest matches for “${of[1]}”, from ${r.indexed} indexed photos:`, "Photos · search on the box", { items: r.results.map((p) => ({ title: p.name, detail: p.takenAt ? new Date(p.takenAt).toLocaleDateString() : "no date", href: `/dashboard/photos` })) });
      }
      if (of) return done(`Photo search by what is in the picture needs the model on the box; turn it on from Photos. Meanwhile: ${stats.total} photos, ${stats.newThisWeek} new this week.`, "Photos");
      return done(stats.total === 0 ? "No photos on the box yet. Import a folder or back up a phone from Photos." : `${stats.total} photos on the box, ${stats.newThisWeek} new this week, ${stats.withPlace} with a place.`, "Photos");
    }

    // Files by name.
    const fileQ = /\b(?:file|document|doc|pdf)s?\b.*?(?:called|named|about|for|with)\s+(.+?)[?.!]*$/.exec(t) ?? /\bfind\s+(?:me\s+)?(?:the\s+)?(.+?)[?.!]*$/.exec(t);
    if (/\b(file|document|doc|pdf)s?\b/.test(t) || /^find\b/.test(t)) {
      const needle = fileQ?.[1]?.trim();
      if (!needle) {
        const summary = this.services.files.summary(person, await this.disk());
        const items = summary.byNamespace.reduce((n, x) => n + x.items, 0);
        return done(items === 0 ? "No files on the box yet." : `${items} files on the box, ${fmtBytes(summary.totalBytes)}. Ask for one by name: “find the lease”.`, "Files");
      }
      const hits = this.services.files.search(person, needle, 8);
      if (!hits.length) return done(`Nothing on the box is called anything like “${needle}”. I only look at file names; there is no reading inside documents yet.`, "Files");
      return done(`${hits.length} ${hits.length === 1 ? "file" : "files"} named like “${needle}”:`, "Files", { items: hits.map((f) => ({ title: f.name, detail: `${f.namespace}${f.path} · ${fmtBytes(f.size)}`, href: `/dashboard/files?ns=${f.namespace}&path=${encodeURIComponent(f.path)}` })) });
    }

    // Backups.
    if (/\bback(?:ed)?[ -]?ups?\b/.test(t)) {
      const summary = this.services.files.summary(person, await this.disk());
      if (!summary.sources.length) return done("No device has backed up to this box yet. Install the backup client on a Mac and point it here.", "Backups");
      return done(`${summary.sources.length} ${summary.sources.length === 1 ? "source" : "sources"} back up here:`, "Backups", { items: summary.sources.map((s) => ({ title: s.source, detail: `${s.items} items · ${fmtBytes(s.bytes)} · last ${ago(s.lastAt)}`, href: "/dashboard/files" })) });
    }

    // The box itself.
    if (/\b(storage|space|disk|drive|full)\b/.test(t) || /how (?:is|are) (?:the )?(?:box|core)/.test(t) || /\bstatus\b/.test(t)) {
      const d = await this.disk();
      const alerts = this.services.alerts.list();
      const gate = this.services.gate.cached().state;
      const head = `${fmtBytes(d.usedBytes)} of ${fmtBytes(d.totalBytes)} used, ${fmtBytes(d.freeBytes)} free. The Gate is ${gate}.`;
      if (!alerts.length) return done(`${head} Nothing needs a look.`, "Core");
      return done(`${head} ${alerts.length} ${alerts.length === 1 ? "thing needs" : "things need"} a look:`, "Core", { items: alerts.map((a) => ({ title: a.title, detail: a.detail, href: "/dashboard/core" })) });
    }

    // Routines.
    if (/\broutines?\b|\bautomations?\b/.test(t)) {
      const list = this.services.routines.list(person.householdId);
      if (!list.length) return done("No routines yet. Make one from Home; they run on the box and never cross the Gate.", "Routines");
      return done(`${list.length} ${list.length === 1 ? "routine" : "routines"}, all running on the box:`, "Routines", { items: list.map((r) => ({ title: r.name, detail: `${r.enabled ? "on" : "off"} · ${r.lastResult ?? "never run"}`, href: "/dashboard/home" })) });
    }

    // What happened.
    if (/\b(today|happened|activity|receipts?|crossed|crossings?)\b/.test(t)) {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const rows = this.ledger.since(midnight.toISOString());
      const crossings = rows.filter((r) => r.type === "gate.crossing").length;
      return done(rows.length === 0 ? "Nothing has been written to the ledger today." : `${rows.length} ${rows.length === 1 ? "receipt" : "receipts"} today, ${crossings === 0 ? "none crossed the Gate" : `${crossings} crossed the Gate`}. Every one is in Activity.`, "Ledger", { items: rows.slice(0, 6).map((r) => ({ title: r.type, detail: `${new Date(r.occurredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${r.where}`, href: "/dashboard/activity" })) });
    }

    // People.
    if (/\b(who|people|members?|household)\b/.test(t)) {
      const view = this.services.household.view();
      if (!view.setup) return done("No household on this box yet.", "Household");
      return done(`${view.people.length} ${view.people.length === 1 ? "person" : "people"} in ${view.household.name}:`, "Household", { items: view.people.map((p) => ({ title: p.name, detail: p.role, href: "/dashboard/settings" })) });
    }

    return done(
      "I can only answer from what is on this box: files by name, photos, devices, backups, routines, memory and the receipts. There is no language model here yet and nothing crosses the Gate for a question, so I cannot look that up. Try “find the lease”, “turn the kitchen light off” or “what happened today”.",
      "Rules on the box",
    );
  }

  private pickDevices(t: string, devices: HomeDevice[]): HomeDevice[] {
    const rooms = new Map(this.services.home.rooms().map((r) => [r.id, r.name.toLowerCase()]));
    const byName = devices.filter((d) => t.includes(d.name.toLowerCase()));
    if (byName.length) return byName;
    const byRoom = devices.filter((d) => {
      const room = rooms.get(d.roomId);
      return room ? t.includes(room) : false;
    });
    if (byRoom.length) return byRoom;
    return devices.length === 1 ? devices : [];
  }

  private roomName(d: HomeDevice): string {
    return this.services.home.rooms().find((r) => r.id === d.roomId)?.name ?? "no room";
  }
}

function fmtState(d: HomeDevice): string {
  const s = d.state;
  const parts: string[] = [];
  if (typeof s.on === "boolean") parts.push(s.on ? "on" : "off");
  if (typeof s.brightness === "number") parts.push(`${s.brightness}%`);
  if (typeof s.setpointC === "number") parts.push(`set to ${s.setpointC} °C`);
  if (typeof s.currentC === "number") parts.push(`${s.currentC} °C now`);
  if (typeof s.locked === "boolean") parts.push(s.locked ? "locked" : "unlocked");
  if (!parts.length) parts.push(d.reachable ? "reachable" : "unreachable");
  return parts.join(", ");
}

function fmtBytes(n: number): string {
  if (n < 1e3) return `${n} B`;
  if (n < 1e6) return `${(n / 1e3).toFixed(0)} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(1)} MB`;
  if (n < 1e12) return `${(n / 1e9).toFixed(2)} GB`;
  return `${(n / 1e12).toFixed(2)} TB`;
}

function ago(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return "under an hour ago";
  if (h < 48) return `${Math.round(h)} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}
