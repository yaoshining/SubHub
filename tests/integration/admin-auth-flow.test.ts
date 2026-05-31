import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  adminActionResults,
  adminSessions,
  type AdminActionResult,
} from "@/server/storage/schema";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";
import { proxy } from "@/proxy";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as logoutRoute from "@/app/api/admin/auth/logout/route";

let tempDir: string;

const postJson = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-admin-auth-flow-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("首个管理员认证流程", () => {
  it("记录初始化和登录结果，并在登出后撤销会话", async () => {
    const bootstrap = await bootstrapRoute.POST(
      postJson("http://localhost/api/admin/bootstrap", {
        identifier: "Admin@Example.com",
        displayName: "Admin",
        password: "CorrectHorse42!",
      }),
    );
    expect(bootstrap.status).toBe(201);

    const failedLogin = await loginRoute.POST(
      postJson("http://localhost/api/admin/auth/login", {
        identifier: "admin@example.com",
        password: "bad-password",
      }),
    );
    expect(failedLogin.status).toBe(401);

    const login = await loginRoute.POST(
      postJson("http://localhost/api/admin/auth/login", {
        identifier: "admin@example.com",
        password: "CorrectHorse42!",
      }),
    );
    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(cookie).toContain("subhub_admin_session=");

    const client = getStorageClient();
    const actions = await client.db
      .select()
      .from(adminActionResults)
      .orderBy(adminActionResults.createdAt);
    expect(
      actions.map((action: AdminActionResult) => [action.actionType, action.result]),
    ).toEqual([
      ["bootstrap_admin_created", "success"],
      ["admin_login", "failed"],
      ["admin_login", "success"],
    ]);

    const logout = await logoutRoute.POST(
      new NextRequest("http://localhost/api/admin/auth/logout", {
        method: "POST",
        headers: { cookie },
      }),
    );
    expect(logout.status).toBe(204);

    const sessions = await client.db.select().from(adminSessions);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.status).toBe("revoked");
  });

  it("允许公开初始化与登录 API，同时拦截未登录后台页面", () => {
    const loginApi = proxy(
      new NextRequest("http://localhost/api/admin/auth/login", {
        method: "POST",
      }),
    );

    expect(loginApi?.status).toBe(200);
    for (const path of [
      "/dashboard",
      "/providers",
      "/api-keys",
      "/users",
      "/settings",
    ]) {
      const protectedPage = proxy(new NextRequest(`http://localhost${path}`));

      expect(protectedPage?.status).toBe(307);
      expect(protectedPage?.headers.get("location")).toBe(
        `http://localhost/login?next=${encodeURIComponent(path)}`,
      );
    }
  });

  it("拦截未登录后台页面时保留原目标查询参数", () => {
    const protectedPage = proxy(
      new NextRequest("http://localhost/providers?status=degraded"),
    );

    expect(protectedPage?.status).toBe(307);
    expect(protectedPage?.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fproviders%3Fstatus%3Ddegraded",
    );
  });

  it("已有脏会话 cookie 时向后续后台布局传递完整原目标", () => {
    const response = proxy(
      new NextRequest("http://localhost/users?page=2", {
        headers: { cookie: "subhub_admin_session=stale-session-token" },
      }),
    );

    expect(response?.status).toBe(200);
    expect(
      response?.headers.get("x-middleware-request-x-subhub-admin-pathname"),
    ).toBe("/users?page=2");
  });

  it("未登录访问受保护管理端 API 时返回认证错误", async () => {
    const response = proxy(
      new NextRequest("http://localhost/api/admin/auth/me"),
    );

    expect(response).toBeDefined();
    expect(response?.status).toBe(401);
    await expect(response!.json()).resolves.toMatchObject({
      error: { code: "AUTHENTICATION_REQUIRED", target: "admin_session" },
    });
  });
});
