import { z } from "zod";

const vercelEnvironmentSchema = z.enum([
  "production",
  "preview",
  "development",
]);

const rawEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  DATABASE_URL_TEST_UNPOOLED: z.string().min(1).optional(),
  DEV_DATABASE_URL: z.string().min(1).optional(),
  DEV_DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
  VERCEL_ENV: vercelEnvironmentSchema.optional(),
  VERCEL_GIT_COMMIT_REF: z.string().trim().min(1).optional(),
  VERCEL_URL: z.string().trim().min(1).optional(),
  OPENSUBTITLES_API_URL: z
    .string()
    .url()
    .default("https://api.opensubtitles.com/api/v3"),
  PROVIDER_CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  CALLER_KEY_SECRET: z.string().min(32).optional(),
});

const productionSecrets = [
  "PROVIDER_CREDENTIAL_ENCRYPTION_KEY",
  "ADMIN_SESSION_SECRET",
  "CALLER_KEY_SECRET",
] as const;

const initialAdminBootstrapEnabledValues = new Set(["1", "true", "yes", "on"]);

export type DeploymentProvider = "vercel" | "local";
export type VercelEnvironment =
  | z.infer<typeof vercelEnvironmentSchema>
  | "none";
export type RuntimeTier = "production" | "staging" | "development";

export type AppEnv = {
  NODE_ENV: z.infer<typeof rawEnvSchema>["NODE_ENV"];
  APP_URL: string;
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED: string;
  OPENSUBTITLES_API_URL: string;
  PROVIDER_CREDENTIAL_ENCRYPTION_KEY?: string;
  ADMIN_SESSION_SECRET?: string;
  CALLER_KEY_SECRET?: string;
  deploymentProvider: DeploymentProvider;
  vercelEnvironment: VercelEnvironment;
  gitBranch: string | null;
  resolvedTier: RuntimeTier;
  isPreviewDeployment: boolean;
  requiresDirectMigrationGate: boolean;
};

const previewDevelopmentBranchPattern =
  /^(preview|feature|agent|copilot|fix|chore|renovate)\//;
const testDatabaseUrl = "test-database-url";
const defaultLocalAppUrl = "http://localhost:3000";

type EnvIssueReporter = (path: string, message: string) => void;

const resolveRuntimeIdentity = (
  env: z.infer<typeof rawEnvSchema>,
  reportIssue: EnvIssueReporter,
) => {
  if (env.NODE_ENV === "test") {
    return {
      deploymentProvider: "local" as const,
      vercelEnvironment: "none" as const,
      gitBranch: null,
      resolvedTier: "development" as const,
      isPreviewDeployment: false,
      requiresDirectMigrationGate: false,
    };
  }

  if (env.VERCEL_ENV === "production") {
    if (env.VERCEL_GIT_COMMIT_REF !== "main") {
      reportIssue(
        "VERCEL_GIT_COMMIT_REF",
        "Vercel Production 部署必须来自 main 分支。",
      );
      return null;
    }

    return {
      deploymentProvider: "vercel" as const,
      vercelEnvironment: "production" as const,
      gitBranch: "main",
      resolvedTier: "production" as const,
      isPreviewDeployment: false,
      requiresDirectMigrationGate: true,
    };
  }

  if (env.VERCEL_ENV === "preview") {
    const gitBranch = env.VERCEL_GIT_COMMIT_REF;

    if (!gitBranch) {
      reportIssue(
        "VERCEL_GIT_COMMIT_REF",
        "Vercel Preview 部署必须提供当前分支名。",
      );
      return null;
    }

    if (gitBranch === "preview") {
      return {
        deploymentProvider: "vercel" as const,
        vercelEnvironment: "preview" as const,
        gitBranch,
        resolvedTier: "staging" as const,
        isPreviewDeployment: true,
        requiresDirectMigrationGate: true,
      };
    }

    if (previewDevelopmentBranchPattern.test(gitBranch)) {
      return {
        deploymentProvider: "vercel" as const,
        vercelEnvironment: "preview" as const,
        gitBranch,
        resolvedTier: "development" as const,
        isPreviewDeployment: true,
        requiresDirectMigrationGate: true,
      };
    }

    reportIssue(
      "VERCEL_GIT_COMMIT_REF",
      "Vercel Preview 仅支持 preview，或命中 preview/*、feature/*、agent/*、copilot/*、fix/*、chore/*、renovate/* 白名单前缀的分支映射。",
    );
    return null;
  }

  if (env.VERCEL_ENV === "development") {
    return {
      deploymentProvider: "vercel" as const,
      vercelEnvironment: "development" as const,
      gitBranch: env.VERCEL_GIT_COMMIT_REF ?? null,
      resolvedTier: "development" as const,
      isPreviewDeployment: false,
      requiresDirectMigrationGate: false,
    };
  }

  if (env.NODE_ENV === "development") {
    return {
      deploymentProvider: "local" as const,
      vercelEnvironment: "none" as const,
      gitBranch: null,
      resolvedTier: "development" as const,
      isPreviewDeployment: false,
      requiresDirectMigrationGate: false,
    };
  }

  reportIssue(
    "VERCEL_ENV",
    "production 部署必须提供可识别的 VERCEL_ENV 与分支身份。",
  );
  return null;
};

