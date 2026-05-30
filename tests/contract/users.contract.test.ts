import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { adminSessionCookieName } from "@/lib/auth/constants";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as usersRoute from "@/app/api/admin/users/route";
import * as invitationsRoute from "@/app/api/admin/users/invitations/route";
import * as suspendRoute from "@/app/api/admin/users/[userId]/suspend/route";
import * as restoreRoute from "@/app/api/admin/users/[userId]/restore/route";
import * as remediateRoute from "@/app/api/admin/sessions/[sessionId]/remediate/route";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";
import { adminSessions, adminUsers } from "@/server/storage/schema";
import { expectApiError } from "../helpers/api";

let tempDir: string;

const jsonRequest = (url: string, body: unknown, cookie?: string) =>
  new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const nextRequest = (url: string, cookie?: string, method = "GET") =>
  new NextRequest(url, {
    method,
    headers: cookie ? { cookie } : undefined,
  });

const readJson = async <T>(response: Response) => (await response.json()) as T;

const createAdminSessionCookie = async () => {
  await bootstrapRoute.POST(
    jsonRequest("http://localhost/api/admin/bootstrap", {
      identifier: "admin@example.com",
      displayName: "Admin",
      password: "CorrectHorse42!",
    }),
  );
  const login = await loginRoute.POST(
    jsonRequest("http://localhost/api/admin/auth/login", {
      identifier: "admin@example.com",
      password: "CorrectHorse42!",
    }),
  );
  const setCookie = login.headers.get("set-cookie");
  expect(setCookie).toContain(`${adminSessionCookieName}=`);

  return setCookie?.split(";")[0] ?? "";
};

const getAdminUserIdByIdentifier = async (identifier: string) => {
  const [adminUser] = await getStorageClient()
    .db.select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.identifier, identifier))
    .limit(1);

  return adminUser?.id;
};

const seedOperatorAndAttentionSession = async () => {
  const db = getStorageClient().db;
  await db.insert(adminUsers).values({
    id: "admin_operator",
    identifier: "operator@example.com",
    displayName: "Operator",
    passwordHash: "hash",
    role: "operator",
    status: "active",
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
  });
  await db.insert(adminSessions).values({
    id: "session_attention",
    adminUserId: "admin_operator",
    sessionTokenHash: "hash_attention",
    status: "needs_attention",
    createdAt: "2026-05-28T00:00:00.000Z",
    expiresAt: "2026-05-29T00:00:00.000Z",
    lastSeenAt: "2026-05-28T11:00:00.000Z",
    deviceLabel: "Unknown device",
    attentionReason: "unusual_location",
  });
};

