import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/storage/schema.ts',
  out: './src/server/storage/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.SUBHUB_SQLITE_PATH ?? './data/subhub.sqlite',
  },
  strict: true,
  verbose: true,
});
