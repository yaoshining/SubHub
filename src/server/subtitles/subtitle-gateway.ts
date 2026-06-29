import { AppError } from "@/lib/errors";
import { requireCallerKey } from "@/server/api/caller-key-auth";
import { createCallerKeyRepository } from "@/server/caller-keys/caller-key-repository";
import {
  markCredentialFailure,
  markCredentialUsed,
  selectProviderCredential,
  type CredentialFailureReason,
} from "@/server/providers/credential-pool";
import {
  OpenSubtitlesAdapter,
  type OpenSubtitlesSearchInput,
} from "@/server/providers/opensubtitles-adapter";
import { ProviderRepository } from "@/server/providers/provider-repository";
import { getAdapter } from "@/server/providers/provider-registry";
import type {
  ProviderSearchOutcome,
  SubtitleProviderAdapter,
} from "@/server/providers/provider-adapter";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import type { CallerKey, Provider } from "@/server/storage/schema";
import { assertProductionRuntimeReady } from "@/server/services/runtime-readiness-service";
import {
  mapFailure,
  normalize,
  type AggregatedSubtitleResult,
  type ProviderFailureInfo,
  type ProviderFailureReason,
  type SubtitleSearchData,
  type SubtitleSearchDataStatus,
} from "@/server/subtitles/subtitle-result-normalizer";

export type SubtitleSearchInput = {
  title: string;
  query?: string;
  year?: number;
  season?: number;
  episode?: number;
  language?: string;
  imdbId?: string;
  tmdbId?: number;
  type?: "movie" | "episode";
};

export type SubtitleSearchResult = AggregatedSubtitleResult;

export type SubtitleSearchResponse = {
  data: SubtitleSearchData;
};

export type SubtitleGatewayOptions = {
  db?: StorageDatabase;
  now?: Date;
  adapter?: Pick<OpenSubtitlesAdapter, "searchRaw">;
  xunleiAdapter?: SubtitleProviderAdapter;
};

