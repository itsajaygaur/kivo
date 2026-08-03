import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
};
export const users = sqliteTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text(),
  suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
  ...timestamps,
});
export const sessions = sqliteTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const accounts = sqliteTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("account_provider_unique").on(t.providerId, t.accountId),
    index("account_user_idx").on(t.userId),
  ],
);
export const verifications = sqliteTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const passkeys = sqliteTable("passkey", {
  id: text().primaryKey(),
  name: text(),
  publicKey: text("public_key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  counter: integer().notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
  transports: text(),
  aaguid: text(),
  ...timestamps,
});
export const organizations = sqliteTable("organization", {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(),
  suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  ...timestamps,
});
export const members = sqliteTable(
  "member",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text({ enum: ["owner", "admin", "editor", "viewer"] }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("member_org_user_unique").on(t.organizationId, t.userId),
    index("member_user_idx").on(t.userId),
  ],
);
export const invitations = sqliteTable("invitation", {
  id: text().primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text().notNull(),
  role: text().notNull(),
  status: text().notNull().default("pending"),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
});
export const workspaceSettings = sqliteTable("workspace_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  aiProvider: text("ai_provider").notNull().default("workers-ai"),
  encryptedProviderKey: text("encrypted_provider_key"),
  retentionDays: integer("retention_days").notNull().default(30),
  monthlyOcrLimit: integer("monthly_ocr_limit").notNull().default(100),
  maxDocuments: integer("max_documents").notNull().default(250),
  maxStorageBytes: integer("max_storage_bytes").notNull().default(524288000),
  maxMembers: integer("max_members").notNull().default(25),
  ...timestamps,
});
export const collections = sqliteTable(
  "collection",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    color: text().notNull().default("#5b5bd6"),
    restricted: integer({ mode: "boolean" }).notNull().default(false),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [index("collection_org_idx").on(t.organizationId, t.deletedAt)],
);
export const collectionMembers = sqliteTable(
  "collection_member",
  {
    organizationId: text("organization_id").notNull(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.memberId] }),
    index("collection_member_org_idx").on(t.organizationId),
  ],
);
export const documents = sqliteTable(
  "document",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").references(() => collections.id),
    title: text().notNull(),
    filename: text().notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer().notNull(),
    checksum: text().notNull(),
    status: text().notNull().default("uploading"),
    currentVersionId: text("current_version_id"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("document_org_checksum_unique").on(t.organizationId, t.checksum),
    index("document_org_status_idx").on(t.organizationId, t.status, t.deletedAt),
    index("document_collection_idx").on(t.organizationId, t.collectionId),
  ],
);
export const documentVersions = sqliteTable(
  "document_version",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    r2Key: text("r2_key").notNull(),
    checksum: text().notNull(),
    pages: integer(),
    extractedCharacters: integer("extracted_characters").notNull().default(0),
    chunkCount: integer("chunk_count").notNull().default(0),
    status: text().notNull().default("extracting"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("document_version_unique").on(t.documentId, t.version),
    index("version_org_idx").on(t.organizationId, t.status),
  ],
);
export const chunks = sqliteTable(
  "chunk",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    collectionId: text("collection_id"),
    ordinal: integer().notNull(),
    content: text().notNull(),
    heading: text(),
    page: integer(),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    contentHash: text("content_hash").notNull(),
    vectorId: text("vector_id").notNull().unique(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("chunk_version_ordinal_unique").on(t.versionId, t.ordinal),
    index("chunk_org_document_idx").on(t.organizationId, t.documentId),
  ],
);
export const ingestionJobs = sqliteTable(
  "ingestion_job",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    documentId: text("document_id").notNull(),
    versionId: text("version_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    state: text().notNull().default("queued"),
    progress: integer().notNull().default(0),
    attempts: integer().notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("ingestion_org_idempotency_unique").on(t.organizationId, t.idempotencyKey),
    index("ingestion_state_idx").on(t.state, t.updatedAt),
  ],
);
export const conversations = sqliteTable(
  "conversation",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").notNull(),
    title: text().notNull(),
    scopeJson: text("scope_json").notNull().default("{}"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [index("conversation_org_user_idx").on(t.organizationId, t.userId, t.updatedAt)],
);
export const messages = sqliteTable(
  "message",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text().notNull(),
    content: text().notNull(),
    confidence: real(),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    noAnswer: integer("no_answer", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("message_conversation_idx").on(t.organizationId, t.conversationId, t.createdAt)],
);
export const citations = sqliteTable(
  "citation",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull(),
    versionId: text("version_id").notNull(),
    chunkId: text("chunk_id").notNull(),
    page: integer(),
    excerpt: text().notNull(),
    score: real().notNull(),
    ...timestamps,
  },
  (t) => [index("citation_message_idx").on(t.organizationId, t.messageId)],
);
export const feedback = sqliteTable(
  "feedback",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    rating: integer().notNull(),
    reason: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex("feedback_message_user_unique").on(t.messageId, t.userId)],
);
export const apiKeys = sqliteTable(
  "api_key",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    name: text().notNull(),
    prefix: text().notNull(),
    keyHash: text("key_hash").notNull().unique(),
    scopesJson: text("scopes_json").notNull(),
    createdBy: text("created_by").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [index("api_key_org_idx").on(t.organizationId, t.revokedAt)],
);
export const usageDaily = sqliteTable(
  "usage_daily",
  {
    organizationId: text("organization_id").notNull(),
    day: text().notNull(),
    requests: integer().notNull().default(0),
    aiNeurons: real("ai_neurons").notNull().default(0),
    storageBytes: integer("storage_bytes").notNull().default(0),
    vectorDimensions: integer("vector_dimensions").notNull().default(0),
    queueOperations: integer("queue_operations").notNull().default(0),
    noAnswers: integer("no_answers").notNull().default(0),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.day] })],
);
export const auditLogs = sqliteTable(
  "audit_log",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    actorId: text("actor_id"),
    action: text().notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    ipHash: text("ip_hash"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("audit_org_created_idx").on(t.organizationId, t.createdAt)],
);
export const lifecycleJobs = sqliteTable(
  "lifecycle_job",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id").notNull(),
    kind: text().notNull(),
    targetId: text("target_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    state: text().notNull().default("queued"),
    r2Key: text("r2_key"),
    error: text(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("lifecycle_idempotency_unique").on(t.organizationId, t.idempotencyKey),
    index("lifecycle_state_idx").on(t.state, t.expiresAt),
  ],
);
