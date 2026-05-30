import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { adminSessionCookieName } from "@/lib/auth/constants";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as settingsStatusRoute from "@/app/api/admin/settings/status/route";
import { createCallerKey } from "@/server/services/caller-key-service";
import { createProvider } from "@/server/services/provider-service";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";
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

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-settings-contract-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Settings status API 契约", () => {
  it("要求管理员会话", async () => {
    const response = await settingsStatusRoute.GET(
      nextRequest("http://localhost/api/admin/settings/status"),
    );

    await expectApiError(response, "AUTHENTICATION_REQUIRED");
  });

  it("返回聚合后的系统 readiness 与局部失败数组", async () => {
    const cookie = await createAdminSessionCookie();

    await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });
    await createCallerKey({
      callerName: "Jellyfin Home",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    const response = await settingsStatusRoute.GET(
      nextRequest("http://localhost/api/admin/settings/status", cookie),
    );
    const payload = await readJson<{
      data: {
        environment: string;
        version: string;
        adminInitialized: boolean;
        activeProviderCount: number;
        activeCallerKeyCount: number;
        gatewayReady: boolean;
        missingConditions: string[];
        lastCheckedAt: string;
        partialErrors: Array<{
          target: string;
          code: string;
          message: string;
        }>;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      environment: "test",
      version: "0.1.0",
      adminInitialized: true,
      activeProviderCount: 1,
      activeCallerKeyCount: 1,
      gatewayReady: true,
      missingConditions: [],
      partialErrors: [],
    });
    expect(payload.data.lastCheckedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });
});
