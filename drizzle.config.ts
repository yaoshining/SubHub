import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED 未配置，无法生成或检查 Postgres migration。");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/storage/schema.ts",
  out: "./src/server/storage/migrations",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