const resolveDatabaseUrls = (
  env: z.infer<typeof rawEnvSchema>,
  reportIssue: EnvIssueReporter,
) => {
  if (
    env.NODE_ENV !== "test" &&
    (env.VERCEL_ENV === "development" || env.NODE_ENV === "development")
  ) {
    if (env.DATABASE_URL) {
      reportIssue(
        "DATABASE_URL",
        "本地 development 必须通过 DEV_DATABASE_URL / DEV_DATABASE_URL_UNPOOLED 提供 dev 数据库真源，避免误连非 dev 数据库。",
      );
    }

    if (env.DATABASE_URL_UNPOOLED) {
      reportIssue(
        "DATABASE_URL_UNPOOLED",
        "本地 development 必须通过 DEV_DATABASE_URL / DEV_DATABASE_URL_UNPOOLED 提供 dev 数据库真源，避免误连非 dev 数据库。",
      );
    }

    if (env.DATABASE_URL || env.DATABASE_URL_UNPOOLED) {
      return null;
    }

    if (!env.DEV_DATABASE_URL) {
      reportIssue(
        "DEV_DATABASE_URL",
        "本地 development 必须提供 DEV_DATABASE_URL。",
      );
    }

    if (!env.DEV_DATABASE_URL_UNPOOLED) {
      reportIssue(
        "DEV_DATABASE_URL_UNPOOLED",
        "本地 development 必须提供 DEV_DATABASE_URL_UNPOOLED。",
      );
    }

    if (!env.DEV_DATABASE_URL || !env.DEV_DATABASE_URL_UNPOOLED) {
      return null;
    }

    return {
      DATABASE_URL: env.DEV_DATABASE_URL,
      DATABASE_URL_UNPOOLED: env.DEV_DATABASE_URL_UNPOOLED,
    };
  }

  if (env.VERCEL_ENV && env.NODE_ENV !== "test") {
    if (!env.DATABASE_URL) {
      reportIssue("DATABASE_URL", "当前部署必须注入 DATABASE_URL。");
    }

    if (!env.DATABASE_URL_UNPOOLED) {
      reportIssue(
        "DATABASE_URL_UNPOOLED",
        "当前部署必须注入 DATABASE_URL_UNPOOLED。",
      );
    }

    if (!env.DATABASE_URL || !env.DATABASE_URL_UNPOOLED) {
      return null;
    }

    return {
      DATABASE_URL: env.DATABASE_URL,
      DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED,
    };
  }

  if (env.NODE_ENV === "test") {
    return {
      DATABASE_URL: env.DATABASE_URL ?? testDatabaseUrl,
      DATABASE_URL_UNPOOLED:
        env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL ?? testDatabaseUrl,
    };
  }

  if (!env.DATABASE_URL) {
    reportIssue("DATABASE_URL", "当前部署必须注入 DATABASE_URL。");
  }

  if (!env.DATABASE_URL_UNPOOLED) {
    reportIssue(
      "DATABASE_URL_UNPOOLED",
      "当前部署必须注入 DATABASE_URL_UNPOOLED。",
    );
  }

  if (!env.DATABASE_URL || !env.DATABASE_URL_UNPOOLED) {
    return null;
  }

  return {
    DATABASE_URL: env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED,
  };
};

