import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const adminUserStatuses = ["active", "suspended"] as const;
export const adminRoles = ["admin", "operator"] as const;
export const adminInvitationStatuses = [
  "pending",
  "accepted",
  "expired",
  "revoked",
] as const;
export const adminSessionStatuses = [
  "active",
  "revoked",
  "expired",
  "needs_attention",
  "remediated",
] as const;
export const providerTypes = ["opensubtitles", "xunlei"] as const;
export const providerStatuses = [
  "enabled",
  "disabled",
  "needs_config",
  "degraded",
] as const;
export const providerCredentialStatuses = [
  "active",
  "cooldown",
  "isolated",
  "disabled",
  "exhausted",
] as const;
export const callerKeyEnvironments = [
  "production",
  "staging",
  "development",
] as const;
export const callerKeyStatuses = ["active", "suspended", "rotated"] as const;
export const callerKeyRotationResults = ["success", "failed"] as const;
export const subtitleSearchStatuses = [
  "success",
  "no_results",
  "service_not_ready",
  "unauthorized",
  "provider_failed",
] as const;
export const subtitleDownloadStatuses = [
  "success",
  "not_found",
  "service_not_ready",
  "unauthorized",
  "provider_failed",
] as const;
export const adminActionTargetTypes = [
  "provider",
  "provider_credential",
  "caller_key",
  "admin_invitation",
  "admin_user",
  "admin_session",
  "auth",
  "bootstrap",
] as const;
export const adminActionResultStatuses = ["success", "failed"] as const;
export const adminActionTypes = [
  "provider_enabled",
  "provider_disabled",
  "credential_isolated",
  "credential_restored",
  "credential_disabled",
  "caller_key_suspended",
  "caller_key_rotated",
  "admin_invitation_created",
  "admin_invitation_revoked",
  "admin_user_suspended",
  "admin_user_restored",
  "admin_session_remediated",
  "admin_login",
  "bootstrap_admin_created",
] as const;

const quoteSqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;

const inSet = (column: unknown, values: readonly string[]) =>
  sql`${column} in (${sql.raw(values.map(quoteSqlString).join(", "))})`;

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });

export const adminUsers = pgTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status", { enum: adminUserStatuses }).notNull(),
    role: text("role", { enum: adminRoles }).notNull(),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
    lastLoginAt: timestamptz("last_login_at"),
  },
  (table) => [
    uniqueIndex("admin_users_identifier_unique").on(table.identifier),
    check("admin_users_status_check", inSet(table.status, adminUserStatuses)),
    check("admin_users_role_check", inSet(table.role, adminRoles)),
  ],
);

