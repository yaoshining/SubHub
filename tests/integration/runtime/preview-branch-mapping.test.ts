import { describe, expect, it } from "vitest";

import { readEnv } from "@/lib/env";

const baseSource = {
  NODE_ENV: "production",
  APP_URL: "https://preview.subhub.example.com",
  VERCEL_ENV: "preview",
  DATABASE_URL: "preview-pooled-url",
  DATABASE_URL_UNPOOLED: "preview-direct-url",
  PROVIDER_CREDENTIAL_ENCRYPTION_KEY: "provider-credential-secret-at-least-32",
  ADMIN_SESSION_SECRET: "admin-session-secret-at-least-32",
  CALLER_KEY_SECRET: "caller-key-secret-at-least-32-chars",
} satisfies NodeJS.ProcessEnv;

describe("Preview 分支映射集成", () => {
  it.each([
    ["preview", "staging"],
    ["preview/issue-65", "development"],
    ["feature/issue-65", "development"],
    ["agent/copilot-issue-65", "development"],
  ] as const)("%s 解析为 %s", (gitBranch, resolvedTier) => {
    const env = readEnv({
      ...baseSource,
      VERCEL_GIT_COMMIT_REF: gitBranch,
    });

    expect(env.resolvedTier).toBe(resolvedTier);
    expect(env.isPreviewDeployment).toBe(true);
    expect(env.deploymentProvider).toBe("vercel");
  });

  it("缺少或使用不支持的 Preview 分支名时快速失败", () => {
    expect(() =>
      readEnv({
        ...baseSource,
      }),
    ).toThrowError(/当前分支名/);

    expect(() =>
      readEnv({
        ...baseSource,
        VERCEL_GIT_COMMIT_REF: "release/next",
      }),
    ).toThrowError(/preview.*feature.*agent/);
  });
});