const resolveAppUrl = (
  env: z.infer<typeof rawEnvSchema>,
  runtimeIdentity: NonNullable<ReturnType<typeof resolveRuntimeIdentity>>,
  reportIssue: EnvIssueReporter,
) => {
  if (env.APP_URL) {
    return env.APP_URL;
  }

  if (
    env.NODE_ENV === "test" ||
    runtimeIdentity.deploymentProvider === "local" ||
    runtimeIdentity.vercelEnvironment === "development"
  ) {
    return defaultLocalAppUrl;
  }

  if (runtimeIdentity.vercelEnvironment === "preview") {
    if (!env.VERCEL_URL) {
      reportIssue(
        "VERCEL_URL",
        "Vercel Preview 部署在未显式提供 APP_URL 时必须提供 VERCEL_URL。",
      );
      return null;
    }

    return `https://${env.VERCEL_URL}`;
  }

  reportIssue("APP_URL", "Production 部署必须显式提供 APP_URL。");
  return null;
};

const envSchema = rawEnvSchema.superRefine((env, ctx) => {
  const reportIssue: EnvIssueReporter = (path, message) => {
    ctx.addIssue({
      code: "custom",
      path: [path],
      message,
    });
  };

  const runtimeIdentity = resolveRuntimeIdentity(env, reportIssue);
  resolveDatabaseUrls(env, reportIssue);

  if (runtimeIdentity) {
    resolveAppUrl(env, runtimeIdentity, reportIssue);
  }

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

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const env = envSchema.parse(source);
  const runtimeIdentity = resolveRuntimeIdentity(env, () => undefined);
  const databaseUrls = resolveDatabaseUrls(env, () => undefined);
  const appUrl =
    runtimeIdentity && resolveAppUrl(env, runtimeIdentity, () => undefined);

  if (!runtimeIdentity || !databaseUrls || !appUrl) {
    throw new Error("运行环境解析失败：环境变量未通过预期校验。");
  }

  return {
    NODE_ENV: env.NODE_ENV,
    APP_URL: appUrl,
    DATABASE_URL: databaseUrls.DATABASE_URL,
    DATABASE_URL_UNPOOLED: databaseUrls.DATABASE_URL_UNPOOLED,
    OPENSUBTITLES_API_URL: env.OPENSUBTITLES_API_URL,
    PROVIDER_CREDENTIAL_ENCRYPTION_KEY: env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
    ADMIN_SESSION_SECRET: env.ADMIN_SESSION_SECRET,
    CALLER_KEY_SECRET: env.CALLER_KEY_SECRET,
    deploymentProvider: runtimeIdentity.deploymentProvider,
    vercelEnvironment: runtimeIdentity.vercelEnvironment,
    gitBranch: runtimeIdentity.gitBranch,
    resolvedTier: runtimeIdentity.resolvedTier,
    isPreviewDeployment: runtimeIdentity.isPreviewDeployment,
    requiresDirectMigrationGate: runtimeIdentity.requiresDirectMigrationGate,
  };
}

export const isInitialAdminBootstrapAllowed = (
  source: NodeJS.ProcessEnv = process.env,
) => {
  if (source.NODE_ENV === "test") {
    return true;
  }

  const raw = source.ALLOW_INITIAL_ADMIN_BOOTSTRAP?.trim().toLowerCase();
  return raw ? initialAdminBootstrapEnabledValues.has(raw) : false;
};
