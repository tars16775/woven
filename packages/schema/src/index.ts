/**
 * @woven/schema
 *
 * Every boundary in Woven is described here once: the core validates input
 * against these, the site types its client from them, and the ledger records
 * shapes that these define. If a shape is not here, it does not cross a
 * boundary.
 */
import { z } from "zod";

/* Identifiers -------------------------------------------------------------- */

/** ULIDs: sortable, 26 chars, Crockford base32. */
export const Ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "expected a ULID");
export type Ulid = z.infer<typeof Ulid>;

/* Household ---------------------------------------------------------------- */

export const Role = z.enum(["owner", "adult", "child", "guest"]);
export type Role = z.infer<typeof Role>;

/**
 * Data namespaces. Retrieval and action authorisation are evaluated per
 * namespace; nothing crosses one implicitly.
 */
export const Namespace = z.enum([
  "household",
  "personal",
  "security",
  "financial",
  "health",
  "work",
  "children",
  "guest",
]);
export type Namespace = z.infer<typeof Namespace>;

export const Household = z.object({
  id: Ulid,
  name: z.string().min(1).max(80),
  createdAt: z.iso.datetime(),
});
export type Household = z.infer<typeof Household>;

export const Person = z.object({
  id: Ulid,
  householdId: Ulid,
  name: z.string().min(1).max(80),
  email: z.email().optional(),
  role: Role,
  createdAt: z.iso.datetime(),
});
export type Person = z.infer<typeof Person>;

/* Risk and capabilities ---------------------------------------------------- */

/** Action risk classes. F and G are unsupported in v1 by design. */
export const RiskClass = z.enum(["A", "B", "C", "D", "E", "F", "G", "H"]);
export type RiskClass = z.infer<typeof RiskClass>;

/** Where something ran or was decided. Mirrors the receipts on the screen. */
export const Where = z.enum(["inside", "device", "policy", "gate"]);
export type Where = z.infer<typeof Where>;

/** A capability name: `domain.action`, e.g. `light.set_brightness`. */
export const CapabilityName = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, "expected domain.action");
export type CapabilityName = z.infer<typeof CapabilityName>;

export const Capability = z.object({
  name: CapabilityName,
  riskClass: RiskClass,
  /** Whether repeating the same call with the same key is safe. */
  idempotent: z.boolean(),
  /** Which state to read back to verify the action, if any. */
  readback: z.string().optional(),
  latency: z.enum(["realtime", "interactive", "background"]),
  description: z.string().max(200),
});
export type Capability = z.infer<typeof Capability>;

/* Actions: prepare → (approve) → execute → verify → receipt ---------------- */

export const ActorRef = z.object({
  kind: z.enum(["person", "agent", "routine", "core"]),
  id: z.string().min(1),
});
export type ActorRef = z.infer<typeof ActorRef>;

export const PrepareAction = z.object({
  actor: ActorRef,
  capability: CapabilityName,
  target: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
  /** Version of the world the caller saw, to detect stale plans. */
  contextVersion: z.number().int().nonnegative().optional(),
});
export type PrepareAction = z.infer<typeof PrepareAction>;

export const PreparedAction = z.object({
  actionId: Ulid,
  riskClass: RiskClass,
  approvalRequired: z.boolean(),
  /** One plain sentence the person will read before approving. */
  preview: z.string().max(280),
  expiresAt: z.iso.datetime(),
});
export type PreparedAction = z.infer<typeof PreparedAction>;

export const ExecutionStatus = z.enum(["pending", "running", "succeeded", "partial", "failed", "rolled_back"]);
export type ExecutionStatus = z.infer<typeof ExecutionStatus>;

/* Ledger ------------------------------------------------------------------- */

export const EventType = z.enum([
  "household.created",
  "person.created",
  "person.removed",
  "session.started",
  "session.ended",
  "action.prepared",
  "action.approved",
  "action.declined",
  "action.executed",
  "action.verified",
  "action.failed",
  "gate.crossing",
  "gate.closed",
  "gate.opened",
  "update.verified",
  "update.installed",
  "memory.created",
  "memory.deleted",
  "core.started",
  "core.integrity_checked",
]);
export type EventType = z.infer<typeof EventType>;

/**
 * The event envelope. Payloads are typed per event elsewhere; the envelope is
 * what the ledger stores and hashes. `sent` describes exactly what crossed
 * the Gate, if anything, in words a person can read.
 */
export const EventEnvelope = z.object({
  id: Ulid,
  type: EventType,
  occurredAt: z.iso.datetime(),
  householdId: Ulid,
  actor: ActorRef,
  target: z.string().optional(),
  where: Where,
  namespace: Namespace.optional(),
  sensitivity: z.enum(["low", "normal", "high"]).default("normal"),
  causationId: Ulid.optional(),
  correlationId: Ulid.optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  sent: z.string().max(500).optional(),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;

/** A stored ledger row: the envelope plus its place in the chain. */
export const LedgerRow = EventEnvelope.extend({
  seq: z.number().int().positive(),
  prevHash: z.string().length(64),
  hash: z.string().length(64),
});
export type LedgerRow = z.infer<typeof LedgerRow>;

/** What the dashboard shows. Never contains secrets or raw content. */
export const Receipt = z.object({
  id: Ulid,
  time: z.iso.datetime(),
  title: z.string().max(80),
  detail: z.string().max(280),
  where: Where,
  actor: z.string().max(80),
  sent: z.string().max(500).optional(),
});
export type Receipt = z.infer<typeof Receipt>;

/* Hardware ----------------------------------------------------------------- */

export const HardwareKind = z.enum(["macos", "linux-box", "linux-generic"]);
export type HardwareKind = z.infer<typeof HardwareKind>;

export const RadioKind = z.enum(["thread", "zigbee", "zwave", "bluetooth", "wifi"]);
export type RadioKind = z.infer<typeof RadioKind>;

export const HardwareIdentity = z.object({
  kind: HardwareKind,
  /** Stable per machine; derived from hardware identifiers, never a serial in the clear. */
  machineId: z.string().length(32),
  model: z.string().max(120),
  memoryBytes: z.number().int().nonnegative(),
  cpu: z.string().max(120),
  os: z.string().max(80),
  features: z.object({
    radios: z.array(RadioKind),
    screen: z.boolean(),
    router: z.boolean(),
    gate: z.enum(["process", "processor"]),
  }),
});
export type HardwareIdentity = z.infer<typeof HardwareIdentity>;

export const Metrics = z.object({
  at: z.iso.datetime(),
  cpuLoad1m: z.number().nonnegative(),
  cpuCount: z.number().int().positive(),
  memoryUsedBytes: z.number().int().nonnegative(),
  memoryTotalBytes: z.number().int().nonnegative(),
  diskUsedBytes: z.number().int().nonnegative(),
  diskTotalBytes: z.number().int().nonnegative(),
  /** Degrees Celsius, or null where the platform does not report it. */
  temperatureC: z.number().nullable(),
  uptimeSeconds: z.number().nonnegative(),
});
export type Metrics = z.infer<typeof Metrics>;

/* Core status -------------------------------------------------------------- */

export const CoreStatus = z.object({
  version: z.string(),
  startedAt: z.iso.datetime(),
  hardware: HardwareIdentity,
  metrics: Metrics,
  gate: z.enum(["open", "closed", "absent"]),
  dataRoot: z.string(),
});
export type CoreStatus = z.infer<typeof CoreStatus>;
