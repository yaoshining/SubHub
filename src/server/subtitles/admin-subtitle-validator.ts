import { AppError } from "@/lib/errors";
import {
  markCredentialFailure,
  markCredentialUsed,
  selectProviderCredential,
} from "@/server/providers/credential-pool";
import type { SubtitleProviderAdapter } from "@/server/providers/provider-adapter";
import { getAdapter as getRegisteredAdapter } from "@/server/providers/provider-registry";
import {
  ProviderRepository,
  type ProviderWithCredentialSummary,
} from "@/server/providers/provider-repository";
import {
  buildSubtitleValidatorSearchFieldGroups,
  mapProviderToValidatorCapability,
} from "@/server/subtitles/admin-subtitle-validator-capabilities";
import type {
  SubtitleValidatorDiagnosticSummary,
  SubtitleValidatorDownloadMode,
  SubtitleValidatorDownloadValidationRequest,
  SubtitleValidatorDownloadValidationResult,
  SubtitleValidatorDownloadValidationStatus,
  SubtitleValidatorErrorCategory,
  SubtitleValidatorProviderList,
  SubtitleValidatorSearchRequest,
  SubtitleValidatorSearchResultData,
} from "@/server/subtitles/admin-subtitle-validator-schema";
import { buildSubtitleDownloadHeaders } from "@/server/subtitles/subtitle-download";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";

const buildSearchInput = (input: SubtitleValidatorSearchRequest) => {
  const params = input.providerParams;
  const stringParam = (key: string) =>
    typeof params[key] === "string" ? params[key] : undefined;
  const numberParam = (key: string) =>
    typeof params[key] === "number" ? params[key] : undefined;

  const mediaType = stringParam("type");
  let type: "movie" | "episode" | undefined;
  if (mediaType === "movie" || mediaType === "episode") {
    type = mediaType;
  }

  return {
    title: input.baseParams.keyword,
    query: stringParam("query"),
    year: numberParam("year"),
    season: numberParam("season"),
    episode: numberParam("episode"),
    language: stringParam("language"),
    imdbId: stringParam("imdbId"),
    tmdbId: numberParam("tmdbId"),
    type,
  };
};

