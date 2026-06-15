import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  inspectBootstrapState,
  resetBootstrapRuntimeMarkersForTesting,
  runBootstrap,
} from "@/server/storage/bootstrap";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import {
  resolveTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

const resetBootstrapTablesSql =
  'TRUNCATE TABLE "providers", "admin_action_results", "admin_sessions", "admin_invitations", "admin_users" RESTART IDENTITY CASCADE';

describeWhenLocalPostgresEnabled(
  "Bootstrap state on local Docker Postgres",
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
      resetBootstrapRuntimeMarkersForTesting();
      await directSql?.unsafe(resetBootstrapTablesSql);
    });

    afterAll(async () => {
      await closeStorageClient?.();
      await closeDirectClient?.();
      process.env = originalEnv;
    });

    it("在 production 下报告 schemaReady 与 required admin", async () => {
      const state = await inspectBootstrapState({
        db: storageDb!,
        mode: "production",
        now,
      });

      expect(state).toMatchObject({
        missingTables: [],
        adminUsersCount: 0,
        state: {
          schemaReady: true,
          bootstrapReady: false,
          seedState: "not_applicable",
          adminInitializationState: "required",
        },
      });
    });

    it("在显式允许时通过 bootstrap 完成 greenfield 首个管理员初始化", async () => {
      const result = await runBootstrap({
        db: storageDb!,
        mode: "production",
        now,
        allowInitialAdminBootstrap: true,
        initialAdminInput: {
          identifier: "owner@subhub.dev",
          displayName: "Owner",
          password: "SecurePass!23",
        },
      });

      expect(result).toMatchObject({
        createdInitialAdmin: true,
        adminUsersCount: 1,
        state: {
          seedState: "not_applicable",
          adminInitializationState: "completed",
        },
      });
    });
  },
);
