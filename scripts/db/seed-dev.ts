import { loadEnvConfig } from "@next/env";

import { readEnv } from "../../src/lib/env";
import { createStorageClient } from "../../src/server/storage/client";
import { applyManagedSeed } from "../../src/server/storage/bootstrap";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

export const resolveSeedDevClientOptions = ({
  DATABASE_URL,
  DATABASE_URL_UNPOOLED,
}: {
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED: string;
}) => ({
  runtimeDatabaseUrl: DATABASE_URL,
  directDatabaseUrl: DATABASE_URL_UNPOOLED,
});

const main = async () => {
  const env = readEnv();

  if (env.resolvedTier !== "development") {
    throw new Error("db:seed:dev 仅允许在 development tier 执行。");
  }

  const client = createStorageClient(
    resolveSeedDevClientOptions({
      DATABASE_URL: env.DATABASE_URL,
      DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED,
    }),
  );

  try {
    const result = await applyManagedSeed({
      db: client.db,
      mode: "development",
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
};

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("development seed 失败：", message);
    process.exit(1);
  });
}
