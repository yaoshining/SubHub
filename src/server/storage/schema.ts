import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const adminUserStatuses = ['active', 'suspended'] as const;
export const adminRoles = ['admin', 'operator'] as const;
export const adminInvitationStatuses = ['pending', 'accepted', 'expired', 'revoked'] as const;
export const adminSessionStatuses = [
  'active',
  'revoked',
  'expired',
  'needs_attention',
  'remediated',
] as const;
export const providerTypes = ['opensubtitles'] as const;
export const providerStatuses = ['enabled', 'disabled', 'needs_config', 'degraded'] as const;
export const providerCredentialStatuses = [
  'active',
  'cooldown',
  'isolated',
  'disabled',
  'exhausted',
] as const;
export const callerKeyEnvironments = ['production', 'staging', 'development'] as const;
export const callerKeyStatuses = ['active', 'suspended', 'rotated'] as const;
export const callerKeyRotationResults = ['success', 'failed'] as const;
export const subtitleSearchStatuses = [
  'success',
  'no_results',
  'service_not_ready',
  'unauthorized',
  'provider_failed',
] as const;
export const subtitleDownloadStatuses = [
  'success',
  'not_found',
  'service_not_ready',
  'unauthorized',
  'provider_failed',
] as const;
export const adminActionTargetTypes = [
  'provider',
  'provider_credential',
  'caller_key',
  'admin_invitation',
  'admin_user',
  'admin_session',
  'auth',
  'bootstrap',
] as const;
export const adminActionResults = ['success', 'failed'] as const;
export const adminActionTypes = [
  'provider_enabled',
  'provider_disabled',
  'credential_isolated',
  'credential_restored',
  'caller_key_suspended',
  'caller_key_rotated',
  'admin_invitation_created',
  'admin_invitation_revoked',
  'admin_user_suspended',
  'admin_user_restored',
  'admin_session_remediated',
  'admin_login',
  'bootstrap_admin_created',
] as const;

