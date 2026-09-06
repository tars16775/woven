import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { EventEnvelope, LedgerRow, type EventType, type Where } from "@woven/schema";
import { desc, eq } from "drizzle-orm";
import { monotonicFactory } from "ulid";
import type { Db } from "./db/index.ts";
import { events } from "./db/schema.ts";

const GENESIS = "0".repeat(64);
const nextId = monotonicFactory();

/** Stable JSON: keys sorted at every level so the same event always hashes the same. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(",")}}`;
}

export function hashEvent(prevHash: string, envelope: EventEnvelope): string {
  return createHash("sha256").update(prevHash).update("\n").update(canonicalize(envelope)).digest("hex");
}

export type AppendInput = {
  type: EventType;
  householdId: string;
  actor: EventEnvelope["actor"];
  where: Where;
  target?: string;
  namespace?: EventEnvelope["namespace"];
  sensitivity?: EventEnvelope["sensitivity"];
  causationId?: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
  /** Exactly what left the house, in words. Required for gate events. */
  sent?: string;
};

export type IntegrityReport =
  | { ok: true; rows: number; head: string | null }
  | { ok: false; rows: number; brokenAtSeq: number; reason: string };

/**
 * The append-only, hash-chained ledger (ADR 0004). Appends are serialised by
 * SQLite's writer lock and wrapped in a transaction so the chain can never
 * fork: read the head, hash, insert, all or nothing.
 */
export class Ledger extends EventEmitter<{ appended: [LedgerRow] }> {
  constructor(private readonly db: Db) {
    super();
  }

  append(input: AppendInput): LedgerRow {
    if (input.type.startsWith("gate.") && input.type !== "gate.opened" && input.type !== "gate.closed" && !input.sent) {
      throw new Error("a gate crossing must say what was sent");
    }
    const envelope = EventEnvelope.parse({
      id: nextId(),
      type: input.type,
      occurredAt: new Date().toISOString(),
      householdId: input.householdId,
      actor: input.actor,
      target: input.target,
      where: input.where,
      namespace: input.namespace,
      sensitivity: input.sensitivity ?? "normal",
      causationId: input.causationId,
      correlationId: input.correlationId,
      payload: input.payload ?? {},
      sent: input.sent,
    });

    const row = this.db.transaction((tx) => {
      const head = tx.select({ hash: events.hash }).from(events).orderBy(desc(events.seq)).limit(1).get();
      const prevHash = head?.hash ?? GENESIS;
      const hash = hashEvent(prevHash, envelope);
      const inserted = tx
        .insert(events)
        .values({
          id: envelope.id,
          type: envelope.type,
          occurredAt: envelope.occurredAt,
          householdId: envelope.householdId,
          actorKind: envelope.actor.kind,
          actorId: envelope.actor.id,
          target: envelope.target ?? null,
          where: envelope.where,
          namespace: envelope.namespace ?? null,
          sensitivity: envelope.sensitivity,
          causationId: envelope.causationId ?? null,
          correlationId: envelope.correlationId ?? null,
          payload: JSON.stringify(envelope.payload),
          sent: envelope.sent ?? null,
          prevHash,
          hash,
        })
        .returning({ seq: events.seq })
        .get();
      return LedgerRow.parse({ ...envelope, seq: inserted.seq, prevHash, hash });
    });
    this.emit("appended", row);
    return row;
  }

  /** Most recent rows first, for the Activity page. */
  recent(householdId: string, limit = 50): LedgerRow[] {
    const rows = this.db.select().from(events).where(eq(events.householdId, householdId)).orderBy(desc(events.seq)).limit(limit).all();
    return rows.map(toLedgerRow);
  }

  head(): { seq: number; hash: string } | null {
    const row = this.db.select({ seq: events.seq, hash: events.hash }).from(events).orderBy(desc(events.seq)).limit(1).get();
    return row ?? null;
  }

  /** Walk the whole chain and recompute every hash. Runs nightly and on demand. */
  verify(): IntegrityReport {
    const rows = this.db.select().from(events).orderBy(events.seq).all();
    let prev = GENESIS;
    for (const row of rows) {
      if (row.prevHash !== prev) {
        return { ok: false, rows: rows.length, brokenAtSeq: row.seq, reason: "previous hash does not match" };
      }
      const expected = hashEvent(prev, envelopeOf(row));
      if (expected !== row.hash) {
        return { ok: false, rows: rows.length, brokenAtSeq: row.seq, reason: "row content does not match its hash" };
      }
      prev = row.hash;
    }
    return { ok: true, rows: rows.length, head: rows.length ? prev : null };
  }
}

type Row = typeof events.$inferSelect;

function envelopeOf(row: Row): EventEnvelope {
  return EventEnvelope.parse({
    id: row.id,
    type: row.type,
    occurredAt: row.occurredAt,
    householdId: row.householdId,
    actor: { kind: row.actorKind, id: row.actorId },
    target: row.target ?? undefined,
    where: row.where,
    namespace: row.namespace ?? undefined,
    sensitivity: row.sensitivity,
    causationId: row.causationId ?? undefined,
    correlationId: row.correlationId ?? undefined,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    sent: row.sent ?? undefined,
  });
}

function toLedgerRow(row: Row): LedgerRow {
  return LedgerRow.parse({ ...envelopeOf(row), seq: row.seq, prevHash: row.prevHash, hash: row.hash });
}