export const adminInvitations = pgTable(
  "admin_invitations",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    status: text("status", { enum: adminInvitationStatuses }).notNull(),
    rolePreset: text("role_preset", { enum: adminRoles }).notNull(),
    accessPreset: text("access_preset").notNull(),
    invitedByAdminUserId: text("invited_by_admin_user_id").notNull(),
    acceptedAdminUserId: text("accepted_admin_user_id"),
    expiresAt: timestamptz("expires_at").notNull(),
    acceptedAt: timestamptz("accepted_at"),
    revokedAt: timestamptz("revoked_at"),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("admin_invitations_pending_identifier_unique")
      .on(table.identifier)
      .where(sql`${table.status} = 'pending'`),
    index("admin_invitations_identifier_status_idx").on(
      table.identifier,
      table.status,
    ),
    index("admin_invitations_invited_by_created_at_idx").on(
      table.invitedByAdminUserId,
      table.createdAt,
    ),
    check(
      "admin_invitations_status_check",
      inSet(table.status, adminInvitationStatuses),
    ),
    check(
      "admin_invitations_role_preset_check",
      inSet(table.rolePreset, adminRoles),
    ),
    check(
      "admin_invitations_access_preset_check",
      sql`${table.accessPreset} in ('admin_console')`,
    ),
    foreignKey({
      columns: [table.invitedByAdminUserId],
      foreignColumns: [adminUsers.id],
      name: "admin_invitations_invited_by_admin_user_id_fk",
    }),
    foreignKey({
      columns: [table.acceptedAdminUserId],
      foreignColumns: [adminUsers.id],
      name: "admin_invitations_accepted_admin_user_id_fk",
    }),
  ],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id").notNull(),
    sessionTokenHash: text("session_token_hash").notNull(),
    status: text("status", { enum: adminSessionStatuses }).notNull(),
    createdAt: timestamptz("created_at").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    lastSeenAt: timestamptz("last_seen_at"),
    deviceLabel: text("device_label"),
    attentionReason: text("attention_reason"),
    remediatedAt: timestamptz("remediated_at"),
    remediatedByAdminUserId: text("remediated_by_admin_user_id"),
  },
  (table) => [
    uniqueIndex("admin_sessions_session_token_hash_unique").on(
      table.sessionTokenHash,
    ),
    index("admin_sessions_admin_user_id_status_idx").on(
      table.adminUserId,
      table.status,
    ),
    index("admin_sessions_status_last_seen_at_idx").on(
      table.status,
      table.lastSeenAt,
    ),
    index("admin_sessions_expires_at_idx").on(table.expiresAt),
    check(
      "admin_sessions_status_check",
      inSet(table.status, adminSessionStatuses),
    ),
    foreignKey({
      columns: [table.adminUserId],
      foreignColumns: [adminUsers.id],
      name: "admin_sessions_admin_user_id_fk",
    }),
    foreignKey({
      columns: [table.remediatedByAdminUserId],
      foreignColumns: [adminUsers.id],
      name: "admin_sessions_remediated_by_admin_user_id_fk",
    }),
  ],
);

export const providers = pgTable(
  "providers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type", { enum: providerTypes }).notNull(),
    status: text("status", { enum: providerStatuses }).notNull(),
    priority: integer("priority").notNull().default(100),
    weight: integer("weight").notNull().default(100),
    concurrencyLimit: integer("concurrency_limit").notNull().default(1),
    rotationEnabled: boolean("rotation_enabled").notNull().default(true),
    cooldownSeconds: integer("cooldown_seconds").notNull().default(60),
    fallbackProviderId: text("fallback_provider_id"),
    lastHealthStatus: text("last_health_status"),
    lastErrorSummary: text("last_error_summary"),
    lastHealthCheckedAt: timestamptz("last_health_checked_at"),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("providers_type_name_unique").on(table.type, table.name),
    index("providers_type_status_idx").on(table.type, table.status),
    index("providers_status_priority_idx").on(table.status, table.priority),
    check("providers_type_check", inSet(table.type, providerTypes)),
    check("providers_status_check", inSet(table.status, providerStatuses)),
    foreignKey({
      columns: [table.fallbackProviderId],
      foreignColumns: [table.id],
      name: "providers_fallback_provider_id_fk",
    }),
  ],
);

export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    label: text("label").notNull(),
    secretHash: text("secret_hash").notNull(),
    secretEncrypted: text("secret_encrypted").notNull(),
    displayPrefix: text("display_prefix"),
    displaySuffix: text("display_suffix"),
    status: text("status", { enum: providerCredentialStatuses }).notNull(),
    remainingQuota: integer("remaining_quota"),
    lastUsedAt: timestamptz("last_used_at"),
    lastErrorAt: timestamptz("last_error_at"),
    lastErrorSummary: text("last_error_summary"),
    cooldownUntil: timestamptz("cooldown_until"),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("provider_credentials_provider_id_label_unique").on(
      table.providerId,
      table.label,
    ),
    uniqueIndex("provider_credentials_provider_id_secret_hash_unique").on(
      table.providerId,
      table.secretHash,
    ),
    index("provider_credentials_provider_id_status_idx").on(
      table.providerId,
      table.status,
    ),
    index("provider_credentials_provider_id_status_cooldown_until_idx").on(
      table.providerId,
      table.status,
      table.cooldownUntil,
    ),
    index("provider_credentials_last_used_at_idx").on(table.lastUsedAt),
    check(
      "provider_credentials_status_check",
      inSet(table.status, providerCredentialStatuses),
    ),
    foreignKey({
      columns: [table.providerId],
      foreignColumns: [providers.id],
      name: "provider_credentials_provider_id_fk",
    }),
  ],
);

