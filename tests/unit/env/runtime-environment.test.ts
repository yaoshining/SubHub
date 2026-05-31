import { describe, expect, it } from "vitest";

import { readEnv } from "@/lib/env";

const baseSource = {
  NODE_ENV: "production",
  APP_URL: "https://subhub.example.com",
  DATABASE_URL: "pooled-current-deployment",
  DATABASE_URL_UNPOOLED: "direct-current-deployment",
  PROVIDER_CREDENTIAL_ENCRYPTION_KEY: "provider-credential-secret-at-least-32",
  ADMIN_SESSION_SECRET: "admin-session-secret-at-least-32",
  CALLER_KEY_SECRET: "caller-key-secret-at-least-32-chars",
} satisfies NodeJS.ProcessEnv;

describe("readEnv 运行环境映射", () => {
  it("将 main -> Production 解析为 production tier", () => {
    const env = readEnv({
      ...baseSource,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "main",
    });

    expect(env).toMatchObject({
      deploymentProvider: "vercel",
      vercelEnvironment: "production",
      gitBranch: "main",
      resolvedTier: "production",
      isPreviewDeployment: false,
      requiresDirectMigrationGate: true,
      DATABASE_URL: "pooled-current-deployment",
      DATABASE_URL_UNPOOLED: "direct-current-deployment",
    });
  });

  it("将 preview 分支的 Preview 部署解析为 staging tier", () => {
    const env = readEnv({
      ...baseSource,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "preview",
    });

    expect(env).toMatchObject({
      deploymentProvider: "vercel",
      vercelEnvironment: "preview",
      gitBranch: "preview",
      resolvedTier: "staging",
      isPreviewDeployment: true,
      requiresDirectMigrationGate: true,
    });
  });

  it.each(["preview/task-002", "feature/issue-65", "agent/copilot-env-guard"])(
    "将 %s 解析为 development tier",
    (gitBranch) => {
      const env = readEnv({
        ...baseSource,
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: gitBranch,
      });

      expect(env).toMatchObject({
        deploymentProvider: "vercel",
        vercelEnvironment: "preview",
        gitBranch,
        resolvedTier: "development",
        isPreviewDeployment: true,
      });
    },
  );

  it("在部署身份冲突时明确失败", () => {
    expect(() =>
      readEnv({
        ...baseSource,
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "preview",
      }),
    ).toThrowError(/main 分支/);

    expect(() =>
      readEnv({
        ...baseSource,
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "bugfix/unsupported",
      }),
    ).toThrowError(/preview.*feature.*agent/);
  });
});
