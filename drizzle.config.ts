import { defineConfig } from "drizzle-kit";

const databasePath = process.env.SUBHUB_SQLITE_PATH ?? process.env.SUBHUB_DATABASE_URL ?? ".subhub/subhub.sqlite";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/storage/schema.ts",
  out: "./src/server/storage/migrations",
  dbCredentials: {
    url: databasePath.startsWith("file:") ? databasePath.slice("file:".length) : databasePath,
  },
  strict: true,
  verbose: true,
});
