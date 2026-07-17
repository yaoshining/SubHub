import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closePGliteStorageForTesting,
  getStorageClient,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../helpers/pglite-storage-client";

const { searchSubtitleValidator } = vi.hoisted(() => ({
  searchSubtitleValidator: vi.fn(),
}));
vi.mock("@/server/subtitles/admin-subtitle-validator", () => ({
  searchSubtitleValidator,
}));

import { adminSessionCookieName } from "@/lib/auth/constants";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as searchRoute from "@/app/api/admin/subtitle-validator/search/route";
import { expectApiError } from "../helpers/api";
import { subtitleValidatorSearchResponseSchema } from "@/server/subtitles/admin-subtitle-validator-schema";

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

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-validator-search-contract-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
  searchSubtitleValidator.mockReset();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Subtitle Validator 搜索 API 契约", () => {
  it("要求管理员会话", async () => {
    const response = await searchRoute.POST(
      jsonRequest("http://localhost/api/admin/subtitle-validator/search", {
        providerId: "provider-os",
        baseParams: { keyword: "Matrix" },
        providerParams: {},
      }),
    );

    await expectApiError(response, "AUTHENTICATION_REQUIRED");
  });

  it("返回 200 empty 成功结构且不回显凭据", async () => {
    searchSubtitleValidator.mockResolvedValue({
      status: "empty",
      results: [],
      providerFailures: [],
      diagnostic: {
        action: "search",
        provider: "opensubtitles",
        providerName: "OpenSubtitles",
        providerStatus: "enabled",
        status: "empty",
        resultCount: 0,
        elapsedMs: 12,
        summary: "OpenSubtitles returned no results",
        errorCategory: "empty_results",
        nextActionHint: "调整关键词后重试。",
        fileName: null,
        downloadMode: null,
      },
    });
    const cookie = await createAdminSessionCookie();
    const request = {
      providerId: "provider-os",
      baseParams: { keyword: "Matrix" },
      providerParams: { language: "zh-CN" },
    };

    const response = await searchRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/subtitle-validator/search",
        request,
        cookie,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(
      subtitleValidatorSearchResponseSchema.safeParse(payload).success,
    ).toBe(true);
    expect(payload.data.status).toBe("empty");
    expect(searchSubtitleValidator).toHaveBeenCalledWith(request);
    expect(JSON.stringify(payload)).not.toMatch(/secret|token|credential/i);
  });

  it("在服务调用前拒绝非法 provider 参数负载", async () => {
    const cookie = await createAdminSessionCookie();
    const response = await searchRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/subtitle-validator/search",
        {
          providerId: "provider-os",
          baseParams: { keyword: "Matrix" },
          providerParams: { season: { value: 1 } },
        },
        cookie,
      ),
    );

    expect(response.status).toBe(400);
    await expectApiError(response, "VALIDATION_FAILED");
    expect(searchSubtitleValidator).not.toHaveBeenCalled();
  });
});
