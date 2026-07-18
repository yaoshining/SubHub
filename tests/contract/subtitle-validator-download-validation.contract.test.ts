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
import { expectApiError } from "../helpers/api";

const { validateSubtitleDownload } = vi.hoisted(() => ({
  validateSubtitleDownload: vi.fn(),
}));
vi.mock("@/server/subtitles/admin-subtitle-validator", () => ({
  validateSubtitleDownload,
}));

import { adminSessionCookieName } from "@/lib/auth/constants";
import * as bootstrapRoute from "@/app/api/admin/bootstrap/route";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import * as downloadValidationRoute from "@/app/api/admin/subtitle-validator/download-validation/route";
import { subtitleValidatorDownloadValidationResponseSchema } from "@/server/subtitles/admin-subtitle-validator-schema";

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

const createResult = (
  status: "success" | "failed" | "missing_download" | "unsupported",
) => ({
  subtitleRef: "xunlei:provider-xl:subtitle-1",
  resultId: "xunlei:provider-xl:subtitle-1",
  provider: "xunlei" as const,
  status,
  httpStatus: status === "success" ? 204 : null,
  message:
    status === "success"
      ? "下载 URL 可访问。"
      : "下载验证未能完成，但未返回敏感信息。",
  fileName: null,
  contentType: null,
  contentLength: null,
  downloadMode: "url_check" as const,
  browserDownloadUrl: null,
  diagnostic: {
    action: "download_validation" as const,
    provider: "xunlei" as const,
    providerName: "Xunlei",
    providerStatus: "enabled" as const,
    status: status === "success" ? ("success" as const) : ("error" as const),
    resultCount: status === "success" ? 1 : 0,
    elapsedMs: 12,
    summary: "Xunlei download validation result",
    errorCategory: status === "success" ? null : ("download_failed" as const),
    nextActionHint: status === "success" ? null : "检查下载模式或结果。",
    fileName: null,
    downloadMode: "url_check" as const,
  },
});

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-validator-download-contract-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.pglite"));
  await getStorageClient().migrate();
  validateSubtitleDownload.mockReset();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Subtitle Validator 下载验证 API 契约", () => {
  it("要求管理员会话", async () => {
    const response = await downloadValidationRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/subtitle-validator/download-validation",
        {
          providerId: "provider-xl",
          resultId: "xunlei:provider-xl:subtitle-1",
          mode: "url_check",
        },
      ),
    );

    await expectApiError(response, "AUTHENTICATION_REQUIRED");
  });

  it.each(["success", "failed", "missing_download", "unsupported"] as const)(
    "将 %s 作为 200 下载验证状态返回，且不回显 secret",
    async (status) => {
      validateSubtitleDownload.mockResolvedValue(createResult(status));
      const cookie = await createAdminSessionCookie();
      const request = {
        providerId: "provider-xl",
        resultId: "xunlei:provider-xl:subtitle-1",
        mode: "url_check",
        downloadReference: "https://downloads.example.com/subtitle.srt",
      };

      const response = await downloadValidationRoute.POST(
        jsonRequest(
          "http://localhost/api/admin/subtitle-validator/download-validation",
          request,
          cookie,
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(
        subtitleValidatorDownloadValidationResponseSchema.safeParse(payload)
          .success,
      ).toBe(true);
      expect(payload.data.status).toBe(status);
      expect(validateSubtitleDownload).toHaveBeenCalledWith(request);
      expect(JSON.stringify(payload)).not.toMatch(/secret|token|credential/i);
    },
  );

  it("在服务调用前拒绝不完整的新下载验证请求", async () => {
    const cookie = await createAdminSessionCookie();
    const response = await downloadValidationRoute.POST(
      jsonRequest(
        "http://localhost/api/admin/subtitle-validator/download-validation",
        { providerId: "provider-xl", mode: "url_check" },
        cookie,
      ),
    );

    expect(response.status).toBe(400);
    await expectApiError(response, "VALIDATION_FAILED");
    expect(validateSubtitleDownload).not.toHaveBeenCalled();
  });
});
