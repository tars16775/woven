import { createHash } from "node:crypto";
import { ActionRecord, type ActorRef, type Namespace, type Person, type PrepareRequest, type RiskClass, type Role } from "@woven/schema";
import { evaluate, type Decision, type PolicyContext } from "@woven/policy";
import { and, eq, lt } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "../db/index.ts";
import type { AuthMethod } from "@woven/schema";
import { actions } from "../db/schema.ts";
import type { Ledger } from "../ledger.ts";
import type { HomeAdapter, Presence } from "../home/adapter.ts";
import { GateError, type GateClient } from "../gate/client.ts";
import { canonicalize } from "../ledger.ts";
import { capability, type CapabilitySpec } from "./capabilities.ts";

const nextId = monotonicFactory();
const PREPARED_TTL_MS = 10 * 60 * 1000;

export class ActionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export type Approver = Person & { sessionMethod: AuthMethod };

export type EngineDeps = {
  db: Db;
  ledger: Ledger;
  home: HomeAdapter;
  presence: Presence;
  gate: GateClient;
  /** Class E automatic limit and other household policy settings. */
  policy: () => PolicyContext;
  /** Verify a fresh passkey assertion for strong authentication; resolves the person id it belongs to. */
  verifyAssertion: (key: string, credential: Record<string, unknown>) => Promise<string>;
  /** Class H household changes, run only after the approval above. */
  transferOwnership: (fromPersonId: string, toPersonId: string) => { from: string; to: string };
  /** person.recover: a one-time rescue code for someone locked out, issued by the approving adult. */
  recoverPerson: (byPersonId: string, personId: string) => { personId: string; code: string; expiresAt: string };
  /** model.install: fetch every file through the Gate; resolves with what arrived. */
  installModel?: (model: string, actionId: string) => Promise<{ bytes: number; files: number }>;
  now?: () => Date;
};

/**
 * Prepare, approve, execute, verify (phases 12 to 14). The policy decides;
 * this class only enforces what it said, binds approvals to the exact
 * parameters, runs the adapter, reads back, and writes the receipts.
 */
