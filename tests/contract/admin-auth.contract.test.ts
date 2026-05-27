import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { adminSessionCookieName } from "@/lib/auth/constants";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as bootstrapStatusRoute from "@/app/api/admin/bootstrap/status/route";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as logoutRoute from "@/app/api/admin/auth/logout/route";
import * as meRoute from "@/app/api/admin/auth/me/route";
import * as dashboardSummaryRoute from "@/app/api/admin/dashboard/summary/route";
import { expectApiError } from "../helpers/api";

let tempDir: string;

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const nextRequest = (url: string, cookie?: string, method = "GET") =>
  new NextRequest(url, {
    method,
    headers: cookie ? { cookie } : undefined,
  });

const readJson = async <T>(response: Response) => (await response.json()) as T;

const extractSessionCookie = (response: Response) => {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toContain(`${adminSessionCookieName}=`);

  return setCookie?.split(";")[0] ?? "";
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-admin-auth-contract-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("管理员初始化与认证 API 契约", () => {
  it("返回初始化状态并拒绝重复初始化", async () => {
    const initialStatus = await bootstrapStatusRoute.GET();
    await expect(readJson(initialStatus)).resolves.toEqual({
      data: { initialized: false },
    });

    const bootstrap = await bootstrapRoute.POST(
      jsonRequest("http://localhost/api/admin/bootstrap", {
        identifier: "Admin@Example.com",
        displayName: "Admin",
        password: "CorrectHorse42!",
      }),
    );
    const bootstrapPayload = await readJson<{
      data: { adminUserId: string; status: string };
    }>(bootstrap);

    expect(bootstrap.status).toBe(201);
    expect(bootstrapPayload.data.adminUserId).toMatch(/^admin_/);
    expect(bootstrapPayload.data.status).toBe("active");

    const duplicated = await bootstrapRoute.POST(
      jsonRequest("http://localhost/api/admin/bootstrap", {
        identifier: "another@example.com",
        displayName: "Another",
        password: "CorrectHorse42!",
      }),
    );

    await expectApiError(duplicated, "FORBIDDEN");
  });

  it("完成登录、当前用户查询、Dashboard summary 与登出契约", async () => {
    await bootstrapRoute.POST(
      jsonRequest("http://localhost/api/admin/bootstrap", {
        identifier: "admin@example.com",
        displayName: "Admin",
        password: "CorrectHorse42!",
      }),
    );

    const invalidLogin = await loginRoute.POST(
      jsonRequest("http://localhost/api/admin/auth/login", {
        identifier: "admin@example.com",
        password: "wrong-password",
      }),
    );
    await expectApiError(invalidLogin, "AUTHENTICATION_REQUIRED");

    const login = await loginRoute.POST(
      jsonRequest("http://localhost/api/admin/auth/login", {
        identifier: "admin@example.com",
        password: "CorrectHorse42!",
      }),
    );
    const loginPayload = await readJson<{
      data: { admin: { identifier: string; displayName: string; role: string } };
    }>(login);
    const cookie = extractSessionCookie(login);

    expect(login.status).toBe(200);
    expect(loginPayload.data.admin).toEqual({
      identifier: "admin@example.com",
      displayName: "Admin",
      role: "admin",
      id: expect.stringMatching(/^admin_/),
    });

    const me = await meRoute.GET(nextRequest("http://localhost/api/admin/auth/me", cookie));
    const mePayload = await readJson<{
      data: { admin: { identifier: string; displayName: string } };
    }>(me);
    expect(me.status).toBe(200);
    expect(mePayload.data.admin.identifier).toBe("admin@example.com");

    const summary = await dashboardSummaryRoute.GET(
      nextRequest("http://localhost/api/admin/dashboard/summary", cookie),
    );
    const summaryPayload = await readJson<{
      data: {
        readiness: {
          adminInitialized: boolean;
          gatewayReady: boolean;
          missingConditions: string[];
        };
      };
    }>(summary);
    expect(summary.status).toBe(200);
    expect(summaryPayload.data.readiness).toMatchObject({
      adminInitialized: true,
      gatewayReady: false,
      missingConditions: ["provider", "caller_key"],
    });

    const logout = await logoutRoute.POST(
      nextRequest("http://localhost/api/admin/auth/logout", cookie, "POST"),
    );
    expect(logout.status).toBe(204);

    const afterLogout = await meRoute.GET(
      nextRequest("http://localhost/api/admin/auth/me", cookie),
    );
    await expectApiError(afterLogout, "AUTHENTICATION_REQUIRED");
  });
});
