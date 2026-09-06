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

/** A member of the household. Email is null for children without one; removedAt is set instead of deleting. */
export const Person = z.object({
  id: Ulid,
  householdId: Ulid,
  name: z.string().min(1).max(80),
  email: z.email().nullable(),
  role: Role,
  createdAt: z.iso.datetime(),
  removedAt: z.iso.datetime().nullable(),
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

/** Non-secret runtime configuration, shown on the Core page. */
export const CoreConfig = z.object({
  version: z.string(),
  name: z.string(),
  port: z.number().int(),
  origins: z.array(z.string()),
  mdns: z.boolean(),
  tls: z.discriminatedUnion("enabled", [
    z.object({
      enabled: z.literal(true),
      caFingerprint: z.string(),
      caNotAfter: z.iso.datetime(),
      serverNotAfter: z.iso.datetime(),
      names: z.array(z.string()),
      addresses: z.array(z.string()),
      trustUrl: z.url(),
    }),
    z.object({ enabled: z.literal(false) }),
  ]),
});
export type CoreConfig = z.infer<typeof CoreConfig>;

/** GET /v1/household: the household and its living members, or `setup: false` on a fresh box. */
export const HouseholdView = z.discriminatedUnion("setup", [
  z.object({ setup: z.literal(false) }),
  z.object({ setup: z.literal(true), household: Household, people: z.array(Person) }),
]);
export type HouseholdView = z.infer<typeof HouseholdView>;

export const NewPerson = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase().optional(),
  role: Role.exclude(["owner"]),
});
export type NewPerson = z.infer<typeof NewPerson>;

export const SetupHousehold = z.object({
  household: z.string().trim().min(1).max(80),
  owner: z.object({ name: z.string().trim().min(1).max(80), email: z.email().trim().toLowerCase() }),
});
export type SetupHousehold = z.infer<typeof SetupHousehold>;

export const AuthMethod = z.enum(["passkey", "code", "recovery"]);
export type AuthMethod = z.infer<typeof AuthMethod>;

/** GET /v1/auth/session: who is signed in on this device. */
export const SessionView = z.object({
  person: Person,
  household: Household,
  method: AuthMethod,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  /** How many passkeys this person has; zero means "add one now". */
  passkeys: z.number().int().nonnegative(),
});
export type SessionView = z.infer<typeof SessionView>;

/* Actions, approvals, the Gate (phases 12 to 15) ---------------------------- */

export const ActionStatus = z.enum(["prepared", "approved", "declined", "executing", "succeeded", "failed", "expired"]);
export type ActionStatus = z.infer<typeof ActionStatus>;

/** An action as the dashboard sees it, from prepare to receipt. */
export const ActionRecord = z.object({
  id: Ulid,
  householdId: Ulid,
  actor: ActorRef,
  capability: CapabilityName,
  target: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  riskClass: RiskClass,
  namespace: Namespace,
  status: ActionStatus,
  /** One plain sentence the person reads before approving. */
  preview: z.string().max(280),
  decision: z.object({ outcome: z.enum(["allow", "approve", "deny"]), reason: z.string() }),
  approval: z
    .object({ by: z.enum(["self", "adult", "owner"]), factors: z.array(z.enum(["presence", "strong_auth"])), approvedBy: Ulid.nullable(), approvedAt: z.iso.datetime().nullable() })
    .nullable(),
  planned: z.record(z.string(), z.unknown()).nullable(),
  observed: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ActionRecord = z.infer<typeof ActionRecord>;

/** POST /v1/actions/prepare */
export const PrepareRequest = z.object({
  capability: CapabilityName,
  target: z.string().min(1).max(120),
  parameters: z.record(z.string(), z.unknown()).default({}),
  /** Same key, same action: a retried call returns the earlier record instead of acting twice. */
  idempotencyKey: z.string().min(8).max(120).optional(),
});
export type PrepareRequest = z.infer<typeof PrepareRequest>;

/** Class H approvals carry a fresh passkey assertion (strong authentication). */
export const ApproveRequest = z.object({
  assertion: z.object({ key: z.string(), credential: z.record(z.string(), z.unknown()) }).optional(),
});

/** A device as the Home page shows it, from whichever adapter owns it. */
export const DeviceKind = z.enum(["light", "plug", "thermostat", "lock", "sensor", "camera", "robot", "speaker"]);
export const HomeDevice = z.object({
  id: z.string(),
  roomId: z.string(),
  name: z.string(),
  kind: DeviceKind,
  protocol: z.string(),
  reachable: z.boolean(),
  riskClass: RiskClass,
  /** The adapter's current reading: on/off, brightness, setpoint, locked, a sensor value. */
  state: z.record(z.string(), z.unknown()),
  updatedAt: z.iso.datetime(),
});
export type HomeDevice = z.infer<typeof HomeDevice>;
export const HomeRoom = z.object({ id: z.string(), name: z.string(), occupied: z.boolean() });
export type HomeRoom = z.infer<typeof HomeRoom>;
export const HomeState = z.object({
  adapter: z.string(),
  rooms: z.array(HomeRoom),
  devices: z.array(HomeDevice),
  /** Whether an adult is known to be home. Presence satisfies class D. */
  presence: z.object({ adultsHome: z.boolean(), since: z.iso.datetime().nullable(), source: z.string() }),
});
export type HomeState = z.infer<typeof HomeState>;

/** What the dashboard knows about the Gate. */
export const GateStatus = z.object({
  state: z.enum(["open", "closed", "absent"]),
  changedAt: z.iso.datetime().nullable(),
  changedBy: z.string().nullable(),
  allowList: z.array(z.string()),
  crossingsToday: z.number().int().nonnegative(),
  bytesOutToday: z.number().int().nonnegative(),
});
export type GateStatus = z.infer<typeof GateStatus>;

