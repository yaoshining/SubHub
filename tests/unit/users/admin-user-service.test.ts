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
      id: "admin_operator",
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
      adminUserId: "admin_operator",
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
      adminUserId: "admin_operator",
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
          memberId: "admin_operator",
          reason: "unusual_location",
        }),
      ],
    });
  });

  it("暂停成员后撤销其 active 和 needs_attention 会话并记录动作", async () => {
    await seedUsers();

    const suspended = await suspendAdminUser("admin_operator", {
      actorAdminUserId: "admin_owner",
      now: new Date("2026-05-28T12:00:00.000Z"),
    });

    expect(suspended).toMatchObject({
      id: "admin_operator",
      status: "suspended",
    });
    const sessions = await getStorageClient()
      .db.select()
      .from(adminSessions)
      .where(eq(adminSessions.adminUserId, "admin_operator"));
    expect(sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "session_active", status: "revoked" }),
        expect.objectContaining({ id: "session_attention", status: "revoked" }),
      ]),
    );
    const actions = await getStorageClient().db.select().from(adminActionResults);
    expect(actions).toEqual([
      expect.objectContaining({
        actionType: "admin_user_suspended",
        targetType: "admin_user",
        targetId: "admin_operator",
        result: "success",
      }),
    ]);
  });

  it("恢复 suspended 成员并记录动作", async () => {
    await seedUsers();
    await suspendAdminUser("admin_operator", {
      actorAdminUserId: "admin_owner",
    });

    await expect(
      restoreAdminUser("admin_operator", {
        actorAdminUserId: "admin_owner",
        now: new Date("2026-05-28T13:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      id: "admin_operator",
      status: "active",
      updatedAt: "2026-05-28T13:00:00.000Z",
    });
  });
});