const redactSensitiveText = (message: string) =>
  message
    .replace(
      /\b(access_token|token|secret|credential|api[_-]?key|password)=([^\s&]+)/gi,
      "[redacted]",
    )
    .replace(
      /(["']?(?:access_token|token|secret|credential|api[_-]?key|password)["']?\s*:\s*["'])[^"']+/gi,
      "[redacted]",
    )
    .replace(/bearer\s+[a-z0-9._\-]+/gi, "bearer [redacted]");

export function classifySubtitleValidatorError(
  error: unknown,
  fallbackMessage: string,
): {
  category: SubtitleValidatorErrorCategory;
  safeMessage: string;
  nextActionHint: string | null;
} {
  const message = redactSensitiveText(
    error instanceof AppError || error instanceof Error
      ? error.message
      : fallbackMessage,
  );

  if (error instanceof AppError) {
    if (error.code === "VALIDATION_FAILED") {
      if (error.target === "download_mode") {
        return {
          category: "unsupported",
          safeMessage: message,
          nextActionHint:
            "请选择当前 Provider 支持的下载验证模式，或切换到其他结果项。",
        };
      }

      return {
        category:
          error.target === "subtitleRef" ? "invalid_url" : "invalid_params",
        safeMessage: message,
        nextActionHint:
          error.target === "subtitleRef"
            ? "检查该结果项的下载目标是否完整，必要时改用其他结果或重新搜索。"
            : "检查基础参数是否完整，并确认当前 Provider 的扩展字段是否适用。",
      };
    }

    if (
      error.code === "SERVICE_NOT_READY" ||
      error.code === "PROVIDER_UNAVAILABLE"
    ) {
      return {
        category: "provider_unavailable",
        safeMessage: message,
        nextActionHint:
          "先回到 Provider 管理页检查启停状态、凭据池与健康状态，再重试验证。",
      };
    }

    if (error.code === "SUBTITLE_NOT_FOUND") {
      return {
        category: "missing_download",
        safeMessage: message,
        nextActionHint:
          "该结果当前没有可验证的下载目标，可改用其他结果项或重新搜索。",
      };
    }

    if (error.code === "UPSTREAM_FAILED" || error.code === "TIMEOUT") {
      if (/timeout|超时/i.test(message)) {
        return {
          category: "timeout",
          safeMessage: message,
          nextActionHint:
            "稍后重试；若持续超时，请检查 provider 网络连通性或上游健康状态。",
        };
      }

      if (/download url|直链|链接|url/i.test(message)) {
        return {
          category: "download_failed",
          safeMessage: message,
          nextActionHint:
            "区分浏览器下载与 URL 检查结果；若 URL 不可达，请检查 provider 返回的下载地址。",
        };
      }

      return {
        category: "provider_error",
        safeMessage: message,
        nextActionHint:
          "记录当前 provider 与动作类型；若多次失败，请排查上游返回结构或认证状态。",
      };
    }
  }

  return {
    category: "unknown",
    safeMessage: message,
    nextActionHint:
      "可先重试一次；若仍失败，请回到 Provider 管理页检查健康摘要。",
  };
}

export function buildSubtitleValidatorDiagnosticSummary(input: {
  action: "search" | "download_validation";
  providerKey: "opensubtitles" | "xunlei";
  providerName: string;
  providerStatus: "enabled" | "disabled" | "needs_config" | "degraded";
  status: "idle" | "loading" | "success" | "empty" | "error";
  resultCount: number;
  elapsedMs?: number | null;
  error?: ReturnType<typeof classifySubtitleValidatorError> | null;
  fileName?: string | null;
  downloadMode?: SubtitleValidatorDownloadMode | null;
}): SubtitleValidatorDiagnosticSummary {
  const elapsedText =
    typeof input.elapsedMs === "number" ? ` in ${input.elapsedMs}ms` : "";
  const summaryBase = `${input.providerName} (${input.providerStatus}) ${input.action}`;

  if (input.status === "success") {
    return {
      action: input.action,
      provider: input.providerKey,
      providerName: input.providerName,
      providerStatus: input.providerStatus,
      status: input.status,
      resultCount: input.resultCount,
      elapsedMs: input.elapsedMs ?? null,
      summary:
        input.action === "download_validation"
          ? `${summaryBase} succeeded via ${input.downloadMode ?? "browser_download"}${elapsedText}${input.fileName ? `: ${input.fileName}` : ""}`
          : `${summaryBase} succeeded with ${input.resultCount} result(s)${elapsedText}`,
      errorCategory: null,
      nextActionHint: null,
      fileName: input.fileName ?? null,
      downloadMode: input.downloadMode ?? null,
    };
  }

  if (input.status === "empty") {
    return {
      action: input.action,
      provider: input.providerKey,
      providerName: input.providerName,
      providerStatus: input.providerStatus,
      status: input.status,
      resultCount: 0,
      elapsedMs: input.elapsedMs ?? null,
      summary: `${summaryBase} returned no results${elapsedText}`,
      errorCategory: "empty_results",
      nextActionHint: "可保留当前参数并微调关键词、语言或年份后再次验证。",
      fileName: null,
      downloadMode: input.downloadMode ?? null,
    };
  }

  if (input.status === "error" && input.error) {
    return {
      action: input.action,
      provider: input.providerKey,
      providerName: input.providerName,
      providerStatus: input.providerStatus,
      status: input.status,
      resultCount: input.resultCount,
      elapsedMs: input.elapsedMs ?? null,
      summary: `${summaryBase} failed${input.downloadMode ? ` via ${input.downloadMode}` : ""}: ${input.error.safeMessage}${elapsedText}`,
      errorCategory: input.error.category,
      nextActionHint: input.error.nextActionHint,
      fileName: input.fileName ?? null,
      downloadMode: input.downloadMode ?? null,
    };
  }

  return {
    action: input.action,
    provider: input.providerKey,
    providerName: input.providerName,
    providerStatus: input.providerStatus,
    status: input.status,
    resultCount: input.resultCount,
    elapsedMs: input.elapsedMs ?? null,
    summary: `${summaryBase} is waiting for validation`,
    errorCategory: null,
    nextActionHint: null,
    fileName: input.fileName ?? null,
    downloadMode: input.downloadMode ?? null,
  };
}

const parseSubtitleRef = (subtitleRef: string) => {
  const [providerType, providerId, ...rest] = subtitleRef.split(":");
  const subtitleId = rest.join(":");

  if (!providerType || !providerId || !subtitleId) {
    throw new AppError(
      "SUBTITLE_NOT_FOUND",
      "未找到可下载的字幕项。",
      "subtitleRef",
    );
  }

  if (providerType === "xunlei") {
    return { providerType: "xunlei" as const, providerId, subtitleId };
  }

  if (providerType === "opensubtitles") {
    return { providerType: "opensubtitles" as const, providerId, subtitleId };
  }

  throw new AppError(
    "SUBTITLE_NOT_FOUND",
    "未找到可下载的字幕项。",
    "subtitleRef",
  );
};

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName.trim().replaceAll(/[^\w.\- ]/g, "_");
  return normalized || "subtitle.srt";
};

