import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createVercelPreviewEnv } from "../../helpers/env-scenarios";
import { readEnv } from "@/lib/env";

const repositoryRoot = process.cwd();
const previewWhitelist = [
  "preview/*",
  "feature/*",
  "agent/*",
  "copilot/*",
  "fix/*",
  "chore/*",
  "renovate/*",
] as const;

const previewWhitelistErrorMessage =
  "Vercel Preview 仅支持 preview，或命中 preview/*、feature/*、agent/*、copilot/*、fix/*、chore/*、renovate/* 白名单前缀的分支映射。";

describe("运行环境契约", () => {
  it("要求仓库级真源与 copilot-instructions 对 Preview 白名单口径一致", async () => {
    const [runtimeMapping, copilotInstructions] = await Promise.all([
      readFile(
        join(repositoryRoot, "docs/runtime/environment-mapping.md"),
        "utf8",
      ),
      readFile(join(repositoryRoot, ".github/copilot-instructions.md"), "utf8"),
    ]);

    expect(runtimeMapping).toContain(
      "`preview`               | `Preview`     | staging database",
    );

    for (const prefix of previewWhitelist) {
      expect(runtimeMapping).toContain(`- \`${prefix}\``);
      expect(copilotInstructions).toContain(`\`${prefix}\``);
    }

    expect(runtimeMapping).toContain("非白名单 Preview 分支必须直接报错");
    expect(copilotInstructions).toContain("非白名单 Preview 分支必须直接报错");
  });

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
    const env = readEnv(
      createVercelPreviewEnv({
        DATABASE_URL: "staging-pooled-url",
        DATABASE_URL_UNPOOLED: "staging-direct-url",
        DEV_DATABASE_URL: "dev-pooled-url",
        DEV_DATABASE_URL_UNPOOLED: "dev-direct-url",
      }),
    );

    expect(env.DATABASE_URL).toBe("staging-pooled-url");
    expect(env.DATABASE_URL_UNPOOLED).toBe("staging-direct-url");
    expect(env.resolvedTier).toBe("staging");
    expect(env.APP_URL).toBe("https://preview-subhub-example.vercel.app");
  });

  it("要求 preview 精确分支映射到 staging，白名单普通 Preview 分支映射到 dev", () => {
    const previewEnv = readEnv(
      createVercelPreviewEnv({
        DATABASE_URL: "preview-pooled-url",
        DATABASE_URL_UNPOOLED: "preview-direct-url",
      }),
    );

    const whitelistEnv = readEnv(
      createVercelPreviewEnv({
        VERCEL_GIT_COMMIT_REF: "copilot/issue-72",
        DATABASE_URL: "dev-pooled-url",
        DATABASE_URL_UNPOOLED: "dev-direct-url",
      }),
    );

    expect(previewEnv.resolvedTier).toBe("staging");
    expect(whitelistEnv.resolvedTier).toBe("development");
  });

  it("要求非白名单 Preview 分支直接失败，且报错文案与仓库级真源一致", () => {
    expect(() =>
      readEnv(
        createVercelPreviewEnv({
          VERCEL_GIT_COMMIT_REF: "release/next",
        }),
      ),
    ).toThrowError(previewWhitelistErrorMessage);
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
