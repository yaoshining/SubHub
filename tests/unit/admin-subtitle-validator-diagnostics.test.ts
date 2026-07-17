import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  buildSubtitleValidatorDiagnosticSummary,
  buildSubtitleValidatorSearchFieldGroups,
  classifySubtitleValidatorError,
} from "@/server/subtitles/admin-subtitle-validator";
import type { SubtitleValidatorErrorCategory } from "@/server/subtitles/admin-subtitle-validator-schema";

const createBaseContext = () => ({
  action: "search" as const,
  providerName: "OpenSubtitles",
  providerStatus: "enabled" as const,
  providerKey: "opensubtitles" as const,
});

describe("subtitle validator diagnostics helpers", () => {
  it("将不同错误稳定映射为诊断类别与下一步建议", () => {
    const cases: Array<{
      error: AppError;
      category: SubtitleValidatorErrorCategory;
      hint: string;
    }> = [
      {
        error: new AppError("VALIDATION_FAILED", "参数不合法。", "query"),
        category: "invalid_params",
        hint: "检查基础参数是否完整，并确认当前 Provider 的扩展字段是否适用。",
      },
      {
        error: new AppError(
          "SERVICE_NOT_READY",
          "Provider 没有可用凭据。",
          "credential_pool",
        ),
        category: "provider_unavailable",
        hint: "先回到 Provider 管理页检查启停状态、凭据池与健康状态，再重试验证。",
      },
      {
        error: new AppError(
          "UPSTREAM_FAILED",
          "Provider 搜索超时。",
          "provider",
        ),
        category: "timeout",
        hint: "稍后重试；若持续超时，请检查 provider 网络连通性或上游健康状态。",
      },
      {
        error: new AppError(
          "UPSTREAM_FAILED",
          "provider 返回了 access_token=secret-123",
          "provider",
        ),
        category: "provider_error",
        hint: "记录当前 provider 与动作类型；若多次失败，请排查上游返回结构或认证状态。",
      },
      {
        error: new AppError(
          "SUBTITLE_NOT_FOUND",
          "未找到可下载的字幕项。",
          "subtitleRef",
        ),
        category: "missing_download",
        hint: "该结果当前没有可验证的下载目标，可改用其他结果项或重新搜索。",
      },
    ];

    for (const item of cases) {
      const result = classifySubtitleValidatorError(
        item.error,
        item.error.message,
      );
      expect(result.category).toBe(item.category);
      expect(result.nextActionHint).toBe(item.hint);
      expect(result.safeMessage).not.toContain("secret-123");
      expect(result.safeMessage).not.toContain("access_token");
    }
  });

  it("为搜索与下载动作生成脱敏诊断摘要", () => {
    const searchSummary = buildSubtitleValidatorDiagnosticSummary({
      ...createBaseContext(),
      status: "error",
      resultCount: 0,
      elapsedMs: 1800,
      error: classifySubtitleValidatorError(
        new AppError("UPSTREAM_FAILED", "Provider 搜索超时。", "provider"),
        "Provider 搜索超时。",
      ),
    });

    expect(searchSummary).toMatchObject({
      action: "search",
      status: "error",
      errorCategory: "timeout",
      nextActionHint:
        "稍后重试；若持续超时，请检查 provider 网络连通性或上游健康状态。",
    });
    expect(searchSummary.summary).toContain("OpenSubtitles");
    expect(searchSummary.summary).toContain("search");

    const downloadSummary = buildSubtitleValidatorDiagnosticSummary({
      ...createBaseContext(),
      action: "download_validation",
      status: "success",
      resultCount: 1,
      elapsedMs: 220,
      downloadMode: "browser_download",
      fileName: "sample.srt",
    });

    expect(downloadSummary).toMatchObject({
      action: "download_validation",
      status: "success",
      downloadMode: "browser_download",
      resultCount: 1,
      fileName: "sample.srt",
      errorCategory: null,
      nextActionHint: null,
    });
    expect(downloadSummary.summary).toContain("browser_download");
  });

  it("按 provider 返回基础参数与扩展参数边界", () => {
    const openSubtitles =
      buildSubtitleValidatorSearchFieldGroups("opensubtitles");
    expect(openSubtitles.baseFields).toEqual([
      "title",
      "query",
      "language",
      "type",
      "year",
    ]);
    expect(openSubtitles.extendedFields).toEqual([
      "season",
      "episode",
      "imdbId",
      "tmdbId",
    ]);
    expect(openSubtitles.requiredSearchFields).toEqual([]);
    expect(openSubtitles.extendedNotice).toContain("IMDb");

    const xunlei = buildSubtitleValidatorSearchFieldGroups("xunlei");
    expect(xunlei.baseFields).toEqual([
      "title",
      "query",
      "language",
      "type",
      "year",
    ]);
    expect(xunlei.extendedFields).toEqual([]);
    expect(xunlei.requiredSearchFields).toEqual(["query"]);
    expect(xunlei.extendedNotice).toContain("附加查询");
  });
});
