import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readEnv } from "@/lib/env";

const repositoryRoot = process.cwd();

describe("运行环境契约", () => {
  it("对齐 specs 中的单一 URL 契约，并避免在多套 URL 间自行路由", async () => {
    const contract = await readFile(
      join(
        repositoryRoot,
        "specs/002-migrate-neon-vercel/contracts/runtime-environment-contract.md",
      ),
      "utf8",
    );

    expect(contract).toContain("当前部署已注入的 `DATABASE_URL`");
    expect(contract).toContain("当前部署已注入的 `DATABASE_URL_UNPOOLED`");
    expect(contract).toContain("应用不负责在多套数据库 URL 之间做主路由选择");
    expect(contract).toContain("DEV_DATABASE_URL");
    expect(contract).toContain("DEV_DATABASE_URL_UNPOOLED");
  });

  it("在 Vercel Preview 里只消费当前部署注入的 URL 对，而不是读取额外 tier 变量", () => {
    const env = readEnv({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "preview-subhub-example.vercel.app",
      VERCEL_GIT_COMMIT_REF: "preview",
      DATABASE_URL: "staging-pooled-url",
      DATABASE_URL_UNPOOLED: "staging-direct-url",
      DEV_DATABASE_URL: "dev-pooled-url",
      DEV_DATABASE_URL_UNPOOLED: "dev-direct-url",
      PROVIDER_CREDENTIAL_ENCRYPTION_KEY:
        "provider-credential-secret-at-least-32",
      ADMIN_SESSION_SECRET: "admin-session-secret-at-least-32",
      CALLER_KEY_SECRET: "caller-key-secret-at-least-32-chars",
    });

    expect(env.DATABASE_URL).toBe("staging-pooled-url");
    expect(env.DATABASE_URL_UNPOOLED).toBe("staging-direct-url");
    expect(env.resolvedTier).toBe("staging");
    expect(env.APP_URL).toBe("https://preview-subhub-example.vercel.app");
  });

  it("要求 .env.example 保持单部署 URL 写法，不暴露 prod/staging 多套路由变量", async () => {
    const envExample = await readFile(
      join(repositoryRoot, ".env.example"),
      "utf8",
    );

    expect(envExample).toContain("DATABASE_URL=");
    expect(envExample).toContain("DATABASE_URL_UNPOOLED=");
    expect(envExample).toContain("DEV_DATABASE_URL=");
    expect(envExample).toContain("DEV_DATABASE_URL_UNPOOLED=");
    expect(envExample).not.toContain("PRODUCTION_DATABASE_URL");
    expect(envExample).not.toContain("STAGING_DATABASE_URL");
  });
});
