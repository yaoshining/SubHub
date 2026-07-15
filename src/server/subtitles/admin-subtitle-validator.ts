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
  SubtitleValidatorErrorCategory,
  SubtitleValidatorProviderFailure,
  SubtitleValidatorProviderList,
  SubtitleValidatorSearchRequest,
  SubtitleValidatorSearchResultData,
} from "@/server/subtitles/admin-subtitle-validator-schema";
import {
  buildSubtitleDownloadHeaders,
  type SubtitleDownloadOptions,
} from "@/server/subtitles/subtitle-download";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";

const buildSearchInput = (input: SubtitleValidatorSearchRequest) => ({
  title: input.title,
  query: input.query,
  year: input.year,
  season: input.season,
  episode: input.episode,
  language: input.language,
  imdbId: input.imdbId,
  tmdbId: input.tmdbId,
  type: input.type,
});

const redactSensitiveText = (message: string) =>
  message
    .replace(/access_token=[^\s]+/gi, "[redacted]")
    .replace(/token=[^\s]+/gi, "[redacted]")
    .replace(/secret=[^\s]+/gi, "[redacted]")
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

    if (error.code === "UPSTREAM_FAILED") {
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

const requireProviderByKey = async (
  providerKey: SubtitleValidatorSearchRequest["provider"],
  db: StorageDatabase,
) => {
  const repository = new ProviderRepository(db);
  const providers = await repository.listProviders();
  const filtered = providerKey
    ? providers.filter((provider) => provider.type === providerKey)
    : providers;

  if (providerKey && filtered.length === 0) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      `未找到 provider=${providerKey} 的配置实例。`,
      "provider",
    );
  }

  return filtered;
};

const toFailureResponse = (
  provider: ProviderWithCredentialSummary,
  error: { reason: string; message: string } | { reason: string },
): SubtitleValidatorProviderFailure => {
  const rawMessage =
    "message" in error
      ? error.message
      : `provider ${provider.type} 跳过：${error.reason}`;
  const classified = classifySubtitleValidatorError(
    new AppError(
      error.reason === "timeout" ||
        error.reason === "upstream_failed" ||
        error.reason === "rate_limited" ||
        error.reason === "authentication_failed"
        ? "UPSTREAM_FAILED"
        : error.reason === "missing_required_field"
          ? "VALIDATION_FAILED"
          : "SERVICE_NOT_READY",
      rawMessage,
      error.reason === "missing_required_field" ? "query" : "provider",
    ),
    rawMessage,
  );

  return {
    provider: provider.type,
    reason:
      error.reason === "upstream_failed" ||
      error.reason === "timeout" ||
      error.reason === "rate_limited" ||
      error.reason === "authentication_failed"
        ? error.reason
        : error.reason === "missing_required_field"
          ? "skipped_missing_fields"
          : "skipped_disabled",
    message: classified.safeMessage,
    errorCategory: classified.category,
    nextActionHint: classified.nextActionHint,
  };
};

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

const requireDownloadProvider = async (
  db: StorageDatabase,
  providerId: string,
  now: Date,
) => {
  const provider = await new ProviderRepository(db).requireProvider(
    providerId,
    now,
  );

  if (provider.status !== "enabled" && provider.status !== "degraded") {
    throw new AppError(
      "SERVICE_NOT_READY",
      "字幕所属 Provider 当前不可用于下载。",
      "provider",
    );
  }

  if (provider.type !== "xunlei" && provider.availableCredentialCount === 0) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "字幕所属 Provider 没有可用凭据。",
      "credential_pool",
    );
  }

  return provider;
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
};