const oneOf = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((value) => `'${value}'`).join(', ')})`);

export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    status: text('status').notNull(),
    role: text('role').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastLoginAt: text('last_login_at'),
  },
  (table) => ({
    identifierUnique: uniqueIndex('admin_users_identifier_unique').on(table.identifier),
    statusCheck: check('admin_users_status_check', oneOf('status', adminUserStatuses)),
    roleCheck: check('admin_users_role_check', oneOf('role', adminRoles)),
  }),
);

export const adminInvitations = sqliteTable(
  'admin_invitations',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    status: text('status').notNull(),
    rolePreset: text('role_preset').notNull(),
    accessPreset: text('access_preset').notNull(),
    invitedByAdminUserId: text('invited_by_admin_user_id')
      .notNull()
      .references(() => adminUsers.id),
    acceptedAdminUserId: text('accepted_admin_user_id').references(() => adminUsers.id),
    expiresAt: text('expires_at').notNull(),
    acceptedAt: text('accepted_at'),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    pendingIdentifierUnique: uniqueIndex('admin_invitations_pending_identifier_unique')
      .on(table.identifier)
      .where(sql`status = 'pending'`),
    invitedByIndex: index('admin_invitations_invited_by_idx').on(table.invitedByAdminUserId),
    acceptedUserIndex: index('admin_invitations_accepted_user_idx').on(table.acceptedAdminUserId),
    statusCheck: check('admin_invitations_status_check', oneOf('status', adminInvitationStatuses)),
    rolePresetCheck: check('admin_invitations_role_preset_check', oneOf('role_preset', adminRoles)),
    accessPresetCheck: check('admin_invitations_access_preset_check', sql`access_preset = 'admin_console'`),
  }),
);

export const adminSessions = sqliteTable(
  'admin_sessions',
  {
    id: text('id').primaryKey(),
    adminUserId: text('admin_user_id')
      .notNull()
      .references(() => adminUsers.id),
    sessionTokenHash: text('session_token_hash').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    lastSeenAt: text('last_seen_at'),
    deviceLabel: text('device_label'),
    attentionReason: text('attention_reason'),
    remediatedAt: text('remediated_at'),
    remediatedByAdminUserId: text('remediated_by_admin_user_id').references(() => adminUsers.id),
  },
  (table) => ({
    sessionTokenHashUnique: uniqueIndex('admin_sessions_token_hash_unique').on(table.sessionTokenHash),
    userStatusIndex: index('admin_sessions_user_status_idx').on(table.adminUserId, table.status),
    statusLastSeenIndex: index('admin_sessions_status_last_seen_idx').on(table.status, table.lastSeenAt),
    expiresAtIndex: index('admin_sessions_expires_at_idx').on(table.expiresAt),
    remediatedByIndex: index('admin_sessions_remediated_by_idx').on(table.remediatedByAdminUserId),
    statusCheck: check('admin_sessions_status_check', oneOf('status', adminSessionStatuses)),
  }),
);

export const providers = sqliteTable(
  'providers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull(),
    priority: integer('priority').notNull().default(100),
    weight: integer('weight').notNull().default(100),
    concurrencyLimit: integer('concurrency_limit').notNull().default(1),
    rotationEnabled: integer('rotation_enabled').notNull().default(1),
    cooldownSeconds: integer('cooldown_seconds').notNull().default(60),
    fallbackProviderId: text('fallback_provider_id').references((): any => providers.id),
    lastHealthStatus: text('last_health_status'),
    lastErrorSummary: text('last_error_summary'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    typeNameUnique: uniqueIndex('providers_type_name_unique').on(table.type, table.name),
    typeStatusIndex: index('providers_type_status_idx').on(table.type, table.status),
    statusPriorityIndex: index('providers_status_priority_idx').on(table.status, table.priority),
    fallbackIndex: index('providers_fallback_provider_idx').on(table.fallbackProviderId),
    typeCheck: check('providers_type_check', oneOf('type', providerTypes)),
    statusCheck: check('providers_status_check', oneOf('status', providerStatuses)),
    rotationEnabledCheck: check('providers_rotation_enabled_check', sql`rotation_enabled in (0, 1)`),
    priorityCheck: check('providers_priority_check', sql`priority >= 0`),
    weightCheck: check('providers_weight_check', sql`weight >= 0`),
    concurrencyLimitCheck: check('providers_concurrency_limit_check', sql`concurrency_limit > 0`),
    cooldownSecondsCheck: check('providers_cooldown_seconds_check', sql`cooldown_seconds >= 0`),
  }),
);

export const providerCredentials = sqliteTable(
  'provider_credentials',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    label: text('label').notNull(),
    secretHash: text('secret_hash').notNull(),
    secretEncrypted: text('secret_encrypted').notNull(),
    displayPrefix: text('display_prefix'),
    displaySuffix: text('display_suffix'),
    status: text('status').notNull(),
    remainingQuota: integer('remaining_quota'),
    lastUsedAt: text('last_used_at'),
    lastErrorAt: text('last_error_at'),
    lastErrorSummary: text('last_error_summary'),
    cooldownUntil: text('cooldown_until'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    providerLabelUnique: uniqueIndex('provider_credentials_provider_label_unique').on(table.providerId, table.label),
    providerSecretHashUnique: uniqueIndex('provider_credentials_provider_secret_hash_unique').on(
      table.providerId,
      table.secretHash,
    ),
    providerStatusIndex: index('provider_credentials_provider_status_idx').on(table.providerId, table.status),
    providerStatusCooldownIndex: index('provider_credentials_provider_status_cooldown_idx').on(
      table.providerId,
      table.status,
      table.cooldownUntil,
    ),
    lastUsedAtIndex: index('provider_credentials_last_used_at_idx').on(table.lastUsedAt),
    statusCheck: check('provider_credentials_status_check', oneOf('status', providerCredentialStatuses)),
    remainingQuotaCheck: check('provider_credentials_remaining_quota_check', sql`remaining_quota is null or remaining_quota >= 0`),
  }),
);

export const callerKeys = sqliteTable(
  'caller_keys',
  {
    id: text('id').primaryKey(),
    callerName: text('caller_name').notNull(),
    environment: text('environment').notNull(),
    scope: text('scope').notNull(),
    quotaPolicy: text('quota_policy').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix'),
    keySuffix: text('key_suffix'),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastUsedAt: text('last_used_at'),
    lastRotatedAt: text('last_rotated_at'),
    revealUntil: text('reveal_until'),
    revealTokenHash: text('reveal_token_hash'),
  },
  (table) => ({
    keyHashUnique: uniqueIndex('caller_keys_key_hash_unique').on(table.keyHash),
    statusEnvironmentIndex: index('caller_keys_status_environment_idx').on(table.status, table.environment),
    lastUsedAtIndex: index('caller_keys_last_used_at_idx').on(table.lastUsedAt),
    environmentCheck: check('caller_keys_environment_check', oneOf('environment', callerKeyEnvironments)),
    scopeCheck: check('caller_keys_scope_check', sql`scope = 'subtitles:read'`),
    quotaPolicyCheck: check('caller_keys_quota_policy_check', sql`quota_policy = 'default'`),
    statusCheck: check('caller_keys_status_check', oneOf('status', callerKeyStatuses)),
  }),
);

export const callerKeyRotations = sqliteTable(
  'caller_key_rotations',
  {
    id: text('id').primaryKey(),
    callerKeyId: text('caller_key_id')
      .notNull()
      .references(() => callerKeys.id),
    oldKeySuffix: text('old_key_suffix'),
    newKeySuffix: text('new_key_suffix'),
    result: text('result').notNull(),
    reason: text('reason'),
    createdAt: text('created_at').notNull(),
    performedByAdminUserId: text('performed_by_admin_user_id').references(() => adminUsers.id),
  },
  (table) => ({
    callerKeyCreatedAtIndex: index('caller_key_rotations_key_created_idx').on(table.callerKeyId, table.createdAt),
    performedByIndex: index('caller_key_rotations_performed_by_idx').on(table.performedByAdminUserId),
    resultCheck: check('caller_key_rotations_result_check', oneOf('result', callerKeyRotationResults)),
  }),
);

export const subtitleSearchRequests = sqliteTable(
  'subtitle_search_requests',
  {
    id: text('id').primaryKey(),
    callerKeyId: text('caller_key_id').references(() => callerKeys.id),
    mediaTitle: text('media_title').notNull(),
    mediaYear: integer('media_year'),
    season: integer('season'),
    episode: integer('episode'),
    language: text('language'),
    status: text('status').notNull(),
    resultCount: integer('result_count').notNull().default(0),
    providerId: text('provider_id').references(() => providers.id),
    credentialId: text('credential_id').references(() => providerCredentials.id),
    durationMs: integer('duration_ms'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    callerKeyCreatedAtIndex: index('subtitle_search_requests_caller_key_created_idx').on(table.callerKeyId, table.createdAt),
    providerCreatedAtIndex: index('subtitle_search_requests_provider_created_idx').on(table.providerId, table.createdAt),
    statusCreatedAtIndex: index('subtitle_search_requests_status_created_idx').on(table.status, table.createdAt),
    credentialIndex: index('subtitle_search_requests_credential_idx').on(table.credentialId),
    statusCheck: check('subtitle_search_requests_status_check', oneOf('status', subtitleSearchStatuses)),
    resultCountCheck: check('subtitle_search_requests_result_count_check', sql`result_count >= 0`),
    mediaYearCheck: check('subtitle_search_requests_media_year_check', sql`media_year is null or media_year >= 0`),
    seasonCheck: check('subtitle_search_requests_season_check', sql`season is null or season >= 0`),
    episodeCheck: check('subtitle_search_requests_episode_check', sql`episode is null or episode >= 0`),
    durationMsCheck: check('subtitle_search_requests_duration_ms_check', sql`duration_ms is null or duration_ms >= 0`),
  }),
);

export const subtitleDownloadRequests = sqliteTable(
  'subtitle_download_requests',
  {
    id: text('id').primaryKey(),
    callerKeyId: text('caller_key_id').references(() => callerKeys.id),
    subtitleRef: text('subtitle_ref').notNull(),
    providerId: text('provider_id').references(() => providers.id),
    credentialId: text('credential_id').references(() => providerCredentials.id),
    status: text('status').notNull(),
    contentType: text('content_type'),
    durationMs: integer('duration_ms'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    callerKeyCreatedAtIndex: index('subtitle_download_requests_caller_key_created_idx').on(table.callerKeyId, table.createdAt),
    providerCreatedAtIndex: index('subtitle_download_requests_provider_created_idx').on(table.providerId, table.createdAt),
    statusCreatedAtIndex: index('subtitle_download_requests_status_created_idx').on(table.status, table.createdAt),
    credentialIndex: index('subtitle_download_requests_credential_idx').on(table.credentialId),
    statusCheck: check('subtitle_download_requests_status_check', oneOf('status', subtitleDownloadStatuses)),
    durationMsCheck: check('subtitle_download_requests_duration_ms_check', sql`duration_ms is null or duration_ms >= 0`),
  }),
);

export const adminActionResultsTable = sqliteTable(
  'admin_action_results',
  {
    id: text('id').primaryKey(),
    actorAdminUserId: text('actor_admin_user_id').references(() => adminUsers.id),
    actionType: text('action_type').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    result: text('result').notNull(),
    message: text('message'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    actorCreatedAtIndex: index('admin_action_results_actor_created_idx').on(table.actorAdminUserId, table.createdAt),
    targetCreatedAtIndex: index('admin_action_results_target_created_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    actionCreatedAtIndex: index('admin_action_results_action_created_idx').on(table.actionType, table.createdAt),
    actionTypeCheck: check('admin_action_results_action_type_check', oneOf('action_type', adminActionTypes)),
    targetTypeCheck: check('admin_action_results_target_type_check', oneOf('target_type', adminActionTargetTypes)),
    resultCheck: check('admin_action_results_result_check', oneOf('result', adminActionResults)),
  }),
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
  adminActionResults: adminActionResultsTable,
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
export type NewSubtitleSearchRequest = typeof subtitleSearchRequests.$inferInsert;
export type SubtitleDownloadRequest = typeof subtitleDownloadRequests.$inferSelect;
export type NewSubtitleDownloadRequest = typeof subtitleDownloadRequests.$inferInsert;
export type AdminActionResult = typeof adminActionResultsTable.$inferSelect;
export type NewAdminActionResult = typeof adminActionResultsTable.$inferInsert;
