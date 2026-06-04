/**
 * 测试数据库准备脚本（无容器生命周期依赖）
 *
 * 适用场景：
 * - GitHub Actions Postgres service container（CI 主线）
 * - 已就绪的本地 Docker Postgres（手动调用或其他 CI 场景）
 *
 * 前置条件：
 * - DATABASE_URL_TEST 已在环境中配置，且目标数据库实例已就绪
 * - DATABASE_URL_TEST_UNPOOLED 已配置（可选，默认回退到 DATABASE_URL_TEST）
 *
 * 执行语义：reset schema → migrate
 *
 * 不执行：Docker 容器启动/停止/创建/删除
 */

import { createStorageClient } from "../../src/server/storage/client";
import { createDirectPostgresClient } from "../../src/server/storage/postgres-client";

const runtimeUrl = process.env.DATABASE_URL_TEST;
const directUrl =
  process.env.DATABASE_URL_TEST_UNPOOLED ?? process.env.DATABASE_URL_TEST;

if (!runtimeUrl || !directUrl) {
  console.error(
    "错误：DATABASE_URL_TEST 未配置，无法准备测试数据库。\n" +
      "请在环境中设置 DATABASE_URL_TEST 与 DATABASE_URL_TEST_UNPOOLED。",
  );
  process.exit(1);
}

const reset = async () => {
  const client = createDirectPostgresClient({ directDatabaseUrl: directUrl });

  try {
    await client.sql.unsafe(
      "DROP SCHEMA IF EXISTS drizzle CASCADE; " +
        "DROP SCHEMA IF EXISTS public CASCADE; " +
        "CREATE SCHEMA public; " +
        "GRANT ALL ON SCHEMA public TO CURRENT_USER; " +
        "GRANT ALL ON SCHEMA public TO public;",
    );

    console.log("数据库 schema 已重置。");
  } finally {
    await client.close();
  }
};

const migrate = async () => {
  const client = createStorageClient({
    runtimeDatabaseUrl: runtimeUrl,
    directDatabaseUrl: directUrl,
  });

  try {
    await client.migrate();
    console.log("Migration 已完成。");
  } finally {
    await client.close();
  }
};

const main = async () => {
  console.log(`准备测试数据库：${runtimeUrl}`);
  await reset();
  await migrate();
  console.log("测试数据库已就绪。");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("测试数据库准备失败：", message);
  process.exit(1);
});
