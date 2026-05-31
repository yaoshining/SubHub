CREATE TABLE "admin_action_results" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_admin_user_id" text,
	"action_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"result" text NOT NULL,
	"message" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_action_results_action_type_check" CHECK ("admin_action_results"."action_type" in ('provider_enabled', 'provider_disabled', 'credential_isolated', 'credential_restored', 'credential_disabled', 'caller_key_suspended', 'caller_key_rotated', 'admin_invitation_created', 'admin_invitation_revoked', 'admin_user_suspended', 'admin_user_restored', 'admin_session_remediated', 'admin_login', 'bootstrap_admin_created')),
	CONSTRAINT "admin_action_results_target_type_check" CHECK ("admin_action_results"."target_type" in ('provider', 'provider_credential', 'caller_key', 'admin_invitation', 'admin_user', 'admin_session', 'auth', 'bootstrap')),
	CONSTRAINT "admin_action_results_result_check" CHECK ("admin_action_results"."result" in ('success', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "admin_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"status" text NOT NULL,
	"role_preset" text NOT NULL,
	"access_preset" text NOT NULL,
	"invited_by_admin_user_id" text NOT NULL,
	"accepted_admin_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_invitations_status_check" CHECK ("admin_invitations"."status" in ('pending', 'accepted', 'expired', 'revoked')),
	CONSTRAINT "admin_invitations_role_preset_check" CHECK ("admin_invitations"."role_preset" in ('admin', 'operator')),
	CONSTRAINT "admin_invitations_access_preset_check" CHECK ("admin_invitations"."access_preset" in ('admin_console'))
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text NOT NULL,
	"session_token_hash" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	"device_label" text,
	"attention_reason" text,
	"remediated_at" timestamp with time zone,
	"remediated_by_admin_user_id" text,
	CONSTRAINT "admin_sessions_status_check" CHECK ("admin_sessions"."status" in ('active', 'revoked', 'expired', 'needs_attention', 'remediated'))
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_users_status_check" CHECK ("admin_users"."status" in ('active', 'suspended')),
	CONSTRAINT "admin_users_role_check" CHECK ("admin_users"."role" in ('admin', 'operator'))
);
--> statement-breakpoint
CREATE TABLE "caller_key_rotations" (
	"id" text PRIMARY KEY NOT NULL,
	"caller_key_id" text NOT NULL,
	"old_key_suffix" text,
	"new_key_suffix" text,
	"result" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"performed_by_admin_user_id" text,
	CONSTRAINT "caller_key_rotations_result_check" CHECK ("caller_key_rotations"."result" in ('success', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "caller_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"caller_name" text NOT NULL,
	"environment" text NOT NULL,
	"scope" text NOT NULL,
	"quota_policy" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text,
	"key_suffix" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_rotated_at" timestamp with time zone,
	"reveal_until" timestamp with time zone,
	"reveal_token_hash" text,
	CONSTRAINT "caller_keys_environment_check" CHECK ("caller_keys"."environment" in ('production', 'staging', 'development')),
	CONSTRAINT "caller_keys_status_check" CHECK ("caller_keys"."status" in ('active', 'suspended', 'rotated')),
	CONSTRAINT "caller_keys_scope_check" CHECK ("caller_keys"."scope" in ('subtitles:read'))
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"label" text NOT NULL,
	"secret_hash" text NOT NULL,
	"secret_encrypted" text NOT NULL,
	"display_prefix" text,
	"display_suffix" text,
	"status" text NOT NULL,
	"remaining_quota" integer,
	"last_used_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error_summary" text,
	"cooldown_until" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "provider_credentials_status_check" CHECK ("provider_credentials"."status" in ('active', 'cooldown', 'isolated', 'disabled', 'exhausted'))
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL,
	"concurrency_limit" integer DEFAULT 1 NOT NULL,
	"rotation_enabled" boolean DEFAULT true NOT NULL,
	"cooldown_seconds" integer DEFAULT 60 NOT NULL,
	"fallback_provider_id" text,
	"last_health_status" text,
	"last_error_summary" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "providers_type_check" CHECK ("providers"."type" in ('opensubtitles')),
	CONSTRAINT "providers_status_check" CHECK ("providers"."status" in ('enabled', 'disabled', 'needs_config', 'degraded'))
);
--> statement-breakpoint
CREATE TABLE "subtitle_download_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"caller_key_id" text,
	"subtitle_ref" text NOT NULL,
	"provider_id" text,
	"credential_id" text,
	"status" text NOT NULL,
	"content_type" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "subtitle_download_requests_status_check" CHECK ("subtitle_download_requests"."status" in ('success', 'not_found', 'service_not_ready', 'unauthorized', 'provider_failed'))
);
--> statement-breakpoint
CREATE TABLE "subtitle_search_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"caller_key_id" text,
	"media_title" text NOT NULL,
	"media_year" integer,
	"season" integer,
	"episode" integer,
	"language" text,
	"status" text NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"provider_id" text,
	"credential_id" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "subtitle_search_requests_status_check" CHECK ("subtitle_search_requests"."status" in ('success', 'no_results', 'service_not_ready', 'unauthorized', 'provider_failed'))
);
--> statement-breakpoint
ALTER TABLE "admin_action_results" ADD CONSTRAINT "admin_action_results_actor_admin_user_id_fk" FOREIGN KEY ("actor_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_admin_user_id_fk" FOREIGN KEY ("invited_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_accepted_admin_user_id_fk" FOREIGN KEY ("accepted_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_remediated_by_admin_user_id_fk" FOREIGN KEY ("remediated_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caller_key_rotations" ADD CONSTRAINT "caller_key_rotations_caller_key_id_fk" FOREIGN KEY ("caller_key_id") REFERENCES "public"."caller_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caller_key_rotations" ADD CONSTRAINT "caller_key_rotations_performed_by_admin_user_id_fk" FOREIGN KEY ("performed_by_admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_fallback_provider_id_fk" FOREIGN KEY ("fallback_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_download_requests" ADD CONSTRAINT "subtitle_download_requests_caller_key_id_fk" FOREIGN KEY ("caller_key_id") REFERENCES "public"."caller_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_download_requests" ADD CONSTRAINT "subtitle_download_requests_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_download_requests" ADD CONSTRAINT "subtitle_download_requests_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."provider_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_search_requests" ADD CONSTRAINT "subtitle_search_requests_caller_key_id_fk" FOREIGN KEY ("caller_key_id") REFERENCES "public"."caller_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_search_requests" ADD CONSTRAINT "subtitle_search_requests_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtitle_search_requests" ADD CONSTRAINT "subtitle_search_requests_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."provider_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_action_results_actor_admin_user_id_created_at_idx" ON "admin_action_results" USING btree ("actor_admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_action_results_target_type_target_id_created_at_idx" ON "admin_action_results" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_action_results_action_type_created_at_idx" ON "admin_action_results" USING btree ("action_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_pending_identifier_unique" ON "admin_invitations" USING btree ("identifier") WHERE "admin_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "admin_invitations_identifier_status_idx" ON "admin_invitations" USING btree ("identifier","status");--> statement-breakpoint
CREATE INDEX "admin_invitations_invited_by_created_at_idx" ON "admin_invitations" USING btree ("invited_by_admin_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_session_token_hash_unique" ON "admin_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_user_id_status_idx" ON "admin_sessions" USING btree ("admin_user_id","status");--> statement-breakpoint
CREATE INDEX "admin_sessions_status_last_seen_at_idx" ON "admin_sessions" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_identifier_unique" ON "admin_users" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "caller_key_rotations_caller_key_id_created_at_idx" ON "caller_key_rotations" USING btree ("caller_key_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "caller_keys_key_hash_unique" ON "caller_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "caller_keys_status_environment_idx" ON "caller_keys" USING btree ("status","environment");--> statement-breakpoint
CREATE INDEX "caller_keys_last_used_at_idx" ON "caller_keys" USING btree ("last_used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_credentials_provider_id_label_unique" ON "provider_credentials" USING btree ("provider_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_credentials_provider_id_secret_hash_unique" ON "provider_credentials" USING btree ("provider_id","secret_hash");--> statement-breakpoint
CREATE INDEX "provider_credentials_provider_id_status_idx" ON "provider_credentials" USING btree ("provider_id","status");--> statement-breakpoint
CREATE INDEX "provider_credentials_provider_id_status_cooldown_until_idx" ON "provider_credentials" USING btree ("provider_id","status","cooldown_until");--> statement-breakpoint
CREATE INDEX "provider_credentials_last_used_at_idx" ON "provider_credentials" USING btree ("last_used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "providers_type_name_unique" ON "providers" USING btree ("type","name");--> statement-breakpoint
CREATE INDEX "providers_type_status_idx" ON "providers" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "providers_status_priority_idx" ON "providers" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "subtitle_download_requests_caller_key_id_created_at_idx" ON "subtitle_download_requests" USING btree ("caller_key_id","created_at");--> statement-breakpoint
CREATE INDEX "subtitle_download_requests_provider_id_created_at_idx" ON "subtitle_download_requests" USING btree ("provider_id","created_at");--> statement-breakpoint
CREATE INDEX "subtitle_download_requests_status_created_at_idx" ON "subtitle_download_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "subtitle_search_requests_caller_key_id_created_at_idx" ON "subtitle_search_requests" USING btree ("caller_key_id","created_at");--> statement-breakpoint
CREATE INDEX "subtitle_search_requests_provider_id_created_at_idx" ON "subtitle_search_requests" USING btree ("provider_id","created_at");--> statement-breakpoint
CREATE INDEX "subtitle_search_requests_status_created_at_idx" ON "subtitle_search_requests" USING btree ("status","created_at");