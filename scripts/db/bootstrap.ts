import { loadEnvConfig } from "@next/env";

import { readEnv, isInitialAdminBootstrapAllowed } from "../../src/lib/env";
import { createStorageClient } from "../../src/server/storage/client";
import { runBootstrap } from "../../src/server/storage/bootstrap";

const requireInitialAdminInput = () => {
  const identifier = process.env.INITIAL_ADMIN_IDENTIFIER?.trim();
  const displayName = process.env.INITIAL_ADMIN_DISPLAY_NAME?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!identifier && !displayName && !password) {
    return undefined;
  }

  if (!identifier || !displayName || !password) {
    throw new Error(
      "若需要通过 bootstrap 脚本创建首个管理员，必须同时提供 INITIAL_ADMIN_IDENTIFIER、INITIAL_ADMIN_DISPLAY_NAME、INITIAL_ADMIN_PASSWORD。",
    );
  }

  return {
    identifier,
    displayName,
    password,
  };
};

export const resolveBootstrapClientOptions = ({
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
  loadEnvConfig(process.cwd());
  const env = readEnv();
  const initialAdminInput = requireInitialAdminInput();
  const client = createStorageClient(
    resolveBootstrapClientOptions({
      DATABASE_URL: env.DATABASE_URL,
      DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED,
    }),
  );

  try {
    const result = await runBootstrap({
      db: client.db,
      mode: env.resolvedTier,
      allowInitialAdminBootstrap: isInitialAdminBootstrapAllowed(process.env),
      initialAdminInput,
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
    console.error("数据库 bootstrap 失败：", message);
    process.exit(1);
  });
}