const seedBackupAdmin = async () => {
  await getStorageClient().db.insert(adminUsers).values({
    id: "admin_backup",
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
  tempDir = mkdtempSync(join(tmpdir(), "subhub-users-contract-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Users 管理 API 契约", () => {
  it("要求管理员会话", async () => {
    const response = await usersRoute.GET(
      nextRequest("http://localhost/api/admin/users"),
    );

    await expectApiError(response, "AUTHENTICATION_REQUIRED");
  });

  it("覆盖 list/create invitation/suspend/restore/remediate 且不暴露密码哈希", async () => {
    const cookie = await createAdminSessionCookie();
    await seedOperatorAndAttentionSession();

    const createdInvitation = await invitationsRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/users/invitations",
        {
          identifier: "Invited@Example.com",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        cookie,
      ),
    );
    expect(createdInvitation.status).toBe(201);
    const createdInvitationPayload = await readJson<{
      data: {
        identifier: string;
        status: string;
        rolePreset: string;
        accessPreset: string;
        invitedByAdminUserId?: string;
        acceptedAdminUserId?: string | null;
        acceptedAt?: string | null;
        revokedAt?: string | null;
      };
    }>(createdInvitation);
    expect(createdInvitationPayload).toEqual({
      data: expect.objectContaining({
        identifier: "invited@example.com",
        status: "pending",
        rolePreset: "operator",
        accessPreset: "admin_console",
      }),
    });
    expect(createdInvitationPayload.data).not.toHaveProperty(
      "invitedByAdminUserId",
    );
    expect(createdInvitationPayload.data).not.toHaveProperty(
      "acceptedAdminUserId",
    );
    expect(createdInvitationPayload.data).not.toHaveProperty("acceptedAt");
    expect(createdInvitationPayload.data).not.toHaveProperty("revokedAt");

    const duplicateInvitation = await invitationsRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/users/invitations",
        {
          identifier: "invited@example.com",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        cookie,
      ),
    );
    expect(duplicateInvitation.status).toBe(400);
    await expectApiError(duplicateInvitation, "VALIDATION_FAILED");

    const list = await usersRoute.GET(
      nextRequest("http://localhost/api/admin/users", cookie),
    );
    await expect(
      readJson<{
        data: {
          members: Array<{ id: string; rolePreset: string }>;
          invitations: Array<{ identifier: string; status: string }>;
          sessionsNeedingAttention: Array<{ id: string; reason: string }>;
        };
      }>(list),
    ).resolves.toMatchObject({
      data: {
        members: expect.arrayContaining([
          expect.objectContaining({
            id: "admin_operator",
            rolePreset: "operator",
          }),
        ]),
        invitations: expect.arrayContaining([
          expect.objectContaining({
            identifier: "invited@example.com",
            status: "pending",
          }),
        ]),
        sessionsNeedingAttention: [
          expect.objectContaining({
            id: "session_attention",
            reason: "unusual_location",
          }),
        ],
      },
    });

    const suspended = await suspendRoute.POST(
      nextRequest(
        "http://localhost/api/admin/users/admin_operator/suspend",
        cookie,
        "POST",
      ),
      { params: { userId: "admin_operator" } },
    );
    const suspendedPayload = await readJson<{
      data: { id: string; status: string; passwordHash?: string };
    }>(suspended);
    expect(suspendedPayload.data).toEqual(
      expect.objectContaining({
        id: "admin_operator",
        status: "suspended",
      }),
    );
    expect(suspendedPayload.data).not.toHaveProperty("passwordHash");

    const restored = await restoreRoute.POST(
      nextRequest(
        "http://localhost/api/admin/users/admin_operator/restore",
        cookie,
        "POST",
      ),
      { params: { userId: "admin_operator" } },
    );
    const restoredPayload = await readJson<{
      data: { id: string; status: string; passwordHash?: string };
    }>(restored);
    expect(restoredPayload).toEqual({
      data: expect.objectContaining({
        id: "admin_operator",
        status: "active",
      }),
    });
    expect(restoredPayload.data).not.toHaveProperty("passwordHash");
    expect(restoredPayload.data).not.toHaveProperty("sessionTokenHash");
    expect(restoredPayload.data).not.toHaveProperty("attentionReason");

    await getStorageClient().db.insert(adminSessions).values({
      id: "session_attention_second",
      adminUserId: "admin_operator",
      sessionTokenHash: "hash_attention_second",
      status: "needs_attention",
      createdAt: "2026-05-28T00:00:00.000Z",
      expiresAt: "2026-05-29T00:00:00.000Z",
      lastSeenAt: "2026-05-28T11:30:00.000Z",
      deviceLabel: "Unknown device",
      attentionReason: "admin_review",
    });
    const remediated = await remediateRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/sessions/session_attention_second/remediate",
        { action: "revoke", reason: "admin_review" },
        cookie,
      ),
      { params: { sessionId: "session_attention_second" } },
    );
    await expect(
      readJson<{ data: { sessionId: string; status: string; action: string } }>(
        remediated,
      ),
    ).resolves.toEqual({
      data: {
        sessionId: "session_attention_second",
        status: "revoked",
        action: "revoke",
      },
    });
  });

  it("拒绝当前登录管理员暂停自己并返回明确业务原因", async () => {
    const cookie = await createAdminSessionCookie();
    await seedBackupAdmin();
    const ownerId = await getAdminUserIdByIdentifier("admin@example.com");
    expect(ownerId).toBeTruthy();

    const response = await suspendRoute.POST(
      nextRequest(
        `http://localhost/api/admin/users/${ownerId}/suspend`,
        cookie,
        "POST",
      ),
      { params: { userId: ownerId! } },
    );

    expect(response.status).toBe(403);
    const payload = await expectApiError(response, "FORBIDDEN");
    expect(payload.error.message).toBe("当前登录管理员不能暂停自己。");
  });

  it("拒绝暂停最后一个 active admin 并返回明确业务原因", async () => {
    const cookie = await createAdminSessionCookie();
    const ownerId = await getAdminUserIdByIdentifier("admin@example.com");
    expect(ownerId).toBeTruthy();

    const response = await suspendRoute.POST(
      nextRequest(
        `http://localhost/api/admin/users/${ownerId}/suspend`,
        cookie,
        "POST",
      ),
      { params: { userId: ownerId! } },
    );

    expect(response.status).toBe(403);
    const payload = await expectApiError(response, "FORBIDDEN");
    expect(payload.error.message).toBe("最后一个 active admin 不可被暂停。");
  });
});
