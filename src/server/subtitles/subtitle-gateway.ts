import { AppError } from "@/lib/errors";
import { requireCallerKey } from "@/server/api/caller-key-auth";
import { createCallerKeyRepository } from "@/server/caller-keys/caller-key-repository";
import {
  markCredentialFailure,
  markCredentialUsed,
  selectProviderCredential,
} from "@/server/providers/credential-pool";
import {
  OpenSubtitlesAdapter,
  type OpenSubtitlesSearchInput,
} from "@/server/providers/opensubtitles-adapter";
import { ProviderRepository } from "@/server/providers/provider-repository";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import type { CallerKey, Provider } from "@/server/storage/schema";
import { assertProductionRuntimeReady } from "@/server/services/runtime-readiness-service";

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

export type SubtitleSearchResult = {
  id: string;
  provider: "opensubtitles";
  language: string | null;
  releaseName: string | null;
  format: string;
  downloadUrl: string;
};

export type SubtitleSearchResponse = {
  status: "success";
  results: SubtitleSearchResult[];
};

export type SubtitleGatewayOptions = {
  db?: StorageDatabase;
  now?: Date;
  adapter?: Pick<OpenSubtitlesAdapter, "searchRaw">;
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

/**
 * 按定位路径分流构造适配器输入。
 *
 * - 当 `imdbId` 或 `tmdbId` 存在时走 ID 定位路径：仅传 ID 字段，不透传 `query`，
 *   避免短 title（< 3 字符）触发 OpenSubtitles 400 凭据降级。
 * - 无 ID 字段时走原有 `buildSearchQuery` 逻辑（拼 `title` + `year` + `SxxExx`），
 *   保持老调用方行为 100% 不变。
 * - `imdbId` 与 `tmdbId` 同时存在时 `imdbId` 优先，`tmdbId` 不再传上游。
 */
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

const mapProviderFailureReason = (error: AppError) => {
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

export async function searchSubtitles(
  request: Request,
  input: SubtitleSearchInput,
  options: SubtitleGatewayOptions = {},
): Promise<SubtitleSearchResponse> {
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

  const candidates = await getProviderCandidates(db, now);
  if (candidates.length === 0) {
    await record("service_not_ready");
    throw new AppError(
      "SERVICE_NOT_READY",
      "当前实例尚未具备对外字幕服务条件。",
      "provider_pool",
    );
  }

  const provider = candidates[0]!;
  const credential = await selectProviderCredential(provider.id, { db, now });
  const adapter = options.adapter ?? new OpenSubtitlesAdapter();

  try {
    const subtitles = await adapter.searchRaw(
      credential.secret,
      buildAdapterInput(input),
    );

    const downloadableSubtitles = subtitles.filter((subtitle) => subtitle.id);

    if (downloadableSubtitles.length === 0) {
      await record("no_results", 0, provider.id, credential.id);
      throw new AppError("NO_RESULTS", "未找到匹配字幕。", "query");
    }

    await markCredentialUsed(provider.id, credential.id, { db, now });

    const results = downloadableSubtitles.map<SubtitleSearchResult>(
      (subtitle) => {
        const subtitleRef = `opensubtitles:${provider.id}:${subtitle.id}`;
        const fileName = subtitle.fileName ?? subtitle.id;
        const extension = fileName.includes(".")
          ? fileName.split(".").pop()?.toLowerCase()
          : undefined;

        return {
          id: subtitleRef,
          provider: "opensubtitles",
          language: subtitle.language,
          releaseName: subtitle.fileName,
          format: extension || "srt",
          downloadUrl: `/api/subtitles/download?subtitleId=${encodeURIComponent(subtitleRef)}`,
        };
      },
    );

    await record("success", results.length, provider.id, credential.id);

    return { status: "success", results };
  } catch (error) {
    if (error instanceof AppError && error.code === "NO_RESULTS") {
      throw error;
    }

    if (error instanceof AppError) {
      await markCredentialFailure(
        provider,
        credential.id,
        mapProviderFailureReason(error),
        error.message,
        { db, now },
      );
      await syncProviderFailureState(provider.id, db, now);
      await record("provider_failed", 0, provider.id, credential.id);
      throw new AppError(
        "UPSTREAM_FAILED",
        "字幕查询上游请求失败。",
        "provider",
      );
    }

    await markCredentialFailure(
      provider,
      credential.id,
      "upstream_failed",
      "字幕查询上游请求失败。",
      { db, now },
    );
    await syncProviderFailureState(provider.id, db, now);
    await record("provider_failed", 0, provider.id, credential.id);
    throw new AppError("UPSTREAM_FAILED", "字幕查询上游请求失败。");
  }
}
