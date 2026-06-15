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

describeWhenLocalPostgresEnabled(
  "Managed seed repeatability on local Docker Postgres",
  () => {
    const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
    const { runtimeUrl, directUrl } = resolveTestDatabaseUrls();
    const now = new Date("2026-06-05T00:00:00.000Z");

    let closeStorageClient: (() => Promise<void>) | undefined;
    let closeDirectClient: (() => Promise<void>) | undefined;
    let directSql:
      | ReturnType<typeof createDirectPostgresClient>["sql"]
      | undefined;
    let storageDb: ReturnType<typeof createStorageClient>["db"] | undefined;
    let originalEnv: NodeJS.ProcessEnv;

    beforeAll(async () => {
      originalEnv = { ...process.env };
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
      process.env = originalEnv;
    });

    it.each([
      ["development", "seed_provider_development_opensubtitles"],
      ["staging", "seed_provider_staging_opensubtitles"],
    ] as const)(
      "允许 %s seed 重复执行且不重复写入",
      async (mode, seedProviderId) => {
        const first = await applyManagedSeed({
          db: storageDb!,
          mode,
          now,
        });
        const second = await applyManagedSeed({
          db: storageDb!,
          mode,
          now: new Date("2026-06-05T00:01:00.000Z"),
        });

        const seededProviders = await storageDb!
          .select({ id: providers.id })
          .from(providers);

        expect(first).toMatchObject({
          insertedProviders: 1,
          updatedProviders: 0,
          seedProviderId,
        });
        expect(second).toMatchObject({
          insertedProviders: 0,
          updatedProviders: 1,
          seedProviderId,
        });
        expect(seededProviders).toEqual([{ id: seedProviderId }]);
      },
    );

    it("拒绝 production seed", async () => {
      await expect(
        applyManagedSeed({
          db: storageDb!,
          mode: "production",
        }),
      ).rejects.toThrow(/production 禁止执行 seed/);
    });
  },
);
