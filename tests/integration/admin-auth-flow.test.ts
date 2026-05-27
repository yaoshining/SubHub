import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { adminActionResults, adminSessions } from "@/server/storage/schema";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";
import { middleware } from "@/middleware";
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
    expect(actions.map((action) => [action.actionType, action.result])).toEqual(
      [
        ["bootstrap_admin_created", "success"],
        ["admin_login", "failed"],
        ["admin_login", "success"],
      ],
    );

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
    const loginApi = middleware(
      new NextRequest("http://localhost/api/admin/auth/login", {
        method: "POST",
      }),
    );
    const protectedPage = middleware(
      new NextRequest("http://localhost/dashboard"),
    );

    expect(loginApi?.status).toBe(200);
    expect(protectedPage?.status).toBe(307);
    expect(protectedPage?.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fdashboard",
    );
  });
});