export const callerKeys = pgTable(
  "caller_keys",
  {
    id: text("id").primaryKey(),
    callerName: text("caller_name").notNull(),
    environment: text("environment", { enum: callerKeyEnvironments }).notNull(),
    scope: text("scope").notNull(),
    quotaPolicy: text("quota_policy").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix"),
    keySuffix: text("key_suffix"),
    status: text("status", { enum: callerKeyStatuses }).notNull(),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
    lastUsedAt: timestamptz("last_used_at"),
    lastRotatedAt: timestamptz("last_rotated_at"),
    revealUntil: timestamptz("reveal_until"),
    revealTokenHash: text("reveal_token_hash"),
  },
  (table) => [
    uniqueIndex("caller_keys_key_hash_unique").on(table.keyHash),
    index("caller_keys_status_environment_idx").on(
      table.status,
      table.environment,
    ),
    index("caller_keys_last_used_at_idx").on(table.lastUsedAt),
    check(
      "caller_keys_environment_check",
      inSet(table.environment, callerKeyEnvironments),
    ),
    check("caller_keys_status_check", inSet(table.status, callerKeyStatuses)),
    check("caller_keys_scope_check", sql`${table.scope} in ('subtitles:read')`),
  ],
);

export const callerKeyRotations = pgTable(
  "caller_key_rotations",
  {
    id: text("id").primaryKey(),
    callerKeyId: text("caller_key_id").notNull(),
    oldKeySuffix: text("old_key_suffix"),
    newKeySuffix: text("new_key_suffix"),
    result: text("result", { enum: callerKeyRotationResults }).notNull(),
    reason: text("reason"),
    createdAt: timestamptz("created_at").notNull(),
    performedByAdminUserId: text("performed_by_admin_user_id"),
  },
  (table) => [
    index("caller_key_rotations_caller_key_id_created_at_idx").on(
      table.callerKeyId,
      table.createdAt,
    ),
    check(
      "caller_key_rotations_result_check",
      inSet(table.result, callerKeyRotationResults),
    ),
    foreignKey({
      columns: [table.callerKeyId],
      foreignColumns: [callerKeys.id],
      name: "caller_key_rotations_caller_key_id_fk",
    }),
    foreignKey({
      columns: [table.performedByAdminUserId],
      foreignColumns: [adminUsers.id],
      name: "caller_key_rotations_performed_by_admin_user_id_fk",
    }),
  ],
);

