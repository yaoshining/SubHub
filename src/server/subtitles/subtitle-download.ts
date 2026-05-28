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
  type OpenSubtitlesDownloadResult,
} from "@/server/providers/opensubtitles-adapter";
import { ProviderRepository } from "@/server/providers/provider-repository";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import type { CallerKey, Provider } from "@/server/storage/schema";

export type SubtitleDownloadResult = OpenSubtitlesDownloadResult & {
  subtitleRef: string;
};

export type SubtitleDownloadOptions = {
  db?: StorageDatabase;
  now?: Date;
  adapter?: Pick<OpenSubtitlesAdapter, "download">;
};

const parseSubtitleRef = (subtitleRef: string) => {
  const [providerType, providerId, subtitleId] = subtitleRef.split(":");

  if (providerType !== "opensubtitles" || !providerId || !subtitleId) {
    throw new AppError(
      "SUBTITLE_NOT_FOUND",
      "未找到可下载的字幕项。",
      "subtitleId",
    );
  }

  return { providerId, subtitleId };
};

const requireDownloadProvider = async (
  db: StorageDatabase,
  providerId: string,
  now: Date,
): Promise<Provider> => {
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

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName.trim().replaceAll(/[^\w.\- ]/g, "_");
  return normalized || "subtitle.srt";
};

export const buildSubtitleDownloadHeaders = (
  result: Pick<SubtitleDownloadResult, "contentType" | "fileName">,
) =>
  new Headers({
    "Content-Type": result.contentType,
    "Content-Disposition": `attachment; filename="${sanitizeFileName(result.fileName)}"`,
    "Cache-Control": "private, max-age=0, must-revalidate",
  });

export async function downloadSubtitle(
  request: Request,
  subtitleRef: string,
  options: SubtitleDownloadOptions = {},
): Promise<SubtitleDownloadResult> {
  const db = options.db ?? getStorageClient().db;
  const now = options.now ?? new Date();
  const startedAt = Date.now();
  const repository = createCallerKeyRepository(db);
  let callerKey: CallerKey | undefined;

  const record = async (
    status:
      | "success"
      | "not_found"
      | "service_not_ready"
      | "unauthorized"
      | "provider_failed",
    contentType: string | null = null,
    providerId: string | null = null,
    credentialId: string | null = null,
  ) =>
    repository.recordDownloadRequest({
      callerKeyId: callerKey?.id ?? null,
      subtitleRef,
      providerId,
      credentialId,
      status,
      contentType,
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

  let parsed: ReturnType<typeof parseSubtitleRef>;
  try {
    parsed = parseSubtitleRef(subtitleRef);
  } catch (error) {
    await record("not_found");
    throw error;
  }

  let provider: Provider;
  try {
    provider = await requireDownloadProvider(db, parsed.providerId, now);
  } catch (error) {
    if (error instanceof AppError && error.code === "SERVICE_NOT_READY") {
      await record("service_not_ready", null, parsed.providerId);
    }
    throw error;
  }

  const credential = await selectProviderCredential(provider.id, { db, now });
  const adapter = options.adapter ?? new OpenSubtitlesAdapter();

  try {
    const result = await adapter.download(credential.secret, parsed.subtitleId);

    await markCredentialUsed(provider.id, credential.id, { db, now });
    await record("success", result.contentType, provider.id, credential.id);

    return { ...result, subtitleRef };
  } catch (error) {
    if (error instanceof AppError && error.code === "SUBTITLE_NOT_FOUND") {
      await record("not_found", null, provider.id, credential.id);
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
      await record("provider_failed", null, provider.id, credential.id);
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
    await syncProviderFailureState(provider.id, db, now);
    await record("provider_failed", null, provider.id, credential.id);
    throw new AppError("UPSTREAM_FAILED", "字幕下载上游请求失败。");
  }
}