export class ActionEngine {
  private readonly now: () => Date;
  /** One-time secrets an execution produced, handed to the caller once (person.recover). */
  private readonly secrets = new Map<string, string>();
  constructor(private readonly deps: EngineDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  prepare(householdId: string, actor: ActorRef & { role?: Role }, req: PrepareRequest): ActionRecord {
    const spec = capability(req.capability);
    if (!spec) throw new ActionError(404, `No capability called ${req.capability}.`);
    if (spec.riskClass === "F" || spec.riskClass === "G") throw new ActionError(403, "That class of action is not supported on Woven.");
    const parsed = spec.params.safeParse(req.parameters);
    if (!parsed.success) throw new ActionError(400, `Parameters: ${parsed.error.issues.map((i) => `${i.path.join(".") || "value"} ${i.message}`).join("; ")}`);
    const params = parsed.data as Record<string, unknown>;

    if (req.idempotencyKey) {
      const earlier = this.deps.db
        .select()
        .from(actions)
        .where(and(eq(actions.householdId, householdId), eq(actions.actorId, actor.id), eq(actions.idempotencyKey, req.idempotencyKey)))
        .get();
      if (earlier) return toRecord(earlier);
    }

    const namespace = namespaceFor(spec);
    const bounds = spec.bounds?.(params) ?? null;
    let decision: Decision = evaluate(
      {
        // A routine acts with its author's role: it can do what they could, and no more.
        actor: { kind: actor.kind === "routine" && actor.role ? "person" : actor.kind, id: actor.id, ...(actor.role ? { role: actor.role } : {}) },
        riskClass: spec.riskClass,
        capability: spec.name,
        namespace,
        presence: this.deps.presence.get().adultsHome,
        amount: typeof params.amount === "number" ? params.amount : undefined,
      },
      this.deps.policy(),
    );
    if (decision.outcome === "allow" && bounds) decision = { outcome: "approve", reason: bounds, requires: { by: "adult", factors: [], ttlSeconds: 600 } };
    if (decision.outcome === "allow" && spec.alwaysApprove) decision = { outcome: "approve", reason: "Crossings always ask first.", requires: { by: "self", factors: [], ttlSeconds: 300 } };
    if (decision.outcome !== "deny" && spec.executor === "gate" && !["gate.set", "gate.allow", "gate.disallow"].includes(spec.name) && !this.deps.gate.isOpen()) {
      decision = { outcome: "deny", reason: "The Gate is closed. Nothing crosses until it is opened." };
    }

    const now = this.now();
    const id = nextId();
    const status = decision.outcome === "deny" ? "declined" : decision.outcome === "allow" ? "approved" : "prepared";
    const ttl = decision.outcome === "approve" ? decision.requires.ttlSeconds * 1000 : PREPARED_TTL_MS;
    const row: typeof actions.$inferInsert = {
      id,
      householdId,
      actorKind: actor.kind,
      actorId: actor.id,
      capability: spec.name,
      target: req.target,
      parameters: JSON.stringify(params),
      paramsHash: hashParams(spec.name, req.target, params),
      riskClass: spec.riskClass,
      namespace,
      status,
      preview: spec.preview(req.target, params).slice(0, 280),
      decisionOutcome: decision.outcome,
      decisionReason: decision.reason,
      approvalBy: decision.outcome === "approve" ? decision.requires.by : null,
      approvalFactors: decision.outcome === "approve" ? JSON.stringify(decision.requires.factors) : null,
      approvedBy: null,
      approvedAt: null,
      planned: JSON.stringify(params),
      observed: null,
      error: null,
      idempotencyKey: req.idempotencyKey ?? null,
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.deps.db.transaction((tx) => {
      tx.insert(actions).values(row).run();
      this.deps.ledger.append({
        type: decision.outcome === "deny" ? "action.declined" : "action.prepared",
        householdId,
        actor,
        where: "policy",
        target: req.target,
        namespace,
        payload: { actionId: id, capability: spec.name, riskClass: spec.riskClass, outcome: decision.outcome, reason: decision.reason, preview: row.preview },
      });
    });
    return toRecord(this.deps.db.select().from(actions).where(eq(actions.id, id)).get()!);
  }

  get(id: string): ActionRecord | null {
    const row = this.deps.db.select().from(actions).where(eq(actions.id, id)).get();
    return row ? toRecord(this.expireIfDue(row)) : null;
  }

  list(householdId: string, status?: ActionRecord["status"], limit = 50): ActionRecord[] {
    this.expireDue(householdId);
    const rows = this.deps.db
      .select()
      .from(actions)
      .where(status ? and(eq(actions.householdId, householdId), eq(actions.status, status)) : eq(actions.householdId, householdId))
      .orderBy(actions.createdAt)
      .all();
    return rows.slice(-limit).reverse().map(toRecord);
  }

  /** "Yes" from a person who may say it, with the factors the policy asked for, for exactly these parameters. */
  async approve(id: string, approver: Approver, assertion?: { key: string; credential: Record<string, unknown> }): Promise<ActionRecord> {
    const row = this.expireIfDue(this.mustGet(id));
    if (row.status !== "prepared") throw new ActionError(409, `This action is ${row.status}; it cannot be approved.`);
    const by = row.approvalBy ?? "self";
    const factors = JSON.parse(row.approvalFactors ?? "[]") as string[];
    if (by === "owner" && approver.role !== "owner") throw new ActionError(403, "Only the owner can approve this.");
    if (by === "adult" && approver.role !== "owner" && approver.role !== "adult") throw new ActionError(403, "An adult has to approve this.");
    if (by === "self" && approver.id !== row.actorId && approver.role !== "owner" && approver.role !== "adult") throw new ActionError(403, "This is not yours to approve.");
    if (factors.includes("presence") && !this.deps.presence.get().adultsHome) throw new ActionError(403, "Nobody is confirmed home. Presence is required for this.");
    if (factors.includes("strong_auth")) {
      if (!assertion) throw new ActionError(403, "Confirm with your passkey to approve this.");
      const personId = await this.deps.verifyAssertion(assertion.key, assertion.credential);
      if (personId !== approver.id) throw new ActionError(403, "That passkey belongs to someone else.");
    }
    // The approval is for exactly what was previewed. If the stored parameters were altered, the hash disagrees and nothing runs.
    const params = JSON.parse(row.parameters) as Record<string, unknown>;
    if (hashParams(row.capability, row.target, params) !== row.paramsHash) throw new ActionError(409, "The action changed after it was previewed. Start again.");
    const now = this.now().toISOString();
    this.deps.db.transaction((tx) => {
      tx.update(actions).set({ status: "approved", approvedBy: approver.id, approvedAt: now, updatedAt: now }).where(eq(actions.id, id)).run();
      this.deps.ledger.append({
        type: "action.approved",
        householdId: row.householdId,
        actor: { kind: "person", id: approver.id },
        where: "policy",
        target: row.target,
        namespace: row.namespace as Namespace,
        payload: { actionId: id, capability: row.capability, factors, requestedBy: row.actorId },
      });
    });
    return this.get(id)!;
  }

  decline(id: string, person: Person, reason = "declined by a person"): ActionRecord {
    const row = this.mustGet(id);
    if (row.status !== "prepared" && row.status !== "approved") throw new ActionError(409, `This action is ${row.status}.`);
    const now = this.now().toISOString();
    this.deps.db.transaction((tx) => {
      tx.update(actions).set({ status: "declined", decisionReason: reason, updatedAt: now }).where(eq(actions.id, id)).run();
      this.deps.ledger.append({ type: "action.declined", householdId: row.householdId, actor: { kind: "person", id: person.id }, where: "policy", target: row.target, namespace: row.namespace as Namespace, payload: { actionId: id, capability: row.capability, reason } });
    });
    return this.get(id)!;
  }

  /** Run an approved action through its executor, read back, write the receipt. */
  async execute(id: string, by: ActorRef): Promise<ActionRecord> {
    const row = this.expireIfDue(this.mustGet(id));
    if (row.status === "succeeded" && capability(row.capability)?.idempotent) return toRecord(row);
    if (row.status !== "approved") throw new ActionError(409, row.status === "prepared" ? "This action still needs approval." : `This action is ${row.status}.`);
    const spec = capability(row.capability)!;
    const params = JSON.parse(row.parameters) as Record<string, unknown>;
    if (hashParams(row.capability, row.target, params) !== row.paramsHash) throw new ActionError(409, "The action changed after it was approved. Nothing ran.");

    const startedAt = this.now().toISOString();
    this.deps.db.update(actions).set({ status: "executing", updatedAt: startedAt }).where(eq(actions.id, id)).run();
    const household = row.householdId;
    const namespace = row.namespace as Namespace;
    const base = { householdId: household, actor: by, target: row.target, namespace } as const;
    try {
      let observed: Record<string, unknown>;
      let sent: string | undefined;
      let where: "device" | "gate" | "inside" = "device";
       
      switch (spec.executor) {
        case "home":
          observed = await this.deps.home.apply(row.target, spec.name, params);
          break;
        case "gate": {
          where = "gate";
          if (spec.name === "gate.set") {
            observed = await this.deps.gate.setOpen(Boolean(params.open), by.id);
            where = "inside";
          } else if (spec.name === "gate.allow" || spec.name === "gate.disallow") {
            where = "inside";
            const host = String(params.host);
            const status = await this.deps.gate.setAllowed(host, spec.name === "gate.allow", by.id);
            observed = { allowed: spec.name === "gate.allow", allowList: status.allowList };
          } else if (spec.name === "model.install") {
            if (!this.deps.installModel) throw new ActionError(409, "Models are not wired on this core.");
            const r = await this.deps.installModel(String(params.model), id);
            observed = { bytes: r.bytes, files: r.files };
            sent = `A request for the ${String(params.model)} model files. Nothing about the household.`;
          } else if (spec.name === "gate.cross") {
            const r = await this.deps.gate.cross({ actionId: id, host: String(params.host), method: (params.method as "GET" | "POST") ?? "POST", path: typeof params.path === "string" ? params.path : "/", body: params.body as string | undefined });
            observed = { status: r.status, bytesOut: r.bytesOut, bytesIn: r.bytesIn, durationMs: r.durationMs };
            sent = String(params.sent);
          } else {
            const r = await this.deps.gate.cross({ actionId: id, host: row.target, method: "POST", path: "/orders", body: JSON.stringify(params) });
            observed = { status: r.status, bytesOut: r.bytesOut };
            sent = `Order of ${String((params.items as string[]).length)} items, ${String(params.amount)} ${String(params.currency)}, to ${row.target}. No names.`;
          }
          break;
        }
        case "household": {
          where = "inside";
          if (!row.approvedBy) throw new ActionError(403, "This only happens after someone confirms with a passkey.");
          if (spec.name === "household.transfer_ownership") {
            observed = this.deps.transferOwnership(row.approvedBy, String(params.toPersonId));
          } else if (spec.name === "person.recover") {
            const r = this.deps.recoverPerson(row.approvedBy, String(params.personId));
            // The code goes to the approver once, never into the record or the ledger.
            this.secrets.set(id, r.code);
            observed = { personId: r.personId, expiresAt: r.expiresAt };
          } else throw new ActionError(409, `${spec.name} is not wired yet.`);
          break;
        }
        case "core":
          throw new ActionError(409, `${spec.name} is not wired yet.`);
      }
      const verified = spec.readback ? spec.readback.split(",").every((k) => !(k in params) || canonicalize(observed[k]) === canonicalize(params[k])) : true;
      const done = this.now().toISOString();
      this.deps.db.transaction((tx) => {
        tx.update(actions).set({ status: verified ? "succeeded" : "failed", observed: JSON.stringify(observed), error: verified ? null : "Readback did not match the plan.", updatedAt: done }).where(eq(actions.id, id)).run();
        if (where === "gate") {
          this.deps.ledger.append({ ...base, type: "gate.crossing", where: "gate", sensitivity: "high", sent: sent ?? "unknown", payload: { actionId: id, capability: spec.name, observed } });
        }
        this.deps.ledger.append({ ...base, type: verified ? "action.executed" : "action.failed", where, payload: { actionId: id, capability: spec.name, planned: params, observed, approvedBy: row.approvedBy, verified } });
        if (verified && spec.readback) this.deps.ledger.append({ ...base, type: "action.verified", where, sensitivity: "low", payload: { actionId: id, readback: spec.readback } });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const done = this.now().toISOString();
      this.deps.db.transaction((tx) => {
        tx.update(actions).set({ status: "failed", error: message, updatedAt: done }).where(eq(actions.id, id)).run();
        this.deps.ledger.append({ ...base, type: "action.failed", where: spec.executor === "gate" ? "gate" : "device", payload: { actionId: id, capability: spec.name, planned: params, error: message, approvedBy: row.approvedBy } });
      });
      if (err instanceof ActionError) throw err;
      // The Gate's own refusals (closed: 423, not on the allow list: 403) keep their status so the dashboard can say why.
      if (err instanceof GateError && err.status >= 400 && err.status < 500) throw new ActionError(err.status, message);
      throw new ActionError(502, message);
    }
    return this.get(id)!;
  }

  /** prepare + approve-if-allowed + execute for the dashboard's one-tap actions; returns the record whatever happened. */
  async run(householdId: string, actor: ActorRef & { role?: Role }, req: PrepareRequest): Promise<ActionRecord> {
    const prepared = this.prepare(householdId, actor, req);
    if (prepared.status !== "approved") return prepared;
    try {
      return await this.execute(prepared.id, actor);
    } catch (err) {
      // The record already says what went wrong; the one-tap caller reads it from there.
      if (err instanceof ActionError && err.status >= 500) return this.get(prepared.id)!;
      throw err;
    }
  }

  /** The secret an execution produced, if any; gone after this. */
  takeSecret(id: string): string | null {
    const s = this.secrets.get(id) ?? null;
    this.secrets.delete(id);
    return s;
  }

  private mustGet(id: string) {
    const row = this.deps.db.select().from(actions).where(eq(actions.id, id)).get();
    if (!row) throw new ActionError(404, "No such action.");
    return row;
  }

  private expireIfDue(row: typeof actions.$inferSelect) {
    if ((row.status === "prepared" || row.status === "approved") && row.expiresAt <= this.now().toISOString()) {
      const now = this.now().toISOString();
      this.deps.db.update(actions).set({ status: "expired", updatedAt: now }).where(eq(actions.id, row.id)).run();
      return { ...row, status: "expired" as const, updatedAt: now };
    }
    return row;
  }

  private expireDue(householdId: string) {
    const now = this.now().toISOString();
    for (const st of ["prepared", "approved"] as const) {
      this.deps.db.update(actions).set({ status: "expired", updatedAt: now }).where(and(eq(actions.householdId, householdId), eq(actions.status, st), lt(actions.expiresAt, now))).run();
    }
  }
}

export function hashParams(capabilityName: string, target: string, params: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalize({ capability: capabilityName, target, params })).digest("hex");
}

/** Where an action lives: locks and alarms are security, money is financial, the Gate is household, devices are household. */
function namespaceFor(spec: CapabilitySpec): Namespace {
  if (spec.name.startsWith("lock.") || spec.name.startsWith("alarm.")) return "security";
  if (spec.name.startsWith("commerce.")) return "financial";
  return "household";
}

function toRecord(row: typeof actions.$inferSelect): ActionRecord {
  return ActionRecord.parse({
    id: row.id,
    householdId: row.householdId,
    actor: { kind: row.actorKind, id: row.actorId },
    capability: row.capability,
    target: row.target,
    parameters: JSON.parse(row.parameters) as Record<string, unknown>,
    riskClass: row.riskClass as RiskClass,
    namespace: row.namespace,
    status: row.status,
    preview: row.preview,
    decision: { outcome: row.decisionOutcome, reason: row.decisionReason },
    approval: row.approvalBy ? { by: row.approvalBy, factors: JSON.parse(row.approvalFactors ?? "[]") as string[], approvedBy: row.approvedBy, approvedAt: row.approvedAt } : null,
    planned: row.planned ? (JSON.parse(row.planned) as Record<string, unknown>) : null,
    observed: row.observed ? (JSON.parse(row.observed) as Record<string, unknown>) : null,
    error: row.error,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
