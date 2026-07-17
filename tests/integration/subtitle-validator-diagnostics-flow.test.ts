import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import {
  buildSubtitleValidatorDiagnosticSummary,
  classifySubtitleValidatorError,
  searchSubtitleValidator,
} from "@/server/subtitles/admin-subtitle-validator";
import type { SubtitleProviderAdapter } from "@/server/providers/provider-adapter";
import type { ProviderWithCredentialSummary } from "@/server/providers/provider-repository";

describe("subtitle validator diagnostics flow", () => {
  it("provider 返回异常时生成明确错误类别与下一步建议", async () => {
    const provider: ProviderWithCredentialSummary = {
      id: "provider-os",
      name: "OpenSubtitles",
      type: "opensubtitles",
      status: "enabled",
      priority: 1,
      weight: 100,
      concurrencyLimit: 2,
      rotationEnabled: true,
      cooldownSeconds: 30,
      fallbackProviderId: null,
      lastHealthStatus: "ready",
      lastHealthCheckedAt: null,
      lastErrorSummary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeCredentialCount: 1,
      availableCredentialCount: 1,
      credentialCount: 1,
    };

    const adapter: SubtitleProviderAdapter = {
      key: "opensubtitles",
      async search() {
        return {
          ok: false,
          skipped: false,
          error: {
            reason: "upstream_failed",
            message: "provider 返回异常结构: token=secret-value",
          },
        };
      },
    };

    await expect(
      searchSubtitleValidator(
        {
          providerId: "provider-os",
          baseParams: { keyword: "Matrix" },
          providerParams: {},
        },
        {
          db: {} as never,
          now: new Date("2026-07-16T00:00:00.000Z"),
          listProviders: vi.fn().mockResolvedValue([provider]),
          getAdapter: vi.fn().mockReturnValue(adapter),
          selectCredential: vi.fn().mockResolvedValue({
            id: "cred-1",
            secret: "secret",
          }),
          markCredentialUsed: vi.fn(),
          markCredentialFailure: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      code: "UPSTREAM_FAILED",
      message: expect.not.stringContaining("secret-value"),
    });
  });

  it("搜索成功但下载缺失时保留独立 missing_download 语义", () => {
    const classified = classifySubtitleValidatorError(
      new AppError(
        "SUBTITLE_NOT_FOUND",
        "未找到可下载的字幕项。",
        "subtitleRef",
      ),
      "未找到可下载的字幕项。",
    );

    const summary = buildSubtitleValidatorDiagnosticSummary({
      action: "download_validation",
      providerKey: "xunlei",
      providerName: "Xunlei",
      providerStatus: "disabled",
      status: "error",
      resultCount: 0,
      elapsedMs: 120,
      downloadMode: "url_check",
      error: classified,
    });

    expect(summary.errorCategory).toBe("missing_download");
    expect(summary.nextActionHint).toContain("没有可验证的下载目标");
    expect(summary.summary).toContain("disabled");
    expect(summary.summary).toContain("url_check");
  });
});
