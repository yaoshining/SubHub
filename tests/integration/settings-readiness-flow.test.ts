import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as React from "react";
import { screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SettingsClient } from "@/app/(admin)/settings/settings-client";
import { adminSessionCookieName } from "@/lib/auth/constants";
import type { SettingsStatus } from "@/lib/api/settings";
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
import { renderWithTheme } from "../helpers/ui";

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

const readJson = async <TData>(response: Response) =>
  (await response.json()) as TData;

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
  tempDir = mkdtempSync(join(tmpdir(), "subhub-settings-flow-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Settings 状态确认与配置分流闭环", () => {
  it("从未就绪原因提示过渡到就绪态，并始终保持只读分流", async () => {
    const cookie = await createAdminSessionCookie();

    const initialResponse = await settingsStatusRoute.GET(
      nextRequest("http://localhost/api/admin/settings/status", cookie),
    );
    const initialPayload = await readJson<{
      data: SettingsStatus;
    }>(initialResponse);

    expect(initialResponse.status).toBe(200);
    expect(initialPayload.data).toMatchObject({
      adminInitialized: true,
      activeProviderCount: 0,
      activeCallerKeyCount: 0,
      gatewayReady: false,
      missingConditions: ["provider", "caller_key"],
    });

    const { unmount } = renderWithTheme(
      React.createElement(SettingsClient, { initialStatus: initialPayload.data }),
    );

    expect(screen.getByTestId("settings-not-ready")).toHaveTextContent(
      "缺失条件：可用 Provider、调用方 Key",
    );
    expect(
      screen.getByRole("link", { name: "前往服务商页补齐 Provider 与凭据" }),
    ).toHaveAttribute("href", "/providers");
    expect(
      screen.getByRole("link", { name: "前往 API 密钥页补齐调用方 Key" }),
    ).toHaveAttribute("href", "/api-keys");
    expect(screen.getByRole("link", { name: "前往用户页" })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(
      screen.queryByRole("button", { name: /保存|提交|测试连接/ }),
    ).not.toBeInTheDocument();

    unmount();

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

    const readyResponse = await settingsStatusRoute.GET(
      nextRequest("http://localhost/api/admin/settings/status", cookie),
    );
    const readyPayload = await readJson<{
      data: SettingsStatus;
    }>(readyResponse);

    expect(readyResponse.status).toBe(200);
    expect(readyPayload.data).toMatchObject({
      activeProviderCount: 1,
      activeCallerKeyCount: 1,
      gatewayReady: true,
      missingConditions: [],
    });

    renderWithTheme(
      React.createElement(SettingsClient, { initialStatus: readyPayload.data }),
    );

    expect(screen.getByText("统一出口已就绪")).toBeInTheDocument();
    expect(screen.getByText("服务商详情")).toBeInTheDocument();
    expect(screen.getByText("API 密钥")).toBeInTheDocument();
    expect(screen.getByText("用户")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-not-ready")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /保存|提交|测试连接/ }),
    ).not.toBeInTheDocument();
  });
});
