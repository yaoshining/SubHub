import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import {
  createAdminInvitation,
  revokeAdminInvitation,
} from "@/server/services/admin-invitation-service";
import { createInitialAdmin } from "@/server/services/bootstrap-service";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import {
  adminActionResults,
  adminInvitations,
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
  "Admin invitation service on local Docker Postgres",
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
    let adminUserId: string;

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

      const admin = await createInitialAdmin(
        {
          identifier: "owner@subhub.dev",
          displayName: "Owner",
          password: "SecurePass!23",
        },
        { db: storageDb, now },
      );

      adminUserId = admin.adminUserId;
    });

    afterAll(async () => {
      await closeStorageClient?.();
      await closeDirectClient?.();
    });

    it("creates invitation and records audit on the real Postgres path", async () => {
      const invitation = await createAdminInvitation(
        {
          identifier: "operator@subhub.dev",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        { db: storageDb, now, actorAdminUserId: adminUserId },
      );

      expect(invitation).toMatchObject({
        identifier: "operator@subhub.dev",
        status: "pending",
        rolePreset: "operator",
        accessPreset: "admin_console",
      });

      const persistedInvitations = await directDb
        ?.select()
        .from(adminInvitations);

      expect(persistedInvitations).toHaveLength(1);
      expect(persistedInvitations?.[0]).toMatchObject({
        identifier: "operator@subhub.dev",
        status: "pending",
      });

      const auditRecords = await directDb
        ?.select()
        .from(adminActionResults)
        .where(eq(adminActionResults.actionType, "admin_invitation_created"));

      expect(auditRecords).toEqual([
        expect.objectContaining({
          actorAdminUserId: adminUserId,
          actionType: "admin_invitation_created",
          targetType: "admin_invitation",
          result: "success",
        }),
      ]);
    });

    it("prevents duplicate pending invitations through real Postgres partial unique index", async () => {
      await createAdminInvitation(
        {
          identifier: "operator@subhub.dev",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        { db: storageDb, now, actorAdminUserId: adminUserId },
      );

      await expect(
        createAdminInvitation(
          {
            identifier: "operator@subhub.dev",
            rolePreset: "admin",
            accessPreset: "admin_console",
          },
          { db: storageDb, now, actorAdminUserId: adminUserId },
        ),
      ).rejects.toMatchObject<AppError>({
        code: "VALIDATION_FAILED",
        target: "identifier",
      });

      const persistedInvitations = await directDb
        ?.select()
        .from(adminInvitations);

      expect(persistedInvitations).toHaveLength(1);
    });

    it("allows a fresh pending invitation after the previous one is revoked on real Postgres", async () => {
      const invitation = await createAdminInvitation(
        {
          identifier: "operator@subhub.dev",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        { db: storageDb, now, actorAdminUserId: adminUserId },
      );

      const revoked = await revokeAdminInvitation(invitation.id, {
        db: storageDb,
        now,
      });

      expect(revoked.status).toBe("revoked");

      const secondInvitation = await createAdminInvitation(
        {
          identifier: "operator@subhub.dev",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        { db: storageDb, now, actorAdminUserId: adminUserId },
      );

      expect(secondInvitation.status).toBe("pending");
      expect(secondInvitation.id).not.toBe(invitation.id);

      const persistedInvitations = await directDb
        ?.select()
        .from(adminInvitations);

      const pendingCount = persistedInvitations?.filter(
        (inv) => inv.status === "pending",
      ).length;

      expect(pendingCount).toBe(1);

      const auditRecords = await directDb
        ?.select()
        .from(adminActionResults)
        .where(eq(adminActionResults.actionType, "admin_invitation_revoked"));

      expect(auditRecords).toEqual([
        expect.objectContaining({
          actionType: "admin_invitation_revoked",
          targetType: "admin_invitation",
          result: "success",
        }),
      ]);
    });
  },
);
