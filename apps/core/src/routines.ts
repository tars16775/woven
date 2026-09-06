import type { RoutineRun} from "@woven/schema";
import { Routine, type NewRoutine, type Person, type RoutineTrigger } from "@woven/schema";
import { and, eq } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { ActionEngine } from "./actions/engine.ts";
import type { Db } from "./db/index.ts";
import { routines } from "./db/schema.ts";
import type { HouseholdService } from "./household.ts";
import type { Ledger } from "./ledger.ts";
import type { Logger } from "./logger.ts";
import { HouseholdError } from "./household.ts";

const nextId = monotonicFactory();

/**
 * Routines (phase 27). A routine is nothing special: a list of ordinary
 * capability calls run on behalf of the person who made it. Every step
 * goes through the same policy as a tap on the Home page, so a routine can
 * never do what its author could not, and a class D step still asks.
 */
export class RoutineService {
  constructor(
    private readonly db: Db,
    private readonly ledger: Ledger,
    private readonly household: HouseholdService,
    private readonly engine: ActionEngine,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(householdId: string): Routine[] {
    return this.db.select().from(routines).where(eq(routines.householdId, householdId)).orderBy(routines.createdAt).all().map(toRoutine);
  }

  get(householdId: string, id: string): Routine | null {
    const row = this.db.select().from(routines).where(and(eq(routines.id, id), eq(routines.householdId, householdId))).get();
    return row ? toRoutine(row) : null;
  }

  /** The search index follows routines too. */
  onChanged: ((r: Routine) => void) | null = null;
  onRemoved: ((id: string) => void) | null = null;

  create(input: NewRoutine, by: Person): Routine {
    if (by.role === "guest") throw new HouseholdError(400, "Guests cannot make routines.");
    const now = this.now().toISOString();
    const id = nextId();
    this.db.insert(routines).values({ id, householdId: by.householdId, name: input.name, trigger: JSON.stringify(input.trigger), steps: JSON.stringify(input.steps), enabled: input.enabled, createdBy: by.id, createdAt: now, updatedAt: now }).run();
    this.ledger.append({ type: "action.executed", householdId: by.householdId, actor: { kind: "person", id: by.id }, where: "inside", target: id, sensitivity: "low", payload: { capability: "routine.create", planned: { name: input.name, trigger: input.trigger.kind, steps: input.steps.length }, observed: { id } } });
    const made = this.get(by.householdId, id)!;
    this.onChanged?.(made);
    return made;
  }

  update(id: string, patch: { [K in keyof NewRoutine]?: NewRoutine[K] | undefined }, by: Person): Routine {
    const r = this.get(by.householdId, id);
    if (!r) throw new HouseholdError(404, "No such routine.");
    if (by.role !== "owner" && by.id !== r.createdBy) throw new HouseholdError(400, "Only the owner or whoever made it can change a routine.");
    const now = this.now().toISOString();
    this.db
      .update(routines)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.trigger !== undefined ? { trigger: JSON.stringify(patch.trigger) } : {}),
        ...(patch.steps !== undefined ? { steps: JSON.stringify(patch.steps) } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        updatedAt: now,
      })
      .where(eq(routines.id, id))
      .run();
    const changed = this.get(by.householdId, id)!;
    this.onChanged?.(changed);
    return changed;
  }

  remove(id: string, by: Person): void {
    const r = this.get(by.householdId, id);
    if (!r) throw new HouseholdError(404, "No such routine.");
    if (by.role !== "owner" && by.id !== r.createdBy) throw new HouseholdError(400, "Only the owner or whoever made it can delete a routine.");
    this.db.delete(routines).where(eq(routines.id, id)).run();
    this.onRemoved?.(id);
    this.ledger.append({ type: "action.executed", householdId: by.householdId, actor: { kind: "person", id: by.id }, where: "inside", target: id, sensitivity: "low", payload: { capability: "routine.delete", planned: { name: r.name }, observed: {} } });
  }

  /** Run every step on behalf of the routine's author; steps the policy holds for approval stay prepared and show up as cards. */
  async run(id: string, opts: { householdId: string; startedBy: "person" | "schedule" | "presence" | "phrase"; personId?: string }): Promise<RoutineRun> {
    const r = this.get(opts.householdId, id);
    if (!r) throw new HouseholdError(404, "No such routine.");
    const author = this.household.person(r.createdBy);
    if (!author || author.removedAt) throw new HouseholdError(409, "The person who made this routine is no longer in the household.");
    const startedAt = this.now().toISOString();
    const steps: RoutineRun["steps"] = [];
    for (const step of r.steps) {
      try {
        const rec = await this.engine.run(opts.householdId, { kind: "routine", id: r.id, role: author.role }, { capability: step.capability, target: step.target, parameters: step.parameters });
        steps.push({ capability: step.capability, target: step.target, status: rec.status, actionId: rec.id, note: rec.status === "succeeded" ? null : rec.status === "prepared" ? "waiting for approval" : (rec.error ?? rec.decision.reason) });
      } catch (err) {
        steps.push({ capability: step.capability, target: step.target, status: "failed", actionId: null, note: err instanceof Error ? err.message : String(err) });
      }
    }
    const done = steps.filter((s) => s.status === "succeeded").length;
    const waiting = steps.filter((s) => s.status === "prepared").length;
    const summary = waiting ? `${done} of ${steps.length} steps done · ${waiting} waiting for approval` : done === steps.length ? `${done} of ${steps.length} steps done` : `${done} of ${steps.length} steps done · ${steps.length - done} did not run`;
    this.db.update(routines).set({ lastRunAt: startedAt, lastResult: summary }).where(eq(routines.id, id)).run();
    this.ledger.append({
      type: "action.executed",
      householdId: opts.householdId,
      actor: opts.personId ? { kind: "person", id: opts.personId } : { kind: "routine", id: r.id },
      where: "inside",
      target: r.name,
      sensitivity: "low",
      payload: { capability: "routine.run", planned: { steps: steps.length, startedBy: opts.startedBy }, observed: { done, waiting, summary }, onBehalfOf: author.id },
    });
    return { routineId: id, startedAt, steps, summary };
  }

  /** Time triggers due in this minute, across every household on the box. */
  async tick(at: Date = this.now()): Promise<number> {
    const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
    const day = at.getDay();
    let ran = 0;
    for (const row of this.db.select().from(routines).where(eq(routines.enabled, true)).all()) {
      const r = toRoutine(row);
      if (r.trigger.kind !== "time" || r.trigger.at !== hhmm) continue;
      if (r.trigger.days && !r.trigger.days.includes(day)) continue;
      if (r.lastRunAt && r.lastRunAt.slice(0, 16) === at.toISOString().slice(0, 16)) continue; // already ran this minute
      await this.run(r.id, { householdId: r.householdId, startedBy: "schedule" }).catch((err: unknown) => this.logger.warn({ err, routine: r.id }, "scheduled routine failed"));
      ran += 1;
    }
    return ran;
  }

  /** Presence flipped: run what waits for it. */
  async onPresence(adultsHome: boolean): Promise<number> {
    const when: RoutineTrigger & { kind: "presence" } = { kind: "presence", when: adultsHome ? "first_home" : "everyone_away" };
    let ran = 0;
    for (const row of this.db.select().from(routines).where(eq(routines.enabled, true)).all()) {
      const r = toRoutine(row);
      if (r.trigger.kind !== "presence" || r.trigger.when !== when.when) continue;
      await this.run(r.id, { householdId: r.householdId, startedBy: "presence" }).catch((err: unknown) => this.logger.warn({ err, routine: r.id }, "presence routine failed"));
      ran += 1;
    }
    return ran;
  }

  /** "goodnight" from Tandem or the app: the enabled routine with that phrase. */
  byPhrase(householdId: string, phrase: string): Routine | null {
    const p = phrase.trim().toLowerCase();
    return this.list(householdId).find((r) => r.enabled && r.trigger.kind === "phrase" && r.trigger.phrase.toLowerCase() === p) ?? null;
  }

  /** Three routines every new house starts with, against whatever adapter is running. Skipped if any exist. */
  ensureStarters(owner: Person): Routine[] {
    if (this.list(owner.householdId).length) return [];
    const made = [
      this.create({ name: "Goodnight", trigger: { kind: "phrase", phrase: "goodnight" }, enabled: true, steps: [{ capability: "light.set", target: "living.ceiling", parameters: { on: false } }, { capability: "light.set", target: "kitchen.main", parameters: { on: false } }, { capability: "climate.set_temperature", target: "living.thermostat", parameters: { setpointC: 19 } }, { capability: "lock.lock", target: "entry.front-door", parameters: {} }] }, owner),
      this.create({ name: "Leaving", trigger: { kind: "presence", when: "everyone_away" }, enabled: true, steps: [{ capability: "light.set", target: "living.ceiling", parameters: { on: false } }, { capability: "light.set", target: "bed.bedside", parameters: { on: false } }, { capability: "climate.set_temperature", target: "living.thermostat", parameters: { setpointC: 18 } }, { capability: "lock.lock", target: "entry.front-door", parameters: {} }] }, owner),
      this.create({ name: "Arrive", trigger: { kind: "presence", when: "first_home" }, enabled: true, steps: [{ capability: "light.set", target: "entry.porch", parameters: { on: true } }, { capability: "climate.set_temperature", target: "living.thermostat", parameters: { setpointC: 21 } }] }, owner),
    ];
    return made;
  }
}

function toRoutine(row: typeof routines.$inferSelect): Routine {
  return Routine.parse({ ...row, trigger: JSON.parse(row.trigger) as unknown, steps: JSON.parse(row.steps) as unknown });
}