export type SubtitleValidatorDependencies = {
  db?: StorageDatabase;
  now?: Date;
  listProviders?: () => Promise<ProviderWithCredentialSummary[]>;
  getAdapter?: (
    providerKey: ProviderWithCredentialSummary["type"],
  ) => SubtitleProviderAdapter;
  selectCredential?: typeof selectProviderCredential;
  markCredentialUsed?: typeof markCredentialUsed;
  markCredentialFailure?: typeof markCredentialFailure;
  fetchImpl?: typeof fetch;
};

async function downloadSubtitleForValidator(
  subtitleRef: string,
  dependencies: SubtitleValidatorDependencies = {},
): Promise<SubtitleValidatorDownloadValidationResult> {
  const db = dependencies.db ?? getStorageClient().db;
  const now = dependencies.now ?? new Date();
  const startedAt = Date.now();
  const parsed = parseSubtitleRef(subtitleRef);

  if (parsed.providerType === "xunlei") {
    throw new AppError(
      "VALIDATION_FAILED",
      "Xunlei 不支持浏览器下载验证，请改用 URL 检查。",
      "download_mode",
    );
  }

  const listProviders =
    dependencies.listProviders ??
    (() => new ProviderRepository(db).listProviders(undefined, now));
  const provider = (await listProviders()).find(
    (candidate) => candidate.id === parsed.providerId,
  );
  if (!provider) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "Provider 不存在。",
      "providerId",
    );
  }
  if (provider.status !== "enabled" && provider.status !== "degraded") {
    throw new AppError(
      "SERVICE_NOT_READY",
      "字幕所属 Provider 当前不可用于下载。",
      "provider",
    );
  }
  if (provider.availableCredentialCount === 0) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "字幕所属 Provider 没有可用凭据。",
      "credential_pool",
    );
  }
  const selectCredential =
    dependencies.selectCredential ?? selectProviderCredential;
  const markUsed = dependencies.markCredentialUsed ?? markCredentialUsed;
  const markFailure =
    dependencies.markCredentialFailure ?? markCredentialFailure;
  const credential = await selectCredential(provider.id, { db, now });
  const adapter =
    dependencies.getAdapter?.("opensubtitles") ??
    getRegisteredAdapter("opensubtitles");

  try {
    if (!("download" in adapter) || typeof adapter.download !== "function") {
      throw new AppError(
        "UPSTREAM_FAILED",
        "OpenSubtitles adapter 不支持下载校验。",
      );
    }

    const result = await adapter.download(credential.secret, parsed.subtitleId);
    await markUsed(provider.id, credential.id, { db, now });

    const headers = buildSubtitleDownloadHeaders({
      contentType: result.contentType,
      fileName: result.fileName,
    });
    const contentLength = Buffer.byteLength(result.content, "utf8");
    const fileName = sanitizeFileName(result.fileName);

    return {
      subtitleRef,
      resultId: subtitleRef,
      provider: "opensubtitles",
      status: "success",
      httpStatus: 200,
      message: "浏览器下载验证成功。",
      fileName,
      contentType: headers.get("Content-Type") ?? result.contentType,
      contentLength,
      downloadMode: "browser_download",
      browserDownloadUrl: null,
      diagnostic: buildSubtitleValidatorDiagnosticSummary({
        action: "download_validation",
        providerKey: "opensubtitles",
        providerName: provider.name,
        providerStatus: provider.status,
        status: "success",
        resultCount: 1,
        elapsedMs: Date.now() - startedAt,
        fileName,
        downloadMode: "browser_download",
      }),
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "SUBTITLE_NOT_FOUND") {
      throw error;
    }

    if (error instanceof AppError) {
      const safeError = classifySubtitleValidatorError(error, error.message);
      await markFailure(
        provider,
        credential.id,
        error.code === "PROVIDER_CREDENTIAL_EXHAUSTED"
          ? error.target === "rate_limited"
            ? "rate_limited"
            : error.target === "authentication_failed"
              ? "authentication_failed"
              : "quota_exhausted"
          : "upstream_failed",
        safeError.safeMessage,
        { db, now },
      );
      throw new AppError("UPSTREAM_FAILED", safeError.safeMessage, "provider");
    }

    await markFailure(
      provider,
      credential.id,
      "upstream_failed",
      "字幕下载上游请求失败。",
      { db, now },
    );
    throw new AppError("UPSTREAM_FAILED", "字幕下载上游请求失败。", "provider");
  }
}

