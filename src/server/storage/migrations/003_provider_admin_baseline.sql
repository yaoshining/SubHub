--> statement-breakpoint
-- Migration 003: Provider Admin Baseline
-- Extends providers table to support multi-provider (opensubtitles + xunlei)
-- All DDL runs inside a single transaction (statement-breakpoint preserved for drizzle-kit compatibility)

--> statement-breakpoint
-- 1. Drop old CHECK constraint that only allowed 'opensubtitles'
ALTER TABLE "providers" DROP CONSTRAINT IF EXISTS "providers_type_check";

--> statement-breakpoint
-- 2. Recreate CHECK constraint allowing 'opensubtitles' and 'xunlei'
ALTER TABLE "providers" ADD CONSTRAINT "providers_type_check" CHECK ("providers"."type" IN ('opensubtitles', 'xunlei'));

--> statement-breakpoint
-- 3. Add last_health_checked_at column (nullable, defaults to NULL for existing rows)
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "last_health_checked_at" timestamp with time zone;

--> statement-breakpoint
-- 4. Insert Xunlei default provider row (idempotent via ON CONFLICT)
INSERT INTO "providers" ("id", "name", "type", "status", "priority", "weight", "concurrency_limit", "rotation_enabled", "cooldown_seconds", "fallback_provider_id")
SELECT 'xunlei-default', 'Xunlei', 'xunlei', 'enabled', 5, 1, 1, false, 0, NULL
WHERE NOT EXISTS (SELECT 1 FROM "providers" WHERE "type" = 'xunlei');

--> statement-breakpoint
-- 5. Set last_health_status to 'unknown' for any xunlei row that has NULL health status
UPDATE "providers" SET "last_health_status" = 'unknown' WHERE "type" = 'xunlei' AND "last_health_status" IS NULL;

--> statement-breakpoint
-- 6. Update snapshot version marker for migration tracking
-- (No additional DDL changes)
