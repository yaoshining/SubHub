import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "src/server/storage/migrations/003_extend_providers_schema.sql",
  ),
  "utf8",
);

export const extendProvidersSchemaMigration = {
  id: "003_extend_providers_schema",
  sqlFile: "003_extend_providers_schema.sql",
  generatedBy:
    "手写 migration：扩展 providerTypes 允许 xunlei，添加 last_health_checked_at",
  covers: ["providers"],
} as const;

export async function up(db: PostgresJsDatabase) {
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await db.execute(sql.raw(stmt));
  }
}

export async function down(db: PostgresJsDatabase) {
  await db.execute(
    sql.raw(
      `ALTER TABLE "providers" DROP COLUMN IF EXISTS "last_health_checked_at"`,
    ),
  );
  await db.execute(
    sql.raw(
      `ALTER TABLE "providers" DROP CONSTRAINT IF EXISTS "providers_type_check"`,
    ),
  );
  await db.execute(
    sql.raw(
      `ALTER TABLE "providers" ADD CONSTRAINT "providers_type_check" CHECK ("providers"."type" in ('opensubtitles'))`,
    ),
  );
}
