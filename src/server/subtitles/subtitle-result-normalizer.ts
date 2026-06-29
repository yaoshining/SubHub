import type { ProviderSearchResult } from "@/server/providers/provider-adapter";
import type { SubtitleProviderKey } from "@/server/providers/provider-adapter";

export type AggregatedSubtitleResult = {
  id: string;
  provider: SubtitleProviderKey;
  language: string | null;
  releaseName: string | null;
  format: string;
  downloadUrl: string;
  raw?: Record<string, unknown>;
  score?: number | null;
};

export type ProviderFailureReason =
  | "upstream_failed"
  | "timeout"
  | "rate_limited"
  | "skipped_missing_fields"
  | "skipped_disabled"
  | "authentication_failed";

export type ProviderFailureInfo = {
  provider: SubtitleProviderKey;
  reason: ProviderFailureReason;
  message: string;
};

export type SubtitleSearchDataStatus = "success" | "partial";

export type SubtitleSearchData = {
  status: SubtitleSearchDataStatus;
  results: AggregatedSubtitleResult[];
  provider_failures?: ProviderFailureInfo[];
};

export type SubtitleSearchResponse = {
  data: SubtitleSearchData;
};

const ERROR_REASON_MAP: Readonly<Record<string, ProviderFailureReason>> = {
  upstream_failed: "upstream_failed",
  timeout: "timeout",
  rate_limited: "rate_limited",
  authentication_failed: "authentication_failed",
};

const SKIPPED_REASON_MAP: Readonly<Record<string, ProviderFailureReason>> = {
  missing_required_field: "skipped_missing_fields",
  disabled: "skipped_disabled",
  credential_missing: "skipped_disabled",
};

export function normalize(
  providerKey: SubtitleProviderKey,
  result: ProviderSearchResult,
  providerId: string,
): AggregatedSubtitleResult {
  const id = `${providerKey}:${providerId}:${result.id}`;
  const downloadUrl =
    providerKey === "xunlei" && result.providerDownloadUrl
      ? result.providerDownloadUrl
      : `/api/subtitles/download?subtitleId=${encodeURIComponent(id)}`;
  return {
    id,
    provider: providerKey,
    language: result.language,
    releaseName: result.releaseName,
    format: result.format,
    downloadUrl,
    raw: result.raw,
    score: result.score ?? null,
  };
}

export function mapFailure(
  providerKey: SubtitleProviderKey,
  outcome:
    | { ok: false; skipped: false; error: { reason: string; message: string } }
    | { ok: true; skipped: true; reason: string; results: [] },
): ProviderFailureInfo {
  if ("skipped" in outcome && outcome.skipped) {
    return {
      provider: providerKey,
      reason: SKIPPED_REASON_MAP[outcome.reason] ?? "skipped_disabled",
      message: `provider ${providerKey} 跳过：${outcome.reason}`,
    };
  }
  return {
    provider: providerKey,
    reason: ERROR_REASON_MAP[outcome.error.reason] ?? "upstream_failed",
    message: outcome.error.message,
  };
}