const buildSearchQuery = (input: SubtitleSearchInput) =>
  [
    input.title.trim(),
    input.year ? String(input.year) : undefined,
    input.season !== undefined && input.episode !== undefined
      ? `S${String(input.season).padStart(2, "0")}E${String(input.episode).padStart(2, "0")}`
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");

export const buildAdapterInput = (
  input: SubtitleSearchInput,
): OpenSubtitlesSearchInput => {
  const hasId = Boolean(input.imdbId || input.tmdbId);

  if (hasId) {
    return {
      imdbId: input.imdbId,
      tmdbId: input.imdbId ? undefined : input.tmdbId,
      season: input.season,
      episode: input.episode,
      language: input.language,
      type: input.type,
    };
  }

  return {
    query: buildSearchQuery(input),
    season: input.season,
    episode: input.episode,
    language: input.language,
    type: input.type,
  };
};

const getProviderCandidates = async (
  db: StorageDatabase,
  now: Date,
): Promise<Provider[]> => {
  const repository = new ProviderRepository(db);
  const providers = await repository.listProviders(now);

  return providers.filter(
    (provider) =>
      (provider.status === "enabled" || provider.status === "degraded") &&
      provider.availableCredentialCount > 0,
  );
};

const mapProviderFailureReason = (error: AppError): CredentialFailureReason => {
  if (error.code !== "PROVIDER_CREDENTIAL_EXHAUSTED") {
    return "upstream_failed";
  }
  if (error.target === "rate_limited") {
    return "rate_limited";
  }
  if (error.target === "authentication_failed") {
    return "authentication_failed";
  }

  return "quota_exhausted";
};

const toProviderFailureReason = (
  reason: CredentialFailureReason,
): ProviderFailureReason => {
  if (
    reason === "rate_limited" ||
    reason === "authentication_failed" ||
    reason === "timeout" ||
    reason === "upstream_failed"
  ) {
    return reason;
  }
  return "upstream_failed";
};

const syncProviderFailureState = async (
  providerId: string,
  db: StorageDatabase,
  now: Date,
) => {
  const repository = new ProviderRepository(db);
  const current = await repository.requireProvider(providerId, now);
  if (current.status === "enabled" && current.availableCredentialCount === 0) {
    await repository.setProviderStatus(providerId, "degraded", now);
  }
};

type ProviderCallResult = {
  results: AggregatedSubtitleResult[];
  failure: ProviderFailureInfo | null;
  providerId: string | null;
  credentialId: string | null;
  hadResults: boolean;
};

const callOpenSubtitles = async (
  input: SubtitleSearchInput,
  db: StorageDatabase,
  now: Date,
  options: SubtitleGatewayOptions,
): Promise<ProviderCallResult> => {
  const candidates = await getProviderCandidates(db, now);
  if (candidates.length === 0) {
    return {
      results: [],
      failure: null,
      providerId: null,
      credentialId: null,
      hadResults: false,
    };
  }

  const provider = candidates[0]!;
  const credential = await selectProviderCredential(provider.id, { db, now });
  const adapter = options.adapter ?? new OpenSubtitlesAdapter();

  try {
    const subtitles = await adapter.searchRaw(
      credential.secret,
      buildAdapterInput(input),
    );

    const downloadable = subtitles.filter((s) => s.id);
    await markCredentialUsed(provider.id, credential.id, { db, now });

    const results = downloadable.map((s) =>
      normalize(
        "opensubtitles",
        {
          id: s.id,
          language: s.language,
          releaseName: s.fileName,
          format: s.fileName?.includes(".")
            ? (s.fileName!.split(".").pop()?.toLowerCase() ?? "srt")
            : "srt",
          providerDownloadUrl: null,
          raw: { download_count: s.downloadCount },
          score: null,
        },
        provider.id,
      ),
    );

    return {
      results,
      failure: null,
      providerId: provider.id,
      credentialId: credential.id,
      hadResults: results.length > 0,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "NO_RESULTS") {
      return {
        results: [],
        failure: null,
        providerId: provider.id,
        credentialId: credential.id,
        hadResults: false,
      };
    }

    let failureReason: CredentialFailureReason;
    let failureMessage: string;

    if (error instanceof AppError) {
      failureReason = mapProviderFailureReason(error);
      failureMessage = error.message;
    } else {
      failureReason = "upstream_failed";
      failureMessage = "字幕查询上游请求失败。";
    }

    await markCredentialFailure(
      provider,
      credential.id,
      failureReason,
      failureMessage,
      { db, now },
    );
    await syncProviderFailureState(provider.id, db, now);

    return {
      results: [],
      failure: {
        provider: "opensubtitles",
        reason: toProviderFailureReason(failureReason),
        message: failureMessage,
      },
      providerId: provider.id,
      credentialId: credential.id,
      hadResults: false,
    };
  }
};

const callXunlei = async (
  input: SubtitleSearchInput,
  options: SubtitleGatewayOptions,
): Promise<ProviderCallResult> => {
  const adapter = options.xunleiAdapter ?? getAdapter("xunlei");
  const outcome: ProviderSearchOutcome = await adapter.search(null, input);

  if (outcome.skipped) {
    return {
      results: [],
      failure: mapFailure("xunlei", outcome),
      providerId: null,
      credentialId: null,
      hadResults: false,
    };
  }

  if (!outcome.ok) {
    return {
      results: [],
      failure: mapFailure("xunlei", outcome),
      providerId: null,
      credentialId: null,
      hadResults: false,
    };
  }

  const results = outcome.results.map((r) =>
    normalize("xunlei", r, "xunlei_default"),
  );

  return {
    results,
    failure: null,
    providerId: null,
    credentialId: null,
    hadResults: results.length > 0,
  };
};

export async function searchSubtitles(
  request: Request,
  input: SubtitleSearchInput,
  options: SubtitleGatewayOptions = {},
): Promise<SubtitleSearchData> {
  const db = options.db ?? getStorageClient().db;
  const now = options.now ?? new Date();
  await assertProductionRuntimeReady({ db, now });
  const startedAt = Date.now();
  const repository = createCallerKeyRepository(db);
  let callerKey: CallerKey | undefined;

  const record = async (
    status:
      | "success"
      | "no_results"
      | "service_not_ready"
      | "unauthorized"
      | "provider_failed",
    resultCount = 0,
    providerId: string | null = null,
    credentialId: string | null = null,
  ) =>
    repository.recordSearchRequest({
      callerKeyId: callerKey?.id ?? null,
      mediaTitle: input.title,
      mediaYear: input.year ?? null,
      season: input.season ?? null,
      episode: input.episode ?? null,
      language: input.language ?? null,
      status,
      resultCount,
      providerId,
      credentialId,
      durationMs: Date.now() - startedAt,
      createdAt: now.toISOString(),
    });

  try {
    callerKey = await requireCallerKey({ request, db, now });
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === "CALLER_KEY_INVALID" ||
        error.code === "CALLER_KEY_SUSPENDED")
    ) {
      await record("unauthorized");
    }
    throw error;
  }

  const osResult = await callOpenSubtitles(input, db, now, options);
  const xunleiResult = await callXunlei(input, options);

  const allResults = [...osResult.results, ...xunleiResult.results];
  const failures = [osResult.failure, xunleiResult.failure].filter(
    (f): f is ProviderFailureInfo => f !== null,
  );

  const hardFailures = failures.filter(
    (f) =>
      f.reason !== "skipped_missing_fields" && f.reason !== "skipped_disabled",
  );

  const noProviderAvailable =
    osResult.providerId === null &&
    osResult.results.length === 0 &&
    hardFailures.length === 0;
  if (noProviderAvailable) {
    await record("service_not_ready");
    throw new AppError(
      "SERVICE_NOT_READY",
      "当前实例尚未具备对外字幕服务条件。",
      "provider_pool",
    );
  }

  if (allResults.length === 0) {
    if (hardFailures.length > 0) {
      await record("provider_failed");
      throw new AppError(
        "UPSTREAM_FAILED",
        "字幕查询上游请求失败。",
        "provider",
      );
    }
    const lastProviderId = osResult.providerId ?? xunleiResult.providerId;
    const lastCredentialId = osResult.credentialId ?? xunleiResult.credentialId;
    await record("no_results", 0, lastProviderId, lastCredentialId);
    throw new AppError("NO_RESULTS", "未找到匹配字幕。", "query");
  }

  const status: SubtitleSearchDataStatus =
    hardFailures.length > 0 ? "partial" : "success";

  const lastProviderId = osResult.providerId ?? xunleiResult.providerId;
  const lastCredentialId = osResult.credentialId ?? xunleiResult.credentialId;
  await record("success", allResults.length, lastProviderId, lastCredentialId);

  const data: SubtitleSearchData = {
    status,
    results: allResults,
  };
  if (failures.length > 0) {
    data.provider_failures = failures;
  }

  return data;
}
