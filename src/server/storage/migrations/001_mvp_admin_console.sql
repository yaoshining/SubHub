CREATE TABLE `admin_action_results` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_admin_user_id` text,
	`action_type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`result` text NOT NULL,
	`message` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "admin_action_results_action_type_check" CHECK("admin_action_results"."action_type" in ('provider_enabled', 'provider_disabled', 'credential_isolated', 'credential_restored', 'caller_key_suspended', 'caller_key_rotated', 'admin_invitation_created', 'admin_invitation_revoked', 'admin_user_suspended', 'admin_user_restored', 'admin_session_remediated', 'admin_login', 'bootstrap_admin_created')),
	CONSTRAINT "admin_action_results_target_type_check" CHECK("admin_action_results"."target_type" in ('provider', 'provider_credential', 'caller_key', 'admin_invitation', 'admin_user', 'admin_session', 'auth', 'bootstrap')),
	CONSTRAINT "admin_action_results_result_check" CHECK("admin_action_results"."result" in ('success', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `admin_action_results_actor_admin_user_id_created_at_idx` ON `admin_action_results` (`actor_admin_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_action_results_target_type_target_id_created_at_idx` ON `admin_action_results` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_action_results_action_type_created_at_idx` ON `admin_action_results` (`action_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `admin_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`status` text NOT NULL,
	`role_preset` text NOT NULL,
	`access_preset` text NOT NULL,
	`invited_by_admin_user_id` text NOT NULL,
	`accepted_admin_user_id` text,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`invited_by_admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "admin_invitations_status_check" CHECK("admin_invitations"."status" in ('pending', 'accepted', 'expired', 'revoked')),
	CONSTRAINT "admin_invitations_role_preset_check" CHECK("admin_invitations"."role_preset" in ('admin', 'operator')),
	CONSTRAINT "admin_invitations_access_preset_check" CHECK("admin_invitations"."access_preset" in ('admin_console'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_invitations_pending_identifier_unique` ON `admin_invitations` (`identifier`) WHERE "admin_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `admin_invitations_identifier_status_idx` ON `admin_invitations` (`identifier`,`status`);--> statement-breakpoint
CREATE INDEX `admin_invitations_invited_by_created_at_idx` ON `admin_invitations` (`invited_by_admin_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`session_token_hash` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text,
	`device_label` text,
	`attention_reason` text,
	`remediated_at` text,
	`remediated_by_admin_user_id` text,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`remediated_by_admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "admin_sessions_status_check" CHECK("admin_sessions"."status" in ('active', 'revoked', 'expired', 'needs_attention', 'remediated'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_sessions_session_token_hash_unique` ON `admin_sessions` (`session_token_hash`);--> statement-breakpoint
CREATE INDEX `admin_sessions_admin_user_id_status_idx` ON `admin_sessions` (`admin_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `admin_sessions_status_last_seen_at_idx` ON `admin_sessions` (`status`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `admin_sessions_expires_at_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_login_at` text,
	CONSTRAINT "admin_users_status_check" CHECK("admin_users"."status" in ('active', 'suspended')),
	CONSTRAINT "admin_users_role_check" CHECK("admin_users"."role" in ('admin', 'operator'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_identifier_unique` ON `admin_users` (`identifier`);--> statement-breakpoint
CREATE TABLE `caller_key_rotations` (
	`id` text PRIMARY KEY NOT NULL,
	`caller_key_id` text NOT NULL,
	`old_key_suffix` text,
	`new_key_suffix` text,
	`result` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL,
	`performed_by_admin_user_id` text,
	FOREIGN KEY (`caller_key_id`) REFERENCES `caller_keys`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by_admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "caller_key_rotations_result_check" CHECK("caller_key_rotations"."result" in ('success', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `caller_key_rotations_caller_key_id_created_at_idx` ON `caller_key_rotations` (`caller_key_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `caller_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`caller_name` text NOT NULL,
	`environment` text NOT NULL,
	`scope` text NOT NULL,
	`quota_policy` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text,
	`key_suffix` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_used_at` text,
	`last_rotated_at` text,
	`reveal_until` text,
	`reveal_token_hash` text,
	CONSTRAINT "caller_keys_environment_check" CHECK("caller_keys"."environment" in ('production', 'staging', 'development')),
	CONSTRAINT "caller_keys_status_check" CHECK("caller_keys"."status" in ('active', 'suspended', 'rotated')),
	CONSTRAINT "caller_keys_scope_check" CHECK("caller_keys"."scope" in ('subtitles:read'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `caller_keys_key_hash_unique` ON `caller_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `caller_keys_status_environment_idx` ON `caller_keys` (`status`,`environment`);--> statement-breakpoint
CREATE INDEX `caller_keys_last_used_at_idx` ON `caller_keys` (`last_used_at`);--> statement-breakpoint
CREATE TABLE `provider_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`label` text NOT NULL,
	`secret_hash` text NOT NULL,
	`secret_encrypted` text NOT NULL,
	`display_prefix` text,
	`display_suffix` text,
	`status` text NOT NULL,
	`remaining_quota` integer,
	`last_used_at` text,
	`last_error_at` text,
	`last_error_summary` text,
	`cooldown_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "provider_credentials_status_check" CHECK("provider_credentials"."status" in ('active', 'cooldown', 'isolated', 'disabled', 'exhausted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_credentials_provider_id_label_unique` ON `provider_credentials` (`provider_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_credentials_provider_id_secret_hash_unique` ON `provider_credentials` (`provider_id`,`secret_hash`);--> statement-breakpoint
CREATE INDEX `provider_credentials_provider_id_status_idx` ON `provider_credentials` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_credentials_provider_id_status_cooldown_until_idx` ON `provider_credentials` (`provider_id`,`status`,`cooldown_until`);--> statement-breakpoint
CREATE INDEX `provider_credentials_last_used_at_idx` ON `provider_credentials` (`last_used_at`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`weight` integer DEFAULT 100 NOT NULL,
	`concurrency_limit` integer DEFAULT 1 NOT NULL,
	`rotation_enabled` integer DEFAULT true NOT NULL,
	`cooldown_seconds` integer DEFAULT 60 NOT NULL,
	`fallback_provider_id` text,
	`last_health_status` text,
	`last_error_summary` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`fallback_provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "providers_type_check" CHECK("providers"."type" in ('opensubtitles')),
	CONSTRAINT "providers_status_check" CHECK("providers"."status" in ('enabled', 'disabled', 'needs_config', 'degraded')),
	CONSTRAINT "providers_rotation_enabled_check" CHECK("providers"."rotation_enabled" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providers_type_name_unique` ON `providers` (`type`,`name`);--> statement-breakpoint
CREATE INDEX `providers_type_status_idx` ON `providers` (`type`,`status`);--> statement-breakpoint
CREATE INDEX `providers_status_priority_idx` ON `providers` (`status`,`priority`);--> statement-breakpoint
CREATE TABLE `subtitle_download_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`caller_key_id` text,
	`subtitle_ref` text NOT NULL,
	`provider_id` text,
	`credential_id` text,
	`status` text NOT NULL,
	`content_type` text,
	`duration_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`caller_key_id`) REFERENCES `caller_keys`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credential_id`) REFERENCES `provider_credentials`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "subtitle_download_requests_status_check" CHECK("subtitle_download_requests"."status" in ('success', 'not_found', 'service_not_ready', 'unauthorized', 'provider_failed'))
);
--> statement-breakpoint
CREATE INDEX `subtitle_download_requests_caller_key_id_created_at_idx` ON `subtitle_download_requests` (`caller_key_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `subtitle_download_requests_provider_id_created_at_idx` ON `subtitle_download_requests` (`provider_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `subtitle_download_requests_status_created_at_idx` ON `subtitle_download_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `subtitle_search_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`caller_key_id` text,
	`media_title` text NOT NULL,
	`media_year` integer,
	`season` integer,
	`episode` integer,
	`language` text,
	`status` text NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`provider_id` text,
	`credential_id` text,
	`duration_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`caller_key_id`) REFERENCES `caller_keys`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credential_id`) REFERENCES `provider_credentials`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "subtitle_search_requests_status_check" CHECK("subtitle_search_requests"."status" in ('success', 'no_results', 'service_not_ready', 'unauthorized', 'provider_failed'))
);
--> statement-breakpoint
CREATE INDEX `subtitle_search_requests_caller_key_id_created_at_idx` ON `subtitle_search_requests` (`caller_key_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `subtitle_search_requests_provider_id_created_at_idx` ON `subtitle_search_requests` (`provider_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `subtitle_search_requests_status_created_at_idx` ON `subtitle_search_requests` (`status`,`created_at`);