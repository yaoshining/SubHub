import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { AdminUserRepository } from "@/server/users/admin-user-repository";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import {
  adminInvitations,
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
  'TRUNCATE TABLE "admin_sessions", "admin_invitations", "admin_users" RESTART IDENTITY CASCADE';

describeWhenLocalPostgresEnabled("AdminUserRepository on local Docker Postgres", () => {
  const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
  const { runtimeUrl, directUrl } = buildLocalTestDatabaseUrls();

  const now = new Date("2026-06-01T00:00:00.000Z");
  const adminUser = {
    id: "admin_root",
    identifier: "owner@subhub.dev",
    displayName: "Owner",
    passwordHash: "hashed-password",
    status: "active" as const,
    role: "admin" as const,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastLoginAt: now.toISOString(),
  };

  let repository: AdminUserRepository;
  let closeStorageClient: (() => Promise<void>) | undefined;
  let closeDirectClient: (() => Promise<void>) | undefined;
  let directDb:
    | ReturnType<typeof createDirectPostgresClient>["db"]
    | undefined;
  let directSql:
    | ReturnType<typeof createDirectPostgresClient>["sql"]
    | undefined;

  beforeAll(async () => {
    Object.assign(process.env, testEnv);

    const storageClient = createStorageClient({
      runtimeDatabaseUrl: runtimeUrl,
      directDatabaseUrl: directUrl,
    });

    await storageClient.migrate();

    repository = new AdminUserRepository(storageClient.db);
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

  it("reads members, invitations, and attention sessions from the real Postgres database", async () => {
    await directDb?.insert(adminUsers).values(adminUser);

    await repository.createInvitation({
      identifier: "operator@subhub.dev",
      rolePreset: "operator",
      accessPreset: "admin_console",
      invitedByAdminUserId: adminUser.id,
      now,
    });

    await directDb?.insert(adminSessions).values({
      id: "session_attention",
      adminUserId: adminUser.id,
      sessionTokenHash: "session-token-hash",
      status: "needs_attention",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
      lastSeenAt: now.toISOString(),
      deviceLabel: "Chrome on macOS",
      attentionReason: "ip_changed",
      remediatedAt: null,
      remediatedByAdminUserId: null,
    });

    const overview = await repository.listOverview();

    expect(overview.members).toEqual([
      {
        id: adminUser.id,
        identifier: adminUser.identifier,
        displayName: adminUser.displayName,
        status: "active",
        rolePreset: "admin",
        lastActiveAt: now.toISOString(),
      },
    ]);
    expect(overview.invitations).toHaveLength(1);
    expect(overview.invitations[0]).toMatchObject({
      identifier: "operator@subhub.dev",
      status: "pending",
      rolePreset: "operator",
      accessPreset: "admin_console",
    });
    expect(overview.sessionsNeedingAttention).toEqual([
      {
        id: "session_attention",
        memberId: adminUser.id,
        status: "needs_attention",
        reason: "ip_changed",
        lastSeenAt: now.toISOString(),
        deviceLabel: "Chrome on macOS",
      },
    ]);
  });

  it("keeps pending invitation uniqueness on the real Postgres path", async () => {
    await directDb?.insert(adminUsers).values(adminUser);

    await repository.createInvitation({
      identifier: "operator@subhub.dev",
      rolePreset: "operator",
      accessPreset: "admin_console",
      invitedByAdminUserId: adminUser.id,
      now,
    });

    await expect(
      repository.createInvitation({
        identifier: "operator@subhub.dev",
        rolePreset: "operator",
        accessPreset: "admin_console",
        invitedByAdminUserId: adminUser.id,
        now,
      }),
    ).rejects.toMatchObject<AppError>({
      code: "VALIDATION_FAILED",
      target: "identifier",
    });

    const invitations = await directDb?.select().from(adminInvitations);
    expect(invitations).toHaveLength(1);
  });
});