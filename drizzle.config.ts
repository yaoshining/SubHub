import { defineConfig } from "drizzle-kit";
import { resolveDirectDbUrl } from "./src/lib/db-url";

const databaseUrl = resolveDirectDbUrl();

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
