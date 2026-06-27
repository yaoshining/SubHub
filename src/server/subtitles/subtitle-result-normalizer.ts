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

const mapSkippedReason = (
  reason: "missing_required_field" | "disabled" | "credential_missing",
): ProviderFailureReason => {
  if (reason === "missing_required_field") return "skipped_missing_fields";
  return "skipped_disabled";
};

const mapErrorReason = (
  reason:
    | "upstream_failed"
    | "timeout"
    | "rate_limited"
    | "authentication_failed",
): ProviderFailureReason => reason;

export function normalize(
  providerKey: SubtitleProviderKey,
  result: ProviderSearchResult,
  providerId: string,
): AggregatedSubtitleResult {
  const id = `${providerKey}:${providerId}:${result.id}`;
  return {
    id,
    provider: providerKey,
    language: result.language,
    releaseName: result.releaseName,
    format: result.format,
    downloadUrl: `/api/subtitles/download?subtitleId=${encodeURIComponent(id)}`,
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
      reason: mapSkippedReason(
        outcome.reason as
          | "missing_required_field"
          | "disabled"
          | "credential_missing",
      ),
      message: `provider ${providerKey} 跳过：${outcome.reason}`,
    };
  }
  return {
    provider: providerKey,
    reason: mapErrorReason(
      outcome.error.reason as
        | "upstream_failed"
        | "timeout"
        | "rate_limited"
        | "authentication_failed",
    ),
    message: outcome.error.message,
  };
}
