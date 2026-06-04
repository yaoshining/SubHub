import { describe, expect, it } from "vitest";

import {
  createLocalTestEnv,
  createVercelPreviewEnv,
  createVercelProductionEnv,
} from "../../helpers/env-scenarios";
import { readEnv } from "@/lib/env";

describe("readEnv 运行环境映射", () => {
  it("将 main -> Production 解析为 production tier", () => {
    const env = readEnv(
      createVercelProductionEnv({
        DATABASE_URL: "pooled-current-deployment",
        DATABASE_URL_UNPOOLED: "direct-current-deployment",
      }),
    );

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
    const env = readEnv(
      createVercelPreviewEnv({
        DATABASE_URL: "pooled-current-deployment",
        DATABASE_URL_UNPOOLED: "direct-current-deployment",
        APP_URL: undefined,
      }),
    );

    expect(env).toMatchObject({
      deploymentProvider: "vercel",
      vercelEnvironment: "preview",
      gitBranch: "preview",
      resolvedTier: "staging",
      isPreviewDeployment: true,
      requiresDirectMigrationGate: true,
      APP_URL: "https://preview-subhub-example.vercel.app",
    });
  });

  it.each(["preview/task-002", "feature/issue-65", "agent/copilot-env-guard"])(
    "将 %s 解析为 development tier",
    (gitBranch) => {
      const env = readEnv({
        ...createVercelPreviewEnv({
          DATABASE_URL: "pooled-current-deployment",
          DATABASE_URL_UNPOOLED: "direct-current-deployment",
          APP_URL: undefined,
        }),
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
        ...createVercelProductionEnv({
          DATABASE_URL: "pooled-current-deployment",
          DATABASE_URL_UNPOOLED: "direct-current-deployment",
        }),
        VERCEL_GIT_COMMIT_REF: "preview",
      }),
    ).toThrowError(/main 分支/);

    expect(() =>
      readEnv({
        ...createVercelPreviewEnv({
          DATABASE_URL: "pooled-current-deployment",
          DATABASE_URL_UNPOOLED: "direct-current-deployment",
        }),
        VERCEL_GIT_COMMIT_REF: "bugfix/unsupported",
      }),
    ).toThrowError(/preview.*feature.*agent/);
  });

  it("Preview 在未显式提供 APP_URL 时通过 VERCEL_URL 推导访问地址", () => {
    const env = readEnv(
      createVercelPreviewEnv({
        VERCEL_URL: "dynamic-preview-subhub.vercel.app",
        APP_URL: undefined,
      }),
    );

    expect(env.APP_URL).toBe("https://dynamic-preview-subhub.vercel.app");
  });

  it("在 test 环境下忽略 VERCEL_* 部署身份并走本地回退", () => {
    const env = readEnv(
      createLocalTestEnv({
        DATABASE_URL: "pooled-current-deployment",
        DATABASE_URL_UNPOOLED: "direct-current-deployment",
        VERCEL_ENV: "preview",
      }),
    );

    expect(env).toMatchObject({
      deploymentProvider: "local",
      vercelEnvironment: "none",
      gitBranch: null,
      resolvedTier: "development",
      isPreviewDeployment: false,
      requiresDirectMigrationGate: false,
      DATABASE_URL: "pooled-current-deployment",
      DATABASE_URL_UNPOOLED: "direct-current-deployment",
    });
  });
});
