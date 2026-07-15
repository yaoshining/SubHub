import { AppError } from "@/lib/errors";
import {
  markCredentialFailure,
  markCredentialUsed,
  selectProviderCredential,
} from "@/server/providers/credential-pool";
import { getAdapter } from "@/server/providers/provider-registry";
import {
  ProviderRepository,
  type ProviderWithCredentialSummary,
} from "@/server/providers/provider-repository";
import { mapProviderToValidatorCapability } from "@/server/subtitles/admin-subtitle-validator-capabilities";
import type {
  SubtitleValidatorDownloadValidationRequest,
  SubtitleValidatorDownloadValidationResult,
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
): SubtitleValidatorProviderFailure => ({
  provider: provider.type,
  reason:
    error.reason === "timeout" ||
    error.reason === "rate_limited" ||
    error.reason === "authentication_failed"
      ? error.reason
      : error.reason === "missing_required_field"
        ? "skipped_missing_fields"
        : "skipped_disabled",
  message:
    "message" in error
      ? error.message
      : `provider ${provider.type} 跳过：${error.reason}`,
});

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

  if (provider.availableCredentialCount === 0) {
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

async function downloadSubtitleForValidator(
  subtitleRef: string,
  options: SubtitleDownloadOptions = {},
): Promise<SubtitleValidatorDownloadValidationResult> {
  const db = options.db ?? getStorageClient().db;
  const now = options.now ?? new Date();
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
  const adapter = options.adapter ?? getAdapter("opensubtitles");

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

    return {
      subtitleRef,
      provider: "opensubtitles",
      fileName: sanitizeFileName(result.fileName),
      contentType: headers.get("Content-Type") ?? result.contentType,
      contentLength,
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
        "字幕下载上游请求失败。",
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
): Promise<SubtitleValidatorSearchResultData> {
  const db = getStorageClient().db;
  const providers = await requireProviderByKey(input.provider, db);
  const searchInput = buildSearchInput(input);

  const outcomes = await Promise.all(
    providers.map(async (provider) => {
      const adapter = getAdapter(provider.type);
      const outcome = await adapter.search(null, searchInput);
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
      downloadUrl:
        provider.type === "xunlei" && item.providerDownloadUrl
          ? item.providerDownloadUrl
          : `/api/subtitles/download?subtitleId=${encodeURIComponent(`${provider.type}:${provider.id}:${item.id}`)}`,
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
  };
}

export async function validateSubtitleDownload(
  input: SubtitleValidatorDownloadValidationRequest,
): Promise<SubtitleValidatorDownloadValidationResult> {
  return downloadSubtitleForValidator(input.subtitleRef);
}
