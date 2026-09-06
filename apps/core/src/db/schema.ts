/**
 * The household database. One file per household, SQLite in WAL mode.
 * See ADR 0002 (storage) and ADR 0004 (the ledger is append-only).
 *
 * Conventions: ids are ULIDs as text; times are ISO-8601 UTC text; JSON is
 * stored as text and validated by `@woven/schema` at the boundary, never
 * trusted on read.
 */
import { blob, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    /** Guests: when their access ends. */
    expiresAt: text("expires_at"),
    /** Storage quota in bytes (gap 24); null means no limit. */
    quotaBytes: integer("quota_bytes"),
  },
  (t) => [index("people_household_idx").on(t.householdId), uniqueIndex("people_email_idx").on(t.householdId, t.email)],
);

/** Passkeys and other authenticators. Filled in phase 8. */
export const credentials = sqliteTable(
  "credentials",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => people.id),
    kind: text("kind", { enum: ["passkey", "recovery", "rescue"] }).notNull(),
    /** WebAuthn credential id, base64url. */
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports"),
    label: text("label"),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    /** Rescue codes (gap 4) are short-lived; passkeys and recovery codes have none. */
    expiresAt: text("expires_at"),
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
    /** A second secret the browser holds outside the cookie jar and sends as a header or a signed URL; a stolen cookie alone is not enough. */
    deviceSecret: text("device_secret"),
    deviceLabel: text("device_label"),
    method: text("method", { enum: ["passkey", "code", "recovery", "token"] }).notNull(),
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
    /** Where it came from: "dashboard", or "backup:<machine>" for the folder-watch client. */
    source: text("source"),
    createdAt: text("created_at").notNull(),
    modifiedAt: text("modified_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("files_owner_path_idx").on(t.ownerId, t.path), index("files_sha_idx").on(t.sha256), index("files_household_ns_idx").on(t.householdId, t.namespace)],
);

/** Resumable uploads (phase 18): chunks land in store/tmp/<id>/ until complete assembles them into one object. */
/** Expiring share links (gap 19): the token's hash, one file, one maker, an expiry and an optional cap. */
export const shares = sqliteTable(
  "shares",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id").notNull().references(() => files.id),
    householdId: text("household_id").notNull().references(() => households.id),
    createdBy: text("created_by").notNull().references(() => people.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    maxDownloads: integer("max_downloads"),
    downloads: integer("downloads").notNull().default(0),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [uniqueIndex("shares_token_idx").on(t.tokenHash), index("shares_file_idx").on(t.fileId)],
);

/** Devices paired for remote access (gap 21): a sealed frame key and the session that signs them in. */
export const remoteDevices = sqliteTable(
  "remote_devices",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    personId: text("person_id").notNull().references(() => people.id),
    label: text("label").notNull(),
    keySealed: text("key_sealed").notNull(),
    sessionId: text("session_id").notNull().references(() => sessions.id),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("remote_devices_person_idx").on(t.personId)],
);

/** Push subscriptions (gap 17): the endpoint and keys sealed under the household key; the host in the clear for the Gate's allow list. */
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    personId: text("person_id").notNull().references(() => people.id),
    host: text("host").notNull(),
    sealed: text("sealed").notNull(),
    label: text("label"),
    createdAt: text("created_at").notNull(),
    lastSentAt: text("last_sent_at"),
    failures: integer("failures").notNull().default(0),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("push_subscriptions_person_idx").on(t.personId)],
);

export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => people.id),
  householdId: text("household_id").notNull(),
  namespace: text("namespace").notNull(),
  path: text("path").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  mime: text("mime"),
  /** What the client says the whole file hashes to; verified on completion when given. */
  sha256: text("sha256"),
  chunkSize: integer("chunk_size").notNull(),
  /** JSON array of chunk indexes received so far. */
  received: text("received").notNull().default("[]"),
  source: text("source"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Invitations (phase 10). The person row is created up front (pending until
 * they hold a passkey); the token is hashed; guests carry an expiry.
 */
export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    personId: text("person_id").notNull().references(() => people.id),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").notNull().references(() => people.id),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [uniqueIndex("invitations_token_idx").on(t.tokenHash), index("invitations_household_idx").on(t.householdId)],
);

