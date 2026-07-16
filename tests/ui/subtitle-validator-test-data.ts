import type {
  SubtitleValidatorDiagnosticSummary,
  SubtitleValidatorDownloadValidationResult,
  SubtitleValidatorProviderCapability,
  SubtitleValidatorSearchResultData,
} from "@/server/subtitles/admin-subtitle-validator-schema";

export function createProviderCapability(
  overrides: Partial<SubtitleValidatorProviderCapability>,
): SubtitleValidatorProviderCapability {
  return {
    providerId: "provider-default",
    providerKey: "opensubtitles",
    providerName: "OpenSubtitles",
    status: "enabled",
    healthStatus: "ready",
    requiresCredentials: true,
    credentialCount: 1,
    availableCredentialCount: 1,
    supportsSearch: true,
    supportsDownloadValidation: true,
    supportsDirectDownloadUrl: false,
    baseFields: ["title", "query", "language", "type", "year"],
    extendedFields: ["season", "episode", "imdbId", "tmdbId"],
    baseFieldNotice:
      "基础通用参数覆盖关键词、语言、媒体类型与年份；切换 provider 时这部分保持稳定。",
    extendedFieldNotice:
      "可继续填写 IMDb / TMDb / Season / Episode 等结构化线索，帮助 OpenSubtitles 收敛结果。",
    notes: [],
    lastHealthCheckAt: null,
    lastHealthErrorSummary: null,
    ...overrides,
  };
}

export function createDiagnosticSummary(
  overrides: Partial<SubtitleValidatorDiagnosticSummary>,
): SubtitleValidatorDiagnosticSummary {
  return {
    action: "search",
    provider: "opensubtitles",
    providerName: "OpenSubtitles",
    providerStatus: "enabled",
    status: "success",
    resultCount: 0,
    elapsedMs: 120,
    summary: "OpenSubtitles search succeeded with 0 result(s) in 120ms",
    errorCategory: null,
    nextActionHint: null,
    fileName: null,
    downloadMode: null,
    ...overrides,
  };
}

export function createSearchResultData(
  overrides: Partial<SubtitleValidatorSearchResultData>,
): SubtitleValidatorSearchResultData {
  return {
    status: "success",
    results: [],
    providerFailures: [],
    diagnostic: createDiagnosticSummary({
      status: "empty",
      resultCount: 0,
      summary: "OpenSubtitles search returned no results in 120ms",
      errorCategory: "empty_results",
      nextActionHint: "可保留当前参数并微调关键词、语言或年份后再次验证。",
    }),
    ...overrides,
  };
}

export function createDownloadValidationResult(
  overrides: Partial<SubtitleValidatorDownloadValidationResult>,
): SubtitleValidatorDownloadValidationResult {
  return {
    subtitleRef: "opensubtitles:provider-default:item-1",
    provider: "opensubtitles",
    fileName: "sample.srt",
    contentType: "application/x-subrip; charset=utf-8",
    contentLength: 120,
    downloadMode: "browser_download",
    diagnostic: createDiagnosticSummary({
      action: "download_validation",
      status: "success",
      resultCount: 1,
      summary:
        "OpenSubtitles (enabled) download_validation succeeded via browser_download in 120ms: sample.srt",
      fileName: "sample.srt",
      downloadMode: "browser_download",
    }),
    ...overrides,
  };
}
