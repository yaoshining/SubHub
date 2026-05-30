import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  listAdminUsersOverview,
  restoreAdminUser,
  suspendAdminUser,
} from "@/server/services/admin-user-service";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";
import {
  adminActionResults,
  adminInvitations,
  adminSessions,
  adminUsers,
} from "@/server/storage/schema";

let tempDir: string;
const TEST_OPERATOR_ID = "admin_operator";
const TEST_BACKUP_ADMIN_ID = "admin_backup";

const seedUsers = async () => {
  const db = getStorageClient().db;
  await db.insert(adminUsers).values([
    {
      id: "admin_owner",
      identifier: "owner@example.com",
      displayName: "Owner",
      passwordHash: "hash",
      role: "admin",
      status: "active",
      createdAt: "2026-05-28T00:00:00.000Z",
      updatedAt: "2026-05-28T00:00:00.000Z",
      lastLoginAt: "2026-05-28T09:00:00.000Z",
    },
    {
      id: TEST_OPERATOR_ID,
      identifier: "operator@example.com",
      displayName: "Operator",
      passwordHash: "hash",
      role: "operator",
      status: "active",
      createdAt: "2026-05-28T00:00:00.000Z",
      updatedAt: "2026-05-28T00:00:00.000Z",
    },
  ]);
  await db.insert(adminInvitations).values({
    id: "invite_pending",
    identifier: "pending@example.com",
    status: "pending",
    rolePreset: "operator",
    accessPreset: "admin_console",
    invitedByAdminUserId: "admin_owner",
    acceptedAdminUserId: null,
    expiresAt: "2026-06-04T00:00:00.000Z",
    acceptedAt: null,
    revokedAt: null,
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
  });
  await db.insert(adminSessions).values([
    {
      id: "session_active",
      adminUserId: TEST_OPERATOR_ID,
      sessionTokenHash: "hash_active",
      status: "active",
      createdAt: "2026-05-28T00:00:00.000Z",
      expiresAt: "2026-05-29T00:00:00.000Z",
      lastSeenAt: "2026-05-28T10:00:00.000Z",
      deviceLabel: "Chrome on macOS",
      attentionReason: null,
    },
    {
      id: "session_attention",
      adminUserId: TEST_OPERATOR_ID,
      sessionTokenHash: "hash_attention",
      status: "needs_attention",
      createdAt: "2026-05-28T00:00:00.000Z",
      expiresAt: "2026-05-29T00:00:00.000Z",
      lastSeenAt: "2026-05-28T11:00:00.000Z",
      deviceLabel: "Unknown device",
      attentionReason: "unusual_location",
    },
  ]);
};

const seedBackupAdmin = async () => {
  await getStorageClient().db.insert(adminUsers).values({
    id: TEST_BACKUP_ADMIN_ID,
    identifier: "backup@example.com",
    displayName: "Backup Admin",
    passwordHash: "hash",
    role: "admin",
    status: "active",
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
    lastLoginAt: "2026-05-28T09:30:00.000Z",
  });
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-admin-user-service-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Admin user service", () => {
  it("返回成员、pending 邀请和需要关注会话的 Users 汇总", async () => {
    await seedUsers();

    await expect(listAdminUsersOverview()).resolves.toMatchObject({
      members: expect.arrayContaining([
        expect.objectContaining({
          id: "admin_owner",
          identifier: "owner@example.com",
          rolePreset: "admin",
          status: "active",
          lastActiveAt: "2026-05-28T09:00:00.000Z",
        }),
      ]),
      invitations: [
        expect.objectContaining({
          id: "invite_pending",
          status: "pending",
        }),
      ],
      sessionsNeedingAttention: [
        expect.objectContaining({
          id: "session_attention",
          memberId: TEST_OPERATOR_ID,
          reason: "unusual_location",
        }),
      ],
    });
  });

  it("暂停成员后撤销其 active 和 needs_attention 会话并记录动作", async () => {
    await seedUsers();

    const suspended = await suspendAdminUser(TEST_OPERATOR_ID, {
      actorAdminUserId: "admin_owner",
      now: new Date("2026-05-28T12:00:00.000Z"),
    });

    expect(suspended).toMatchObject({
      id: TEST_OPERATOR_ID,
      status: "suspended",
    });
    const sessions = await getStorageClient()
      .db.select()
      .from(adminSessions)
      .where(eq(adminSessions.adminUserId, TEST_OPERATOR_ID));
    expect(sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "session_active", status: "revoked" }),
        expect.objectContaining({ id: "session_attention", status: "revoked" }),
      ]),
    );
    const actions = await getStorageClient()
      .db.select()
      .from(adminActionResults);
    expect(actions).toEqual([
      expect.objectContaining({
        actionType: "admin_user_suspended",
        targetType: "admin_user",
        targetId: TEST_OPERATOR_ID,
        result: "success",
      }),
    ]);
  });

  it("恢复 suspended 成员并记录动作", async () => {
    await seedUsers();
    await suspendAdminUser(TEST_OPERATOR_ID, {
      actorAdminUserId: "admin_owner",
    });

    await expect(
      restoreAdminUser(TEST_OPERATOR_ID, {
        actorAdminUserId: "admin_owner",
        now: new Date("2026-05-28T13:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      id: TEST_OPERATOR_ID,
      status: "active",
      updatedAt: "2026-05-28T13:00:00.000Z",
    });

    const actions = await getStorageClient()
      .db.select({
        actionType: adminActionResults.actionType,
        targetType: adminActionResults.targetType,
        targetId: adminActionResults.targetId,
        result: adminActionResults.result,
      })
      .from(adminActionResults)
      .where(eq(adminActionResults.targetId, TEST_OPERATOR_ID));
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: "admin_user_suspended",
          targetType: "admin_user",
          targetId: TEST_OPERATOR_ID,
          result: "success",
        }),
        expect.objectContaining({
          actionType: "admin_user_restored",
          targetType: "admin_user",
          targetId: TEST_OPERATOR_ID,
          result: "success",
        }),
      ]),
    );
  });

  it("拒绝当前登录管理员暂停自己", async () => {
    await seedUsers();
    await seedBackupAdmin();

    await expect(
      suspendAdminUser("admin_owner", {
        actorAdminUserId: "admin_owner",
        now: new Date("2026-05-28T12:30:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "当前登录管理员不能暂停自己。",
    });

    const [owner] = await getStorageClient()
      .db.select()
      .from(adminUsers)
      .where(eq(adminUsers.id, "admin_owner"));
    expect(owner?.status).toBe("active");

    const actions = await getStorageClient()
      .db.select()
      .from(adminActionResults)
      .where(eq(adminActionResults.targetId, "admin_owner"));
    expect(actions).toEqual([]);
  });

  it("拒绝暂停最后一个 active admin", async () => {
    await seedUsers();

    await expect(
      suspendAdminUser("admin_owner", {
        actorAdminUserId: "admin_owner",
        now: new Date("2026-05-28T12:45:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "最后一个 active admin 不可被暂停。",
    });

    const [owner] = await getStorageClient()
      .db.select()
      .from(adminUsers)
      .where(eq(adminUsers.id, "admin_owner"));
    expect(owner?.status).toBe("active");
  });
});