/** Small key-value settings, JSON values validated at the boundary. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Actions from prepare to receipt (phases 12 to 14). The ledger holds the
 * receipts; this table holds the live state machine and the exact parameters
 * an approval was given for (paramsHash), so nothing can change after "yes".
 */
export const actions = sqliteTable(
  "actions",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id").notNull(),
    capability: text("capability").notNull(),
    target: text("target").notNull(),
    parameters: text("parameters").notNull(),
    paramsHash: text("params_hash").notNull(),
    riskClass: text("risk_class").notNull(),
    namespace: text("namespace").notNull(),
    status: text("status", { enum: ["prepared", "approved", "declined", "executing", "succeeded", "failed", "expired"] }).notNull(),
    preview: text("preview").notNull(),
    decisionOutcome: text("decision_outcome", { enum: ["allow", "approve", "deny"] }).notNull(),
    decisionReason: text("decision_reason").notNull(),
    approvalBy: text("approval_by", { enum: ["self", "adult", "owner"] }),
    approvalFactors: text("approval_factors"),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    planned: text("planned"),
    observed: text("observed"),
    error: text("error"),
    idempotencyKey: text("idempotency_key"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("actions_household_status_idx").on(t.householdId, t.status),
    uniqueIndex("actions_idempotency_idx").on(t.householdId, t.actorId, t.idempotencyKey),
  ],
);

/** Photos (phase 20): one row per image file, with what EXIF said and the derived thumbnail and preview objects. */
export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id").notNull().references(() => files.id),
    householdId: text("household_id").notNull(),
    ownerId: text("owner_id").notNull(),
    namespace: text("namespace").notNull(),
    sha256: text("sha256").notNull(),
    takenAt: text("taken_at").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    camera: text("camera"),
    lat: real("lat"),
    lon: real("lon"),
    thumbSha: text("thumb_sha").notNull(),
    previewSha: text("preview_sha").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [uniqueIndex("photos_file_idx").on(t.fileId), index("photos_household_taken_idx").on(t.householdId, t.takenAt)],
);

/** Photo embeddings (phase 21): one vector per photo per model, float32 little-endian. */
export const photoEmbeddings = sqliteTable(
  "photo_embeddings",
  {
    photoId: text("photo_id").notNull().references(() => photos.id),
    model: text("model").notNull(),
    vector: blob("vector", { mode: "buffer" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("photo_embeddings_idx").on(t.photoId, t.model)],
);

/** Media (phase 22): what ffprobe said about a video or audio file, and whether a browser can play it as is. */
export const media = sqliteTable(
  "media",
  {
    fileId: text("file_id").primaryKey().references(() => files.id),
    householdId: text("household_id").notNull(),
    kind: text("kind", { enum: ["video", "audio"] }).notNull(),
    durationS: real("duration_s"),
    width: integer("width"),
    height: integer("height"),
    videoCodec: text("video_codec"),
    audioCodec: text("audio_codec"),
    container: text("container"),
    /** True when a browser plays the file as it is; false means the box transcodes on the fly. */
    playable: integer("playable", { mode: "boolean" }).notNull(),
    probedAt: text("probed_at").notNull(),
  },
  (t) => [index("media_household_kind_idx").on(t.householdId, t.kind)],
);

/** Routines (phase 27): a name, a trigger, ordered steps that are ordinary capability calls. */
export const routines = sqliteTable(
  "routines",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    name: text("name").notNull(),
    trigger: text("trigger").notNull(),
    steps: text("steps").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").notNull().references(() => people.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastRunAt: text("last_run_at"),
    lastResult: text("last_result"),
  },
  (t) => [index("routines_household_idx").on(t.householdId)],
);

/**
 * Memory (phase 36): what Tandem may keep about one person. A memory starts
 * as a candidate when the model noticed it; it becomes durable only when the
 * person confirms it or it comes up again. Retention is the person's.
 */
export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    personId: text("person_id").notNull().references(() => people.id),
    text: text("text").notNull(),
    kind: text("kind", { enum: ["fact", "preference", "event", "routine"] }).notNull(),
    status: text("status", { enum: ["candidate", "durable"] }).notNull(),
    source: text("source", { enum: ["person", "tandem"] }).notNull(),
    /** How many times it came up; two makes a candidate durable. */
    seen: integer("seen").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    expiresAt: text("expires_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("memories_person_idx").on(t.personId)],
);

