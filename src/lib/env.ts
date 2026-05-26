import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SQLITE_DATABASE_PATH: z.string().min(1).default("./data/subhub.sqlite"),
  OPENSUBTITLES_API_URL: z
    .string()
    .url()
    .default("https://api.opensubtitles.com/api/v1"),
  PROVIDER_CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  CALLER_KEY_SECRET: z.string().min(32).optional(),
});

const productionSecrets = [
  "PROVIDER_CREDENTIAL_ENCRYPTION_KEY",
  "ADMIN_SESSION_SECRET",
  "CALLER_KEY_SECRET",
] as const;

const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") {
    return;
  }

  for (const key of productionSecrets) {
    if (!env[key]) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} 在 production 环境中必须配置，且长度至少为 32 字符。`,
      });
    }
  }
});

export type AppEnv = z.infer<typeof baseEnvSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
