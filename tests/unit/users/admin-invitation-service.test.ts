import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAdminInvitation,
  revokeAdminInvitation,
} from "@/server/services/admin-invitation-service";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";
import { adminActionResults, adminUsers } from "@/server/storage/schema";

let tempDir: string;

const seedAdmin = async () => {
  const [admin] = await getStorageClient()
    .db.insert(adminUsers)
    .values({
      id: "admin_owner",
      identifier: "owner@example.com",
      displayName: "Owner",
      passwordHash: "hash",
      role: "admin",
      status: "active",
      createdAt: "2026-05-28T00:00:00.000Z",
      updatedAt: "2026-05-28T00:00:00.000Z",
    })
    .returning();

  return admin;
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-admin-invitation-service-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Admin invitation service", () => {
  it("创建 pending 邀请并记录 admin_invitation_created 动作", async () => {
    const admin = await seedAdmin();
    const now = new Date("2026-05-28T12:00:00.000Z");

    const invitation = await createAdminInvitation(
      {
        identifier: "Operator@Example.com ",
        rolePreset: "operator",
        accessPreset: "admin_console",
      },
      { actorAdminUserId: admin.id, now },
    );

    expect(invitation).toMatchObject({
      identifier: "operator@example.com",
      status: "pending",
      rolePreset: "operator",
      accessPreset: "admin_console",
      expiresAt: "2026-06-04T12:00:00.000Z",
    });
    expect(invitation).not.toHaveProperty("invitedByAdminUserId");
    expect(invitation).not.toHaveProperty("acceptedAdminUserId");
    expect(invitation).not.toHaveProperty("acceptedAt");
    expect(invitation).not.toHaveProperty("revokedAt");

    const actions = await getStorageClient()
      .db.select()
      .from(adminActionResults);
    expect(actions).toEqual([
      expect.objectContaining({
        actorAdminUserId: admin.id,
        actionType: "admin_invitation_created",
        targetType: "admin_invitation",
        targetId: invitation.id,
        result: "success",
      }),
    ]);
  });

  it("拒绝重复 pending 邀请，但允许已过期邀请后重新创建", async () => {
    const admin = await seedAdmin();

    await createAdminInvitation(
      {
        identifier: "operator@example.com",
        rolePreset: "operator",
        accessPreset: "admin_console",
      },
      {
        actorAdminUserId: admin.id,
        now: new Date("2026-05-01T00:00:00.000Z"),
      },
    );

    await expect(
      createAdminInvitation(
        {
          identifier: "operator@example.com",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        {
          actorAdminUserId: admin.id,
          now: new Date("2026-05-02T00:00:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      target: "identifier",
    });

    await expect(
      createAdminInvitation(
        {
          identifier: "operator@example.com",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        {
          actorAdminUserId: admin.id,
          now: new Date("2026-05-09T00:00:00.001Z"),
        },
      ),
    ).resolves.toMatchObject({
      identifier: "operator@example.com",
      status: "pending",
    });
  });

  it("撤销 pending 邀请并记录 admin_invitation_revoked 动作", async () => {
    const admin = await seedAdmin();
    const invitation = await createAdminInvitation(
      {
        identifier: "operator@example.com",
        rolePreset: "operator",
        accessPreset: "admin_console",
      },
      { actorAdminUserId: admin.id },
    );

    await expect(
      revokeAdminInvitation(invitation.id, {
        actorAdminUserId: admin.id,
        now: new Date("2026-05-28T13:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      id: invitation.id,
      status: "revoked",
      updatedAt: "2026-05-28T13:00:00.000Z",
    });
  });
});
