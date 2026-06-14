import { loadEnvConfig } from "@next/env";
import { resolveDirectDbUrl } from "../../src/lib/db-url";
import { createStorageClient } from "../../src/server/storage/client";

export const resolveMigrationClientOptions = ({
  DATABASE_URL_UNPOOLED,
}: {
  DATABASE_URL_UNPOOLED: string;
}) => ({
  runtimeDatabaseUrl: DATABASE_URL_UNPOOLED,
  directDatabaseUrl: DATABASE_URL_UNPOOLED,
});

const main = async () => {
  const directDatabaseUrl = resolveDirectDbUrl();
  const client = createStorageClient(
    resolveMigrationClientOptions({
      DATABASE_URL_UNPOOLED: directDatabaseUrl,
    }),
  );

  try {
    await client.migrate();
  } finally {
    await client.close();
  }
};

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))
) {
  loadEnvConfig(process.cwd());
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("数据库 migration 失败：", message);
    process.exit(1);
  });
}
