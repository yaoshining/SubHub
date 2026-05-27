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
import {
  createStorageClient,
  type StorageClient,
} from "@/server/storage/client";

const now = new Date("2026-05-26T00:00:00.000Z");
let tempDir: string;
let client: StorageClient;

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
    sqlitePath: join(tempDir, "test.sqlite"),
    runMigrations: true,
  });
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
