import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { and, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "../helpers/pglite-storage-client";

import { adminSessionCookieName } from "@/lib/auth/constants";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as usersRoute from "@/app/api/admin/users/route";
import * as invitationsRoute from "@/app/api/admin/users/invitations/route";
import * as suspendRoute from "@/app/api/admin/users/[userId]/suspend/route";
import * as restoreRoute from "@/app/api/admin/users/[userId]/restore/route";
import * as remediateRoute from "@/app/api/admin/sessions/[sessionId]/remediate/route";
import {
  adminActionResults,
  adminSessions,
  adminUsers,
} from "@/server/storage/schema";

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

const seedOperatorWithSessions = async () => {
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

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-users-flow-"));
  await setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closeStorageClient();
  await resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Users 管理闭环", () => {
  it("可完成邀请、暂停恢复成员与基础会话处置，并留下最小审计轨迹", async () => {
    const cookie = await createAdminSessionCookie();
    await seedOperatorWithSessions();

    const invitation = await invitationsRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/users/invitations",
        {
          identifier: "new-operator@example.com",
          rolePreset: "operator",
          accessPreset: "admin_console",
        },
        cookie,
      ),
    );
    expect(invitation.status).toBe(201);

    await expect(
      readJson<{
        data: {
          identifier: string;
          rolePreset: string;
          accessPreset: string;
          status: string;
        };
      }>(invitation),
    ).resolves.toMatchObject({
      data: {
        identifier: "new-operator@example.com",
        rolePreset: "operator",
        accessPreset: "admin_console",
        status: "pending",
      },
    });

    const initialOverview = await usersRoute.GET(
      nextRequest("http://localhost/api/admin/users", cookie),
    );
    await expect(
      readJson<{
        data: {
          members: Array<{ id: string; status: string }>;
          invitations: Array<{ identifier: string; status: string }>;
          sessionsNeedingAttention: Array<{
            id: string;
            reason: string | null;
          }>;
        };
      }>(initialOverview),
    ).resolves.toMatchObject({
      data: {
        members: expect.arrayContaining([
          expect.objectContaining({
            id: "admin_operator",
            status: "active",
          }),
        ]),
        invitations: expect.arrayContaining([
          expect.objectContaining({
            identifier: "new-operator@example.com",
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
    await expect(
      readJson<{ data: { id: string; status: string } }>(suspended),
    ).resolves.toEqual({
      data: expect.objectContaining({
        id: "admin_operator",
        status: "suspended",
      }),
    });

    const revokedSessions = await getStorageClient()
      .db.select({
        id: adminSessions.id,
        status: adminSessions.status,
      })
      .from(adminSessions)
      .where(
        inArray(adminSessions.id, ["session_active", "session_attention"]),
      );
    expect(revokedSessions).toEqual(
      expect.arrayContaining([
        { id: "session_active", status: "revoked" },
        { id: "session_attention", status: "revoked" },
      ]),
    );

    const restored = await restoreRoute.POST(
      nextRequest(
        "http://localhost/api/admin/users/admin_operator/restore",
        cookie,
        "POST",
      ),
      { params: { userId: "admin_operator" } },
    );
    await expect(
      readJson<{ data: { id: string; status: string } }>(restored),
    ).resolves.toEqual({
      data: expect.objectContaining({
        id: "admin_operator",
        status: "active",
      }),
    });

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
        {
          action: "mark_resolved",
          reason: "管理员已复核并确认",
        },
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
        status: "remediated",
        action: "mark_resolved",
      },
    });

    const finalOverview = await usersRoute.GET(
      nextRequest("http://localhost/api/admin/users", cookie),
    );
    await expect(
      readJson<{
        data: {
          members: Array<{ id: string; status: string }>;
          sessionsNeedingAttention: Array<{ id: string }>;
        };
      }>(finalOverview),
    ).resolves.toMatchObject({
      data: {
        members: expect.arrayContaining([
          expect.objectContaining({
            id: "admin_operator",
            status: "active",
          }),
        ]),
        sessionsNeedingAttention: [],
      },
    });

    const [operator] = await getStorageClient()
      .db.select({
        status: adminUsers.status,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, "admin_operator"));
    expect(operator?.status).toBe("active");

    const [owner] = await getStorageClient()
      .db.select({
        id: adminUsers.id,
      })
      .from(adminUsers)
      .where(eq(adminUsers.identifier, "admin@example.com"));
    const ownerId = owner?.id;
    expect(ownerId).toBeTruthy();
    if (!ownerId) {
      throw new Error("expected bootstrap owner id");
    }

    const [remediatedSession] = await getStorageClient()
      .db.select({
        status: adminSessions.status,
        remediatedByAdminUserId: adminSessions.remediatedByAdminUserId,
      })
      .from(adminSessions)
      .where(eq(adminSessions.id, "session_attention_second"));
    expect(remediatedSession).toEqual({
      status: "remediated",
      remediatedByAdminUserId: ownerId,
    });

    const actions = await getStorageClient()
      .db.select({
        actionType: adminActionResults.actionType,
        result: adminActionResults.result,
      })
      .from(adminActionResults)
      .where(
        and(
          eq(adminActionResults.actorAdminUserId, ownerId),
          inArray(adminActionResults.actionType, [
            "bootstrap_admin_created",
            "admin_login",
            "admin_invitation_created",
            "admin_user_suspended",
            "admin_user_restored",
            "admin_session_remediated",
          ]),
        ),
      );
    expect(actions).toEqual(
      expect.arrayContaining([
        { actionType: "bootstrap_admin_created", result: "success" },
        { actionType: "admin_login", result: "success" },
        { actionType: "admin_invitation_created", result: "success" },
        { actionType: "admin_user_suspended", result: "success" },
        { actionType: "admin_user_restored", result: "success" },
        { actionType: "admin_session_remediated", result: "success" },
      ]),
    );
  });
});
