import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SQLITE_DATABASE_PATH: z.string().min(1).default("./data/subhub.sqlite"),
  OPENSUBTITLES_API_URL: z.string().url().default("https://api.opensubtitles.com/api/v1"),
  PROVIDER_CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  CALLER_KEY_SECRET: z.string().min(32).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