async function downloadSubtitleForValidator(
  subtitleRef: string,
  options: SubtitleDownloadOptions = {},
): Promise<SubtitleValidatorDownloadValidationResult> {
  const db = options.db ?? getStorageClient().db;
  const now = options.now ?? new Date();
  const startedAt = Date.now();
  const parsed = parseSubtitleRef(subtitleRef);

  if (parsed.providerType === "xunlei") {
    throw new AppError(
      "VALIDATION_FAILED",
      "Xunlei 搜索结果使用 provider 直链下载，统一下载校验仅支持 OpenSubtitles。",
      "subtitleRef",
    );
  }

  const provider = await requireDownloadProvider(db, parsed.providerId, now);
  const credential = await selectProviderCredential(provider.id, { db, now });
  const adapter = options.adapter ?? getRegisteredAdapter("opensubtitles");

  try {
    if (!("download" in adapter) || typeof adapter.download !== "function") {
      throw new AppError(
        "UPSTREAM_FAILED",
        "OpenSubtitles adapter 不支持下载校验。",
      );
    }

    const result = await adapter.download(credential.secret, parsed.subtitleId);
    await markCredentialUsed(provider.id, credential.id, { db, now });

    const headers = buildSubtitleDownloadHeaders({
      contentType: result.contentType,
      fileName: result.fileName,
    });
    const contentLength = Buffer.byteLength(result.content, "utf8");
    const fileName = sanitizeFileName(result.fileName);

    return {
      subtitleRef,
      provider: "opensubtitles",
      fileName,
      contentType: headers.get("Content-Type") ?? result.contentType,
      contentLength,
      downloadMode: "browser_download",
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
      await markCredentialFailure(
        provider,
        credential.id,
        error.code === "PROVIDER_CREDENTIAL_EXHAUSTED"
          ? error.target === "rate_limited"
            ? "rate_limited"
            : error.target === "authentication_failed"
              ? "authentication_failed"
              : "quota_exhausted"
          : "upstream_failed",
        error.message,
        { db, now },
      );
      throw new AppError(
        "UPSTREAM_FAILED",
        classifySubtitleValidatorError(error, error.message).safeMessage,
        "provider",
      );
    }

    await markCredentialFailure(
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
    (async () => requireProviderByKey(input.provider, db));
  const getAdapter = dependencies.getAdapter ?? getRegisteredAdapter;
  const selectCredential =
    dependencies.selectCredential ?? selectProviderCredential;
  const markUsed = dependencies.markCredentialUsed ?? markCredentialUsed;
  const markFailure =
    dependencies.markCredentialFailure ?? markCredentialFailure;

  const providers = await listProviders();
  const filteredProviders = input.provider
    ? providers.filter((provider) => provider.type === input.provider)
    : providers;

  if (input.provider && filteredProviders.length === 0) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      `未找到 provider=${input.provider} 的配置实例。`,
      "provider",
    );
  }

  const searchInput = buildSearchInput(input);

  const outcomes = await Promise.all(
    filteredProviders.map(async (provider) => {
      const adapter = getAdapter(provider.type);
      const credential =
        provider.availableCredentialCount > 0 && provider.type !== "xunlei"
          ? await selectCredential(provider.id, { db, now })
          : null;
      const outcome = await adapter.search(credential, searchInput);

      if (!outcome.ok && credential) {
        await markFailure(
          provider,
          credential.id,
          outcome.error.reason,
          outcome.error.message,
          { db, now },
        );
      } else if (!outcome.skipped && credential) {
        await markUsed(provider.id, credential.id, { db, now });
      }

      return { provider, outcome };
    }),
  );

  const results = outcomes.flatMap(({ provider, outcome }) => {
    if (!outcome.ok || outcome.skipped) {
      return [];
    }

    return outcome.results.map((item) => ({
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
  });

  const providerFailures = outcomes.flatMap(({ provider, outcome }) => {
    if (outcome.ok && !outcome.skipped) {
      return [];
    }
    if (outcome.ok && outcome.skipped) {
      return [toFailureResponse(provider, { reason: outcome.reason })];
    }
    return [toFailureResponse(provider, outcome.error)];
  });

  const primaryProvider = filteredProviders[0] ?? null;
  const diagnostic = primaryProvider
    ? buildSubtitleValidatorDiagnosticSummary({
        action: "search",
        providerKey: primaryProvider.type,
        providerName: primaryProvider.name,
        providerStatus: primaryProvider.status,
        status:
          results.length > 0
            ? "success"
            : providerFailures.length > 0
              ? "error"
              : "empty",
        resultCount: results.length,
        elapsedMs: Date.now() - startedAt,
        error:
          providerFailures.length > 0
            ? {
                category: providerFailures[0].errorCategory,
                safeMessage: providerFailures[0].message,
                nextActionHint: providerFailures[0].nextActionHint,
              }
            : null,
      })
    : null;

  return {
    status: providerFailures.some(
      (item) =>
        item.reason !== "skipped_missing_fields" &&
        item.reason !== "skipped_disabled",
    )
      ? "partial"
      : "success",
    results,
    providerFailures,
    diagnostic,
  };
}

export async function validateSubtitleDownload(
  input: SubtitleValidatorDownloadValidationRequest,
): Promise<SubtitleValidatorDownloadValidationResult> {
  return downloadSubtitleForValidator(input.subtitleRef);
}

export type { SubtitleValidatorErrorCategory } from "@/server/subtitles/admin-subtitle-validator-schema";
export { buildSubtitleValidatorSearchFieldGroups };
