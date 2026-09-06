/**
 * The household database. One file per household, SQLite in WAL mode.
 * See ADR 0002 (storage) and ADR 0004 (the ledger is append-only).
 *
 * Conventions: ids are ULIDs as text; times are ISO-8601 UTC text; JSON is
 * stored as text and validated by `@woven/schema` at the boundary, never
 * trusted on read.
 */
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const people = sqliteTable(
  "people",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    name: text("name").notNull(),
    email: text("email"),
    role: text("role", { enum: ["owner", "adult", "child", "guest"] }).notNull(),
    createdAt: text("created_at").notNull(),
    /** Set instead of deleting; the ledger records the removal. */
    removedAt: text("removed_at"),
  },
  (t) => [index("people_household_idx").on(t.householdId), uniqueIndex("people_email_idx").on(t.householdId, t.email)],
);

/** Passkeys and other authenticators. Filled in phase 8. */
export const credentials = sqliteTable(
  "credentials",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id),
    kind: text("kind", { enum: ["passkey", "recovery"] }).notNull(),
    /** WebAuthn credential id, base64url. */
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports"),
    label: text("label"),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [uniqueIndex("credentials_credential_id_idx").on(t.credentialId), index("credentials_person_idx").on(t.personId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id),
    /** Hash of the session token; the token itself is only ever in the cookie. */
    tokenHash: text("token_hash").notNull(),
    deviceLabel: text("device_label"),
    method: text("method", { enum: ["passkey", "code", "recovery"] }).notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_person_idx").on(t.personId)],
);

/**
 * The ledger. Rows are only ever inserted. `seq` is the chain position,
 * `prevHash` is the previous row's hash (64 zeros for the first), `hash`
 * covers prevHash plus the canonical envelope.
 */
export const events = sqliteTable(
  "events",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    id: text("id").notNull(),
    type: text("type").notNull(),
    occurredAt: text("occurred_at").notNull(),
    householdId: text("household_id").notNull(),
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id").notNull(),
    target: text("target"),
    where: text("where", { enum: ["inside", "device", "policy", "gate"] }).notNull(),
    namespace: text("namespace"),
    sensitivity: text("sensitivity", { enum: ["low", "normal", "high"] }).notNull(),
    causationId: text("causation_id"),
    correlationId: text("correlation_id"),
    payload: text("payload").notNull(),
    sent: text("sent"),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    uniqueIndex("events_id_idx").on(t.id),
    index("events_household_time_idx").on(t.householdId, t.occurredAt),
    index("events_type_idx").on(t.type),
  ],
);

/** Content-addressed blobs. The file lives in the store; this row is its receipt. */
export const blobs = sqliteTable("blobs", {
  sha256: text("sha256").primaryKey(),
  size: integer("size").notNull(),
  mime: text("mime"),
  createdAt: text("created_at").notNull(),
});

/** A person's view of a blob: a name in a folder in a namespace. */
export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    ownerId: text("owner_id").notNull().references(() => people.id),
    namespace: text("namespace").notNull(),
    path: text("path").notNull(),
    name: text("name").notNull(),
    sha256: text("sha256").notNull().references(() => blobs.sha256),
    size: integer("size").notNull(),
    mime: text("mime"),
    createdAt: text("created_at").notNull(),
    modifiedAt: text("modified_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("files_owner_path_idx").on(t.ownerId, t.path), index("files_sha_idx").on(t.sha256)],
);

/** Small key-value settings, JSON values validated at the boundary. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
