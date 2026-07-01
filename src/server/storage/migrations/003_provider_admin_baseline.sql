-- Migration 003: Provider Admin Baseline
-- 扩展 providerTypes 为 opensubtitles + xunlei，插入 Xunlei 默认行，追加 lastHealthCheckedAt 列
-- 与 migration 002 一致，采用手写 SQL 以精确控制 DDL 顺序

--> statement-breakpoint
-- 1. 删除旧 CHECK constraint（仅允许 'opensubtitles'）
ALTER TABLE "providers" DROP CONSTRAINT IF EXISTS "providers_type_check";
--> statement-breakpoint

-- 2. 重建 CHECK constraint（允许 'opensubtitles' + 'xunlei'）
ALTER TABLE "providers" ADD CONSTRAINT "providers_type_check" CHECK ("providers"."type" IN ('opensubtitles', 'xunlei'));
--> statement-breakpoint

-- 3. 添加 lastHealthCheckedAt 列（可为 NULL，与 spec FR-15 一致）
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "last_health_checked_at" timestamp with time zone;
--> statement-breakpoint

-- 4. 插入 Xunlei 默认行（幂等：利用 (name, type) unique 约束）
INSERT INTO "providers" ("name", "type", "status", "priority", "weight", "concurrency_limit", "rotation_enabled", "cooldown_seconds", "fallback_provider_id")
VALUES ('Xunlei', 'xunlei', 'enabled', 5, 1, 1, false, 0, NULL)
ON CONFLICT ("name", "type") DO NOTHING;
--> statement-breakpoint

-- 5. 为新 Xunlei 行设置 last_health_status 默认值
UPDATE "providers"
SET "last_health_status" = 'unknown', "last_error_summary" = NULL
WHERE "type" = 'xunlei' AND "last_health_status" IS NULL;
