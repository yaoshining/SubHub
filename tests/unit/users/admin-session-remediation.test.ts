import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getStorageClient,
  closePGliteStorageForTesting,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../../helpers/pglite-storage-client";

import { remediateAdminSession } from "@/server/services/admin-session-service";
import {
  adminActionResults,
  adminSessions,
  adminUsers,
} from "@/server/storage/schema";

let tempDir: string;

const toIsoString = (value: string | null) =>
  value ? new Date(value).toISOString() : null;

const seedSession = async () => {
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

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-admin-session-service-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Admin session remediation service", () => {
  it("revoke 会把 needs_attention 会话撤销为 revoked 并记录 admin_session_remediated 动作", async () => {
    await seedSession();

    const result = await remediateAdminSession(
      "session_attention",
      { action: "revoke", reason: "admin_review" },
      {
        actorAdminUserId: "admin_owner",
        now: new Date("2026-05-28T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      sessionId: "session_attention",
      status: "revoked",
      action: "revoke",
    });

    const [session] = await getStorageClient().db.select().from(adminSessions);
    expect(session).toMatchObject({
      id: "session_attention",
      status: "revoked",
      remediatedByAdminUserId: "admin_owner",
    });
    expect(toIsoString(session.remediatedAt)).toBe("2026-05-28T12:00:00.000Z");

    const actions = await getStorageClient()
      .db.select()
      .from(adminActionResults);
    expect(actions).toEqual([
      expect.objectContaining({
        actionType: "admin_session_remediated",
        targetType: "admin_session",
        targetId: "session_attention",
        result: "success",
      }),
    ]);
  });

  it("mark_resolved 会把 needs_attention 会话标记为 remediated", async () => {
    await seedSession();

    const result = await remediateAdminSession(
      "session_attention",
      { action: "mark_resolved", reason: "checked" },
      {
        actorAdminUserId: "admin_owner",
        now: new Date("2026-05-28T12:05:00.000Z"),
      },
    );

    expect(result).toEqual({
      sessionId: "session_attention",
      status: "remediated",
      action: "mark_resolved",
    });

    const [session] = await getStorageClient().db.select().from(adminSessions);
    expect(session).toMatchObject({
      id: "session_attention",
      status: "remediated",
      remediatedByAdminUserId: "admin_owner",
    });
    expect(toIsoString(session.remediatedAt)).toBe("2026-05-28T12:05:00.000Z");
  });

  it("拒绝处置非 needs_attention 会话，避免扩展为完整风控平台", async () => {
    await seedSession();
    await remediateAdminSession(
      "session_attention",
      { action: "mark_resolved", reason: "checked" },
      { actorAdminUserId: "admin_owner" },
    );

    await expect(
      remediateAdminSession(
        "session_attention",
        { action: "revoke", reason: "again" },
        { actorAdminUserId: "admin_owner" },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      target: "sessionId",
    });
  });
});
