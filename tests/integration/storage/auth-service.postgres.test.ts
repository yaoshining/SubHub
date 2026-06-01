import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { loginAdmin, logoutAdmin } from "@/server/services/auth-service";
import { createInitialAdmin } from "@/server/services/bootstrap-service";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import {
  adminActionResults,
  adminSessions,
  adminUsers,
} from "@/server/storage/schema";
import {
  buildLocalTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

const truncateAdminTablesSql =
  'TRUNCATE TABLE "admin_action_results", "admin_sessions", "admin_invitations", "admin_users" RESTART IDENTITY CASCADE';

describeWhenLocalPostgresEnabled(
  "Auth service on local Docker Postgres",
  () => {
    const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
    const { runtimeUrl, directUrl } = buildLocalTestDatabaseUrls();
    const now = new Date("2026-06-01T00:00:00.000Z");
    const adminPassword = "SecurePass!23";
    const adminIdentifier = "owner@subhub.dev";

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

      await createInitialAdmin(
        {
          identifier: adminIdentifier,
          displayName: "Owner",
          password: adminPassword,
        },
        { db: storageDb, now },
      );
    });

    afterAll(async () => {
      await closeStorageClient?.();
      await closeDirectClient?.();
    });

    it("creates session with unique token hash and updates lastLoginAt on the real Postgres path", async () => {
      const result = await loginAdmin(
        {
          identifier: adminIdentifier,
          password: adminPassword,
          deviceLabel: "Chrome on macOS",
        },
        { db: storageDb, now },
      );

      expect(result).toMatchObject({
        admin: {
          identifier: adminIdentifier,
          displayName: "Owner",
          role: "admin",
        },
        session: {
          token: expect.stringMatching(/^subhub_admin_/),
          expiresAt: expect.any(String),
        },
      });

      const persistedSessions = await directDb?.select().from(adminSessions);

      expect(persistedSessions).toHaveLength(1);
      expect(persistedSessions?.[0]).toMatchObject({
        adminUserId: result.admin.id,
        status: "active",
        deviceLabel: "Chrome on macOS",
        sessionTokenHash: expect.any(String),
      });

      const persistedUsers = await directDb?.select().from(adminUsers);

      expect(persistedUsers?.[0]?.lastLoginAt).toBeDefined();
      expect(Date.parse(persistedUsers?.[0]?.lastLoginAt ?? "")).toBe(
        Date.parse("2026-06-01T00:00:00.000Z"),
      );

      const auditRecords = await directDb
        ?.select()
        .from(adminActionResults)
        .where(eq(adminActionResults.actionType, "admin_login"));

      expect(auditRecords).toEqual([
        expect.objectContaining({
          actionType: "admin_login",
          result: "success",
        }),
      ]);
    });

    it("rejects login with wrong password and records failed audit on the real Postgres path", async () => {
      await expect(
        loginAdmin(
          {
            identifier: adminIdentifier,
            password: "WrongPassword!",
          },
          { db: storageDb, now },
        ),
      ).rejects.toMatchObject({
        code: "AUTHENTICATION_REQUIRED",
      });

      const persistedSessions = await directDb?.select().from(adminSessions);

      expect(persistedSessions).toEqual([]);

      const failedAudits = await directDb
        ?.select()
        .from(adminActionResults)
        .where(eq(adminActionResults.result, "failed"));

      expect(failedAudits).toEqual([
        expect.objectContaining({
          actionType: "admin_login",
          result: "failed",
          message: "管理员登录失败：凭据无效。",
        }),
      ]);
    });

    it("rejects login for suspended admin on the real Postgres path", async () => {
      const admins = await directDb?.select().from(adminUsers).limit(1);
      const firstAdmin = admins?.[0];

      if (!firstAdmin) {
        throw new Error("Expected at least one admin user");
      }

      await directDb
        ?.update(adminUsers)
        .set({ status: "suspended", updatedAt: now.toISOString() })
        .where(eq(adminUsers.id, firstAdmin.id));

      await expect(
        loginAdmin(
          {
            identifier: adminIdentifier,
            password: adminPassword,
          },
          { db: storageDb, now },
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      const failedAudits = await directDb
        ?.select()
        .from(adminActionResults)
        .where(eq(adminActionResults.result, "failed"));

      expect(failedAudits).toEqual([
        expect.objectContaining({
          actionType: "admin_login",
          result: "failed",
          message: "管理员登录失败：账号已暂停。",
        }),
      ]);
    });

    it("revokes session through logout on the real Postgres path", async () => {
      const { session } = await loginAdmin(
        {
          identifier: adminIdentifier,
          password: adminPassword,
        },
        { db: storageDb, now },
      );

      await logoutAdmin(session.token, { db: storageDb });

      const persistedSessions = await directDb?.select().from(adminSessions);

      expect(persistedSessions).toHaveLength(1);
      expect(persistedSessions?.[0]).toMatchObject({
        status: "revoked",
      });
    });
  },
);
