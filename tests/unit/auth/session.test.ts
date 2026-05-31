import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAdminSession,
  evaluateAdminSessionAccess,
  getAdminSessionByToken,
  revokeAdminSession,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
  type StorageClient,
} from "@/server/storage/client";
import { adminSessions, adminUsers } from "@/server/storage/schema";

const now = new Date("2026-05-26T00:00:00.000Z");
let tempDir: string;
let client: StorageClient;

const insertAdminUser = async (
  status: "active" | "suspended" = "active",
) => {
  await client.db.insert(adminUsers).values({
    id: "admin_session_test",
    identifier: "admin-session-test@example.com",
    displayName: "Session Test Admin",
    passwordHash: "password_hash",
    status,
    role: "admin",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
};

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-session-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  client = getStorageClient();
  await client.migrate();
  await insertAdminUser();
});

afterEach(async () => {
  await closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("后台会话访问控制", () => {
  it("允许 active 且未过期的会话访问受保护后台边界", async () => {
    const { token } = await createAdminSession({
      adminUserId: "admin_session_test",
      now,
      db: client.db,
    });

    const session = await getAdminSessionByToken(token, {
      now,
      db: client.db,
    });
    const decision = evaluateAdminSessionAccess(session, { now });

    expect(decision.allowed).toBe(true);
  });

  it("拒绝 revoked 会话", async () => {
    const { token } = await createAdminSession({
      adminUserId: "admin_session_test",
      now,
      db: client.db,
    });

    await revokeAdminSession(token, client.db);
    const session = await getAdminSessionByToken(token, {
      now,
      db: client.db,
    });
    const decision = evaluateAdminSessionAccess(session, { now });

    expect(decision.allowed).toBe(false);
    expect(decision.error?.code).toBe("AUTHENTICATION_REQUIRED");
    expect(decision.error?.target).toBe("admin_session");
  });

  it("将过期会话标记为 expired 并拒绝访问", async () => {
    const { token } = await createAdminSession({
      adminUserId: "admin_session_test",
      now,
      ttlSeconds: 1,
      db: client.db,
    });

    const session = await getAdminSessionByToken(token, {
      now: new Date(now.getTime() + 2000),
      db: client.db,
    });
    const decision = evaluateAdminSessionAccess(session, {
      now: new Date(now.getTime() + 2000),
    });

    expect(session?.status).toBe("expired");
    expect(decision.allowed).toBe(false);
    expect(decision.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("拒绝 needs_attention 风险会话执行高风险管理动作", async () => {
    const { token, session } = await createAdminSession({
      adminUserId: "admin_session_test",
      now,
      db: client.db,
    });

    await client.db
      .update(adminSessions)
      .set({
        status: "needs_attention",
        attentionReason: "unexpected_location",
      })
      .where(eq(adminSessions.id, session.id));

    const riskySession = await getAdminSessionByToken(token, {
      now,
      db: client.db,
    });
    const decision = evaluateAdminSessionAccess(riskySession, {
      now,
      requireHighRiskClearance: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.error?.code).toBe("FORBIDDEN");
    expect(decision.error?.target).toBe("admin_session");
  });
});

describe("后台密码工具", () => {
  it("校验密码时拒绝被篡改成本因子的哈希", async () => {
    const passwordHash = await hashPassword("CorrectHorse42!");
    const weakenedHash = passwordHash.replace(
      "scrypt$16384$8$1$",
      "scrypt$0$0$0$",
    );

    await expect(verifyPassword("CorrectHorse42!", passwordHash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("CorrectHorse42!", weakenedHash)).resolves.toBe(
      false,
    );
  });
});
