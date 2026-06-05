import { loadEnvConfig } from "@next/env";

import { readEnv } from "../../src/lib/env";
import { createStorageClient } from "../../src/server/storage/client";
import { applyManagedSeed } from "../../src/server/storage/bootstrap";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const main = async () => {
  const env = readEnv();

  if (env.resolvedTier !== "staging") {
    throw new Error("db:seed:staging 仅允许在 staging tier 执行。");
  }

  const client = createStorageClient({
    runtimeDatabaseUrl: env.DATABASE_URL_UNPOOLED,
    directDatabaseUrl: env.DATABASE_URL_UNPOOLED,
  });

  try {
    const result = await applyManagedSeed({
      db: client.db,
      mode: "staging",
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("staging seed 失败：", message);
  process.exit(1);
});