export const subtitleSearchRequests = pgTable(
  "subtitle_search_requests",
  {
    id: text("id").primaryKey(),
    callerKeyId: text("caller_key_id"),
    mediaTitle: text("media_title").notNull(),
    mediaYear: integer("media_year"),
    season: integer("season"),
    episode: integer("episode"),
    language: text("language"),
    status: text("status", { enum: subtitleSearchStatuses }).notNull(),
    resultCount: integer("result_count").notNull().default(0),
    providerId: text("provider_id"),
    credentialId: text("credential_id"),
    durationMs: integer("duration_ms"),
    createdAt: timestamptz("created_at").notNull(),
  },
  (table) => [
    index("subtitle_search_requests_caller_key_id_created_at_idx").on(
      table.callerKeyId,
      table.createdAt,
    ),
    index("subtitle_search_requests_provider_id_created_at_idx").on(
      table.providerId,
      table.createdAt,
    ),
    index("subtitle_search_requests_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
    check(
      "subtitle_search_requests_status_check",
      inSet(table.status, subtitleSearchStatuses),
    ),
    foreignKey({
      columns: [table.callerKeyId],
      foreignColumns: [callerKeys.id],
      name: "subtitle_search_requests_caller_key_id_fk",
    }),
    foreignKey({
      columns: [table.providerId],
      foreignColumns: [providers.id],
      name: "subtitle_search_requests_provider_id_fk",
    }),
    foreignKey({
      columns: [table.credentialId],
      foreignColumns: [providerCredentials.id],
      name: "subtitle_search_requests_credential_id_fk",
    }),
  ],
);

export const subtitleDownloadRequests = pgTable(
  "subtitle_download_requests",
  {
    id: text("id").primaryKey(),
    callerKeyId: text("caller_key_id"),
    subtitleRef: text("subtitle_ref").notNull(),
    providerId: text("provider_id"),
    credentialId: text("credential_id"),
    status: text("status", { enum: subtitleDownloadStatuses }).notNull(),
    contentType: text("content_type"),
    durationMs: integer("duration_ms"),
    createdAt: timestamptz("created_at").notNull(),
  },
  (table) => [
    index("subtitle_download_requests_caller_key_id_created_at_idx").on(
      table.callerKeyId,
      table.createdAt,
    ),
    index("subtitle_download_requests_provider_id_created_at_idx").on(
      table.providerId,
      table.createdAt,
    ),
    index("subtitle_download_requests_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
    check(
      "subtitle_download_requests_status_check",
      inSet(table.status, subtitleDownloadStatuses),
    ),
    foreignKey({
      columns: [table.callerKeyId],
      foreignColumns: [callerKeys.id],
      name: "subtitle_download_requests_caller_key_id_fk",
    }),
    foreignKey({
      columns: [table.providerId],
      foreignColumns: [providers.id],
      name: "subtitle_download_requests_provider_id_fk",
    }),
    foreignKey({
      columns: [table.credentialId],
      foreignColumns: [providerCredentials.id],
      name: "subtitle_download_requests_credential_id_fk",
    }),
  ],
);

export const adminActionResults = pgTable(
  "admin_action_results",
  {
    id: text("id").primaryKey(),
    actorAdminUserId: text("actor_admin_user_id"),
    actionType: text("action_type", { enum: adminActionTypes }).notNull(),
    targetType: text("target_type", { enum: adminActionTargetTypes }).notNull(),
    targetId: text("target_id"),
    result: text("result", { enum: adminActionResultStatuses }).notNull(),
    message: text("message"),
    createdAt: timestamptz("created_at").notNull(),
  },
  (table) => [
    index("admin_action_results_actor_admin_user_id_created_at_idx").on(
      table.actorAdminUserId,
      table.createdAt,
    ),
    index("admin_action_results_target_type_target_id_created_at_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    index("admin_action_results_action_type_created_at_idx").on(
      table.actionType,
      table.createdAt,
    ),
    check(
      "admin_action_results_action_type_check",
      inSet(table.actionType, adminActionTypes),
    ),
    check(
      "admin_action_results_target_type_check",
      inSet(table.targetType, adminActionTargetTypes),
    ),
    check(
      "admin_action_results_result_check",
      inSet(table.result, adminActionResultStatuses),
    ),
    foreignKey({
      columns: [table.actorAdminUserId],
      foreignColumns: [adminUsers.id],
      name: "admin_action_results_actor_admin_user_id_fk",
    }),
  ],
);

export const schema = {
  adminUsers,
  adminInvitations,
  adminSessions,
  providers,
  providerCredentials,
  callerKeys,
  callerKeyRotations,
  subtitleSearchRequests,
  subtitleDownloadRequests,
  adminActionResults,
};

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type AdminInvitation = typeof adminInvitations.$inferSelect;
export type NewAdminInvitation = typeof adminInvitations.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type ProviderCredential = typeof providerCredentials.$inferSelect;
export type NewProviderCredential = typeof providerCredentials.$inferInsert;
export type CallerKey = typeof callerKeys.$inferSelect;
export type NewCallerKey = typeof callerKeys.$inferInsert;
export type CallerKeyRotation = typeof callerKeyRotations.$inferSelect;
export type NewCallerKeyRotation = typeof callerKeyRotations.$inferInsert;
export type SubtitleSearchRequest = typeof subtitleSearchRequests.$inferSelect;
export type NewSubtitleSearchRequest =
  typeof subtitleSearchRequests.$inferInsert;
export type SubtitleDownloadRequest =
  typeof subtitleDownloadRequests.$inferSelect;
export type NewSubtitleDownloadRequest =
  typeof subtitleDownloadRequests.$inferInsert;
export type AdminActionResult = typeof adminActionResults.$inferSelect;
export type NewAdminActionResult = typeof adminActionResults.$inferInsert;
