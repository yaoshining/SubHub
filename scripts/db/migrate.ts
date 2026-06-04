import { loadEnvConfig } from "@next/env";
import { getStorageClient } from "../../src/server/storage/client";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const main = async () => {
  const client = getStorageClient();

  try {
    await client.migrate();
  } finally {
    await client.close();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("数据库 migration 失败：", message);
  process.exit(1);
});
