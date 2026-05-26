import type Database from 'better-sqlite3';

export const migrationId = '001_mvp_admin_console';

export const migrationSql = [
  `CREATE TABLE IF NOT EXISTS admin_users (
    id text PRIMARY KEY NOT NULL,
    identifier text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    status text NOT NULL CHECK (status in ('active', 'suspended')),
    role text NOT NULL CHECK (role in ('admin', 'operator')),
    created_at text NOT NULL,
    updated_at text NOT NULL,
    last_login_at text
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS admin_users_identifier_unique ON admin_users (identifier)`,

  `CREATE TABLE IF NOT EXISTS admin_invitations (
    id text PRIMARY KEY NOT NULL,
    identifier text NOT NULL,
    status text NOT NULL CHECK (status in ('pending', 'accepted', 'expired', 'revoked')),
    role_preset text NOT NULL CHECK (role_preset in ('admin', 'operator')),
    access_preset text NOT NULL CHECK (access_preset = 'admin_console'),
    invited_by_admin_user_id text NOT NULL REFERENCES admin_users(id),
    accepted_admin_user_id text REFERENCES admin_users(id),
    expires_at text NOT NULL,
    accepted_at text,
    revoked_at text,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS admin_invitations_pending_identifier_unique ON admin_invitations (identifier) WHERE status = 'pending'`,
  `CREATE INDEX IF NOT EXISTS admin_invitations_invited_by_idx ON admin_invitations (invited_by_admin_user_id)`,
  `CREATE INDEX IF NOT EXISTS admin_invitations_accepted_user_idx ON admin_invitations (accepted_admin_user_id)`,

  `CREATE TABLE IF NOT EXISTS admin_sessions (
    id text PRIMARY KEY NOT NULL,
    admin_user_id text NOT NULL REFERENCES admin_users(id),
    session_token_hash text NOT NULL,
    status text NOT NULL CHECK (status in ('active', 'revoked', 'expired', 'needs_attention', 'remediated')),
    created_at text NOT NULL,
    expires_at text NOT NULL,
    last_seen_at text,
    device_label text,
    attention_reason text,
    remediated_at text,
    remediated_by_admin_user_id text REFERENCES admin_users(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS admin_sessions_token_hash_unique ON admin_sessions (session_token_hash)`,
  `CREATE INDEX IF NOT EXISTS admin_sessions_user_status_idx ON admin_sessions (admin_user_id, status)`,
  `CREATE INDEX IF NOT EXISTS admin_sessions_status_last_seen_idx ON admin_sessions (status, last_seen_at)`,
  `CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at)`,
  `CREATE INDEX IF NOT EXISTS admin_sessions_remediated_by_idx ON admin_sessions (remediated_by_admin_user_id)`,

  `CREATE TABLE IF NOT EXISTS providers (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    type text NOT NULL CHECK (type in ('opensubtitles')),
    status text NOT NULL CHECK (status in ('enabled', 'disabled', 'needs_config', 'degraded')),
    priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
    weight integer NOT NULL DEFAULT 100 CHECK (weight >= 0),
    concurrency_limit integer NOT NULL DEFAULT 1 CHECK (concurrency_limit > 0),
    rotation_enabled integer NOT NULL DEFAULT 1 CHECK (rotation_enabled in (0, 1)),
    cooldown_seconds integer NOT NULL DEFAULT 60 CHECK (cooldown_seconds >= 0),
    fallback_provider_id text REFERENCES providers(id),
    last_health_status text,
    last_error_summary text,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS providers_type_name_unique ON providers (type, name)`,
  `CREATE INDEX IF NOT EXISTS providers_type_status_idx ON providers (type, status)`,
  `CREATE INDEX IF NOT EXISTS providers_status_priority_idx ON providers (status, priority)`,
  `CREATE INDEX IF NOT EXISTS providers_fallback_provider_idx ON providers (fallback_provider_id)`,

  `CREATE TABLE IF NOT EXISTS provider_credentials (
    id text PRIMARY KEY NOT NULL,
    provider_id text NOT NULL REFERENCES providers(id),
    label text NOT NULL,
    secret_hash text NOT NULL,
    secret_encrypted text NOT NULL,
    display_prefix text,
    display_suffix text,
    status text NOT NULL CHECK (status in ('active', 'cooldown', 'isolated', 'disabled', 'exhausted')),
    remaining_quota integer CHECK (remaining_quota is null or remaining_quota >= 0),
    last_used_at text,
    last_error_at text,
    last_error_summary text,
    cooldown_until text,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS provider_credentials_provider_label_unique ON provider_credentials (provider_id, label)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS provider_credentials_provider_secret_hash_unique ON provider_credentials (provider_id, secret_hash)`,
  `CREATE INDEX IF NOT EXISTS provider_credentials_provider_status_idx ON provider_credentials (provider_id, status)`,
  `CREATE INDEX IF NOT EXISTS provider_credentials_provider_status_cooldown_idx ON provider_credentials (provider_id, status, cooldown_until)`,
  `CREATE INDEX IF NOT EXISTS provider_credentials_last_used_at_idx ON provider_credentials (last_used_at)`,

  `CREATE TABLE IF NOT EXISTS caller_keys (
    id text PRIMARY KEY NOT NULL,
    caller_name text NOT NULL,
    environment text NOT NULL CHECK (environment in ('production', 'staging', 'development')),
    scope text NOT NULL CHECK (scope = 'subtitles:read'),
    quota_policy text NOT NULL CHECK (quota_policy = 'default'),
    key_hash text NOT NULL,
    key_prefix text,
    key_suffix text,
    status text NOT NULL CHECK (status in ('active', 'suspended', 'rotated')),
    created_at text NOT NULL,
    updated_at text NOT NULL,
    last_used_at text,
    last_rotated_at text,
    reveal_until text,
    reveal_token_hash text
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS caller_keys_key_hash_unique ON caller_keys (key_hash)`,
  `CREATE INDEX IF NOT EXISTS caller_keys_status_environment_idx ON caller_keys (status, environment)`,
  `CREATE INDEX IF NOT EXISTS caller_keys_last_used_at_idx ON caller_keys (last_used_at)`,

  `CREATE TABLE IF NOT EXISTS caller_key_rotations (
    id text PRIMARY KEY NOT NULL,
    caller_key_id text NOT NULL REFERENCES caller_keys(id),
    old_key_suffix text,
    new_key_suffix text,
    result text NOT NULL CHECK (result in ('success', 'failed')),
    reason text,
    created_at text NOT NULL,
    performed_by_admin_user_id text REFERENCES admin_users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS caller_key_rotations_key_created_idx ON caller_key_rotations (caller_key_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS caller_key_rotations_performed_by_idx ON caller_key_rotations (performed_by_admin_user_id)`,

  `CREATE TABLE IF NOT EXISTS subtitle_search_requests (
    id text PRIMARY KEY NOT NULL,
    caller_key_id text REFERENCES caller_keys(id),
    media_title text NOT NULL,
    media_year integer CHECK (media_year is null or media_year >= 0),
    season integer CHECK (season is null or season >= 0),
    episode integer CHECK (episode is null or episode >= 0),
    language text,
    status text NOT NULL CHECK (status in ('success', 'no_results', 'service_not_ready', 'unauthorized', 'provider_failed')),
    result_count integer NOT NULL DEFAULT 0 CHECK (result_count >= 0),
    provider_id text REFERENCES providers(id),
    credential_id text REFERENCES provider_credentials(id),
    duration_ms integer CHECK (duration_ms is null or duration_ms >= 0),
    created_at text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS subtitle_search_requests_caller_key_created_idx ON subtitle_search_requests (caller_key_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS subtitle_search_requests_provider_created_idx ON subtitle_search_requests (provider_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS subtitle_search_requests_status_created_idx ON subtitle_search_requests (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS subtitle_search_requests_credential_idx ON subtitle_search_requests (credential_id)`,

  `CREATE TABLE IF NOT EXISTS subtitle_download_requests (
    id text PRIMARY KEY NOT NULL,
    caller_key_id text REFERENCES caller_keys(id),
    subtitle_ref text NOT NULL,
    provider_id text REFERENCES providers(id),
    credential_id text REFERENCES provider_credentials(id),
    status text NOT NULL CHECK (status in ('success', 'not_found', 'service_not_ready', 'unauthorized', 'provider_failed')),
    content_type text,
    duration_ms integer CHECK (duration_ms is null or duration_ms >= 0),
    created_at text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS subtitle_download_requests_caller_key_created_idx ON subtitle_download_requests (caller_key_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS subtitle_download_requests_provider_created_idx ON subtitle_download_requests (provider_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS subtitle_download_requests_status_created_idx ON subtitle_download_requests (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS subtitle_download_requests_credential_idx ON subtitle_download_requests (credential_id)`,

  `CREATE TABLE IF NOT EXISTS admin_action_results (
    id text PRIMARY KEY NOT NULL,
    actor_admin_user_id text REFERENCES admin_users(id),
    action_type text NOT NULL CHECK (action_type in ('provider_enabled', 'provider_disabled', 'credential_isolated', 'credential_restored', 'caller_key_suspended', 'caller_key_rotated', 'admin_invitation_created', 'admin_invitation_revoked', 'admin_user_suspended', 'admin_user_restored', 'admin_session_remediated', 'admin_login', 'bootstrap_admin_created')),
    target_type text NOT NULL CHECK (target_type in ('provider', 'provider_credential', 'caller_key', 'admin_invitation', 'admin_user', 'admin_session', 'auth', 'bootstrap')),
    target_id text,
    result text NOT NULL CHECK (result in ('success', 'failed')),
    message text,
    created_at text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS admin_action_results_actor_created_idx ON admin_action_results (actor_admin_user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS admin_action_results_target_created_idx ON admin_action_results (target_type, target_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS admin_action_results_action_created_idx ON admin_action_results (action_type, created_at)`,
] as const;

export function apply001MvpAdminConsoleMigration(sqlite: Database.Database): void {
  sqlite.pragma('foreign_keys = ON');
  sqlite.transaction(() => {
    for (const statement of migrationSql) {
      sqlite.prepare(statement).run();
    }
  })();
}