export async function listSubtitleValidatorProviders(): Promise<SubtitleValidatorProviderList> {
  const repository = new ProviderRepository(getStorageClient().db);
  const providers = await repository.listProviders();

  return {
    items: providers.map(mapProviderToValidatorCapability),
    total: providers.length,
  };
}

export async function searchSubtitleValidator(
  input: SubtitleValidatorSearchRequest,
  dependencies: SubtitleValidatorDependencies = {},
): Promise<SubtitleValidatorSearchResultData> {
  const db = dependencies.db ?? getStorageClient().db;
  const now = dependencies.now ?? new Date();
  const startedAt = Date.now();
  const listProviders =
    dependencies.listProviders ??
    (() => new ProviderRepository(db).listProviders(undefined, now));
  const getAdapter = dependencies.getAdapter ?? getRegisteredAdapter;
  const selectCredential =
    dependencies.selectCredential ?? selectProviderCredential;
  const markUsed = dependencies.markCredentialUsed ?? markCredentialUsed;
  const markFailure =
    dependencies.markCredentialFailure ?? markCredentialFailure;
  const provider = (await listProviders()).find(
    (candidate) => candidate.id === input.providerId,
  );

  if (!provider) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "Provider 不存在。",
      "providerId",
    );
  }

  const fields = buildSubtitleValidatorSearchFieldGroups(provider.type);
  const allowedParams = new Set([
    ...fields.baseFields.filter((field) => field !== "title"),
    ...fields.extendedFields,
  ]);
  const unsupportedParam = Object.keys(input.providerParams).find(
    (key) => !allowedParams.has(key as never),
  );
  if (unsupportedParam) {
    throw new AppError(
      "VALIDATION_FAILED",
      `当前 Provider 不支持参数 ${unsupportedParam}。`,
      `providerParams.${unsupportedParam}`,
    );
  }

  const searchInput = buildSearchInput(input);
  const missingFields = fields.requiredSearchFields.filter((field) => {
    if (field === "title") {
      return !searchInput.title.trim();
    }

    const value = searchInput[field];
    return typeof value !== "string" || !value.trim();
  });
  if (missingFields.length > 0) {
    const fieldLabels: Record<string, string> = {
      query: "附加查询",
      language: "语言",
      title: "关键词 / 标题",
    };
    const names = missingFields.map((field) => fieldLabels[field] ?? field);
    throw new AppError(
      "VALIDATION_FAILED",
      `当前 Provider 缺少必填参数：${names.join("、")}。`,
      `providerParams.${missingFields[0]}`,
    );
  }

  const adapter = getAdapter(provider.type);
  const credential =
    provider.availableCredentialCount > 0 && provider.type !== "xunlei"
      ? await selectCredential(provider.id, { db, now })
      : null;
  const outcome = await adapter.search(credential, searchInput);

  if (!outcome.ok) {
    if (credential) {
      await markFailure(
        provider,
        credential.id,
        outcome.error.reason,
        outcome.error.message,
        {
          db,
          now,
        },
      );
    }
    const code =
      outcome.error.reason === "timeout" ? "TIMEOUT" : "UPSTREAM_FAILED";
    throw new AppError(
      code,
      classifySubtitleValidatorError(
        new AppError(code, outcome.error.message, "provider"),
        outcome.error.message,
      ).safeMessage,
      "provider",
    );
  }

  if (outcome.skipped) {
    if (outcome.reason === "missing_required_field") {
      throw new AppError(
        "VALIDATION_FAILED",
        "当前 Provider 缺少执行搜索所需的参数。",
        "providerParams",
      );
    }

    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "当前 Provider 暂不可用于搜索验证。",
      "providerId",
    );
  }

  if (credential) {
    await markUsed(provider.id, credential.id, { db, now });
  }

  const results = outcome.results.map((item) => ({
    id: `${provider.type}:${provider.id}:${item.id}`,
    provider: provider.type,
    language: item.language,
    releaseName: item.releaseName,
    format: item.format,
    subtitleRef: `${provider.type}:${provider.id}:${item.id}`,
    providerDownloadUrl:
      provider.type === "xunlei" ? item.providerDownloadUrl : null,
    raw: item.raw,
    score: item.score ?? null,
  }));
  const status = results.length > 0 ? "success" : "empty";

  return {
    status,
    results,
    providerFailures: [],
    diagnostic: buildSubtitleValidatorDiagnosticSummary({
      action: "search",
      providerKey: provider.type,
      providerName: provider.name,
      providerStatus: provider.status,
      status,
      resultCount: results.length,
      elapsedMs: Date.now() - startedAt,
    }),
  };
}

