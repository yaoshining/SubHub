import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import {
  createInitialAdmin,
  getBootstrapStatus,
} from "@/server/services/bootstrap-service";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import { adminActionResults, adminUsers } from "@/server/storage/schema";
import {
  buildLocalTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

const truncateAdminTablesSql =
  'TRUNCATE TABLE "admin_action_results", "admin_sessions", "admin_invitations", "admin_users" RESTART IDENTITY CASCADE';

describeWhenLocalPostgresEnabled(
  "Bootstrap service on local Docker Postgres",
  () => {
    const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
    const { runtimeUrl, directUrl } = buildLocalTestDatabaseUrls();
    const now = new Date("2026-06-01T00:00:00.000Z");

    let closeStorageClient: (() => Promise<void>) | undefined;
    let closeDirectClient: (() => Promise<void>) | undefined;
    let directDb:
      | ReturnType<typeof createDirectPostgresClient>["db"]
      | undefined;
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

      directDb = directClient.db;
      directSql = directClient.sql;
      closeDirectClient = () => directClient.close();
    });

    beforeEach(async () => {
      await directSql?.unsafe(truncateAdminTablesSql);
    });

    afterAll(async () => {
      await closeStorageClient?.();
      await closeDirectClient?.();
    });

    it("reports not initialized when no admin user exists on the real Postgres path", async () => {
      const status = await getBootstrapStatus({ db: storageDb });

      expect(status).toEqual({ initialized: false });
    });

    it("creates first admin and reports initialized through a real Postgres transaction", async () => {
      const result = await createInitialAdmin(
        {
          identifier: "owner@subhub.dev",
          displayName: "Owner",
          password: "SecurePass!23",
        },
        { db: storageDb, now },
      );

      expect(result).toMatchObject({
        adminUserId: expect.stringMatching(/^admin_/),
        status: "active",
      });

      const status = await getBootstrapStatus({ db: storageDb });

      expect(status).toEqual({ initialized: true });

      const persistedUsers = await directDb?.select().from(adminUsers);

      expect(persistedUsers).toHaveLength(1);
      expect(persistedUsers?.[0]).toMatchObject({
        identifier: "owner@subhub.dev",
        displayName: "Owner",
        status: "active",
        role: "admin",
      });

      const auditRecords = await directDb?.select().from(adminActionResults);

      expect(auditRecords).toEqual([
        expect.objectContaining({
          actionType: "bootstrap_admin_created",
          targetType: "bootstrap",
          result: "success",
        }),
      ]);
    });

    it("rejects duplicate initialization through real Postgres unique constraint and transaction guard", async () => {
      await createInitialAdmin(
        {
          identifier: "owner@subhub.dev",
          displayName: "Owner",
          password: "SecurePass!23",
        },
        { db: storageDb, now },
      );

      await expect(
        createInitialAdmin(
          {
            identifier: "operator@subhub.dev",
            displayName: "Operator",
            password: "SecurePass!23",
          },
          { db: storageDb, now },
        ),
      ).rejects.toMatchObject<AppError>({
        code: "FORBIDDEN",
        target: "bootstrap",
      });

      const persistedUsers = await directDb?.select().from(adminUsers);

      expect(persistedUsers).toHaveLength(1);

      const auditRecords = await directDb
        ?.select()
        .from(adminActionResults)
        .where(eq(adminActionResults.result, "failed"));

      expect(auditRecords).toEqual([
        expect.objectContaining({
          actionType: "bootstrap_admin_created",
          targetType: "bootstrap",
          result: "failed",
          message: "系统已完成首轮管理员初始化。",
        }),
      ]);
    });

    it("enforces unique admin identifier through real Postgres constraint", async () => {
      await createInitialAdmin(
        {
          identifier: "owner@subhub.dev",
          displayName: "Owner",
          password: "SecurePass!23",
        },
        { db: storageDb, now },
      );

      // After first admin exists, creating another with same identifier should fail
      // even though the transaction guard catches it first
      const status = await getBootstrapStatus({ db: storageDb });
      expect(status.initialized).toBe(true);

      // Verify the unique index exists at the database level
      await expect(
        directDb?.insert(adminUsers).values({
          id: "admin_duplicate",
          identifier: "owner@subhub.dev",
          displayName: "Duplicate Owner",
          passwordHash: "some-hash",
          status: "active",
          role: "admin",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
      ).rejects.toMatchObject({ cause: { code: "23505" } });
    });
  },
);
