const productionSecrets = {
  PROVIDER_CREDENTIAL_ENCRYPTION_KEY: "provider-credential-secret-at-least-32",
  ADMIN_SESSION_SECRET: "admin-session-secret-at-least-32",
  CALLER_KEY_SECRET: "caller-key-secret-at-least-32-chars",
} satisfies NodeJS.ProcessEnv;

type EnvOverrides = Partial<NodeJS.ProcessEnv>;

export const createLocalDevelopmentEnv = (
  overrides: EnvOverrides = {},
): NodeJS.ProcessEnv => ({
  NODE_ENV: "development",
  APP_URL: "http://localhost:3000",
  DEV_DATABASE_URL: "postgresql://dev@localhost:5432/subhub_dev",
  DEV_DATABASE_URL_UNPOOLED:
    "postgresql://dev@localhost:5432/subhub_dev_direct",
  ...productionSecrets,
  ...overrides,
});

export const createVercelProductionEnv = (
  overrides: EnvOverrides = {},
): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  APP_URL: "https://subhub.example.com",
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  DATABASE_URL: "postgresql://prod@neon.tech:5432/subhub",
  DATABASE_URL_UNPOOLED: "postgresql://prod@neon.tech:5432/subhub_direct",
  ...productionSecrets,
  ...overrides,
});

export const createVercelPreviewEnv = (
  overrides: EnvOverrides = {},
): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "preview",
  VERCEL_URL: "preview-subhub-example.vercel.app",
  DATABASE_URL: "postgresql://preview@neon.tech:5432/subhub_preview",
  DATABASE_URL_UNPOOLED:
    "postgresql://preview@neon.tech:5432/subhub_preview_direct",
  ...productionSecrets,
  ...overrides,
});

export const createLocalTestEnv = (
  overrides: EnvOverrides = {},
): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://test@localhost:5432/subhub_test",
  DATABASE_URL_UNPOOLED: "postgresql://test@localhost:5432/subhub_test",
  DATABASE_URL_TEST: "postgresql://test@localhost:5432/subhub_test",
  DATABASE_URL_TEST_UNPOOLED:
    "postgresql://test@localhost:5432/subhub_test",
  ...overrides,
});