export async function validateSubtitleDownload(
  input: SubtitleValidatorDownloadValidationRequest,
  dependencies: SubtitleValidatorDependencies = {},
): Promise<SubtitleValidatorDownloadValidationResult> {
  const startedAt = Date.now();
  const subtitleRef = input.subtitleRef ?? input.resultId;

  if (!subtitleRef) {
    throw new AppError(
      "VALIDATION_FAILED",
      "缺少可验证的字幕结果。",
      "resultId",
    );
  }

  const parsed = parseSubtitleRef(subtitleRef);
  if (input.providerId && input.providerId !== parsed.providerId) {
    throw new AppError(
      "VALIDATION_FAILED",
      "下载结果与当前 Provider 不匹配。",
      "providerId",
    );
  }

  const db = dependencies.db ?? getStorageClient().db;
  const now = dependencies.now ?? new Date();
  const listProviders =
    dependencies.listProviders ??
    (() => new ProviderRepository(db).listProviders(undefined, now));
  const provider = (await listProviders()).find(
    (candidate) => candidate.id === parsed.providerId,
  );
  if (!provider) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "Provider 不存在。",
      "providerId",
    );
  }
  if (provider.type !== parsed.providerType) {
    throw new AppError(
      "VALIDATION_FAILED",
      "下载结果与当前 Provider 类型不匹配。",
      "resultId",
    );
  }

  const mode = input.mode;
  const resultId = input.resultId ?? subtitleRef;
  const buildResult = (params: {
    status: SubtitleValidatorDownloadValidationStatus;
    httpStatus?: number | null;
    message: string;
    error?: ReturnType<typeof classifySubtitleValidatorError> | null;
    fileName?: string | null;
    contentType?: string | null;
    contentLength?: number | null;
  }): SubtitleValidatorDownloadValidationResult => ({
    subtitleRef,
    resultId,
    provider: provider.type,
    status: params.status,
    httpStatus: params.httpStatus ?? null,
    message: params.message,
    fileName: params.fileName ?? null,
    contentType: params.contentType ?? null,
    contentLength: params.contentLength ?? null,
    downloadMode: mode,
    browserDownloadUrl: null,
    diagnostic: buildSubtitleValidatorDiagnosticSummary({
      action: "download_validation",
      providerKey: provider.type,
      providerName: provider.name,
      providerStatus: provider.status,
      status: params.status === "success" ? "success" : "error",
      resultCount: params.status === "success" ? 1 : 0,
      elapsedMs: Date.now() - startedAt,
      error: params.error ?? null,
      fileName: params.fileName ?? null,
      downloadMode: mode,
    }),
  });

  if (mode === "browser_download" && parsed.providerType === "xunlei") {
    const error = classifySubtitleValidatorError(
      new AppError(
        "VALIDATION_FAILED",
        "Xunlei 不支持浏览器下载验证，请改用 URL 检查。",
        "download_mode",
      ),
      "Xunlei 不支持浏览器下载验证，请改用 URL 检查。",
    );
    return buildResult({
      status: "unsupported",
      message: error.safeMessage,
      error,
    });
  }

  if (mode === "url_check") {
    if (parsed.providerType !== "xunlei") {
      const error = classifySubtitleValidatorError(
        new AppError(
          "VALIDATION_FAILED",
          "当前 Provider 没有可直接校验的下载 URL，请使用浏览器下载验证。",
          "download_mode",
        ),
        "当前 Provider 没有可直接校验的下载 URL，请使用浏览器下载验证。",
      );
      return buildResult({
        status: "unsupported",
        message: error.safeMessage,
        error,
      });
    }

    if (!input.downloadReference) {
      const error = classifySubtitleValidatorError(
        new AppError(
          "SUBTITLE_NOT_FOUND",
          "该结果没有可验证的下载地址。",
          "subtitleRef",
        ),
        "该结果没有可验证的下载地址。",
      );
      return buildResult({
        status: "missing_download",
        message: error.safeMessage,
        error,
      });
    }

    let downloadUrl: URL;
    try {
      downloadUrl = new URL(input.downloadReference);
      if (
        downloadUrl.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "::1"].includes(
          downloadUrl.hostname.toLowerCase(),
        ) ||
        /^10\.|^127\.|^169\.254\.|^172\.(1[6-9]|2\d|3[0-1])\.|^192\.168\./.test(
          downloadUrl.hostname,
        )
      ) {
        throw new Error("unsafe download URL");
      }
    } catch {
      const error = classifySubtitleValidatorError(
        new AppError(
          "VALIDATION_FAILED",
          "下载地址无效或不允许由服务端校验。",
          "subtitleRef",
        ),
        "下载地址无效或不允许由服务端校验。",
      );
      return buildResult({
        status: "failed",
        message: error.safeMessage,
        error,
      });
    }

    try {
      const response = await (dependencies.fetchImpl ?? fetch)(
        downloadUrl.toString(),
        {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) {
        const error = classifySubtitleValidatorError(
          new AppError(
            "UPSTREAM_FAILED",
            `下载地址返回 HTTP ${response.status}。`,
            "provider",
          ),
          `下载地址返回 HTTP ${response.status}。`,
        );
        return buildResult({
          status: "failed",
          httpStatus: response.status,
          message: "下载 URL 不可访问。",
          error,
        });
      }

      return buildResult({
        status: "success",
        httpStatus: response.status,
        message: "下载 URL 可访问。",
      });
    } catch (cause) {
      const error = classifySubtitleValidatorError(
        cause,
        "下载 URL 校验失败。",
      );
      return buildResult({
        status: "failed",
        message: "下载 URL 校验失败。",
        error,
      });
    }
  }

  try {
    const download = await downloadSubtitleForValidator(
      subtitleRef,
      dependencies,
    );
    return {
      ...download,
      resultId,
      downloadMode: mode,
      diagnostic: {
        ...download.diagnostic,
        downloadMode: mode,
      },
    };
  } catch (cause) {
    const error = classifySubtitleValidatorError(cause, "浏览器下载验证失败。");
    return buildResult({
      status:
        error.category === "missing_download" ? "missing_download" : "failed",
      message: error.safeMessage,
      error,
    });
  }
}

export type { SubtitleValidatorErrorCategory } from "@/server/subtitles/admin-subtitle-validator-schema";
export { buildSubtitleValidatorSearchFieldGroups };
