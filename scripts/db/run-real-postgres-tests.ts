/**
 * 真实数据库测试运行脚本
 *
 * 复用 localRealPostgresTestFiles 清单，以 RUN_POSTGRES_TESTS=true 运行 vitest。
 * 适用于 CI（pnpm test:db:ci）与本地（已有 DATABASE_URL_TEST 配置时）。
 *
 * 不执行：Docker 容器生命周期管理、数据库 reset、migration。
 * 若需要准备数据库，请先运行 pnpm db:prepare:ci。
 */

import { spawnSync } from "node:child_process";

import { localRealPostgresTestFiles } from "../../src/server/storage/local-test-postgres-suite";

if (!process.env.DATABASE_URL_TEST) {
  console.error(
    "错误：DATABASE_URL_TEST 未配置，无法运行真实数据库测试。\n" +
      "请先启动数据库（本地：pnpm db:start:test，CI：Postgres service container），\n" +
      "并执行 pnpm db:prepare:ci 准备测试数据库。",
  );
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  [
    "vitest",
    "run",
    "--passWithNoTests",
    "--no-file-parallelism",
    ...localRealPostgresTestFiles,
  ],
  {
    env: { ...process.env, RUN_POSTGRES_TESTS: "true" },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
