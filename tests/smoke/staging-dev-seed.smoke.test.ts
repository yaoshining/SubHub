import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { applyManagedSeed } from "@/server/storage/bootstrap";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import { providers } from "@/server/storage/schema";
import {
  resolveTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

const resetSeedTablesSql =
  'TRUNCATE TABLE "providers", "admin_action_results", "admin_sessions", "admin_invitations", "admin_users" RESTART IDENTITY CASCADE';

describeWhenLocalPostgresEnabled("staging / dev seed smoke", () => {
  const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
  const { runtimeUrl, directUrl } = resolveTestDatabaseUrls();

  let closeStorageClient: (() => Promise<void>) | undefined;
  let closeDirectClient: (() => Promise<void>) | undefined;
  let directSql:
    | ReturnType<typeof createDirectPostgresClient>["sql"]
    | undefined;
  let storageDb: ReturnType<typeof createStorageClient>["db"] | undefined;

  beforeAll(async () => {
    Object.assign(process.env, testEnv);

    const storageClient = createStorageClient({
      runtimeDatabaseUrl: runtimeUrl,
      directDatabaseUrl: directUrl,
    });

    await storageClient.migrate();
    storageDb = storageClient.db;
    closeStorageClient = () => storageClient.close();

    const directClient = createDirectPostgresClient({
      directDatabaseUrl: directUrl,
    });

    directSql = directClient.sql;
    closeDirectClient = () => directClient.close();
  });

  beforeEach(async () => {
    await directSql?.unsafe(resetSeedTablesSql);
  });

  afterAll(async () => {
    await closeStorageClient?.();
    await closeDirectClient?.();
  });

  it.each([
    ["development", "Seed development OpenSubtitles"],
    ["staging", "Seed staging OpenSubtitles"],
  ] as const)(
    "%s seed 后保留可识别的 non-production 占位 Provider",
    async (mode, providerName) => {
      const result = await applyManagedSeed({
        db: storageDb!,
        mode,
      });

      const seededProviders = await storageDb!
        .select({ name: providers.name, status: providers.status })
        .from(providers);

      expect(result.state.seedState).toBe("applied");
      expect(seededProviders).toEqual([
        {
          name: providerName,
          status: "needs_config",
        },
      ]);
    },
  );
});
