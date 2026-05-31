import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAdminSession,
  evaluateAdminSessionAccess,
  getAdminSessionByToken,
  revokeAdminSession,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createStorageClient,
  type StorageClient,
} from "@/server/storage/client";

type LegacyStorageClient = StorageClient & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sqlite: any;
};

const now = new Date("2026-05-26T00:00:00.000Z");
let tempDir: string;
let client: LegacyStorageClient;

const insertAdminUser = (status: "active" | "suspended" = "active") => {
  client.sqlite
    .prepare(
      `insert into admin_users (
        id, identifier, display_name, password_hash, status, role, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "admin_session_test",
      "admin-session-test@example.com",
      "Session Test Admin",
      "password_hash",
      status,
      "admin",
      now.toISOString(),
      now.toISOString(),
    );
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-session-"));
  client = createStorageClient({
    runtimeDatabaseUrl: "postgresql://legacy-runtime@localhost:5432/subhub",
    directDatabaseUrl: "postgresql://legacy-direct@localhost:5432/subhub",
  }) as LegacyStorageClient;
  insertAdminUser();
});

afterEach(() => {
  client.close();
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

    client.sqlite
      .prepare(
        "update admin_sessions set status = ?, attention_reason = ? where id = ?",
      )
      .run("needs_attention", "unexpected_location", session.id);

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
