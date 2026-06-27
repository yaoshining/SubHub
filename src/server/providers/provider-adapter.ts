import type { SelectedProviderCredential } from "@/server/providers/credential-pool";
import type { SubtitleSearchInput } from "@/server/subtitles/subtitle-gateway";

export type SubtitleProviderKey = "opensubtitles" | "xunlei";

export type ProviderSearchResult = {
  id: string;
  language: string | null;
  releaseName: string | null;
  format: string;
  providerDownloadUrl: string | null;
  raw?: Record<string, unknown>;
  score?: number | null;
};

export type SkippedReason =
  | "missing_required_field"
  | "disabled"
  | "credential_missing";

export type ProviderSearchError = {
  reason:
    | "upstream_failed"
    | "timeout"
    | "rate_limited"
    | "authentication_failed";
  message: string;
};

export type ProviderSearchOutcome =
  | { ok: true; skipped: false; results: ProviderSearchResult[] }
  | { ok: false; skipped: false; error: ProviderSearchError }
  | { ok: true; skipped: true; reason: SkippedReason; results: [] };

export interface SubtitleProviderAdapter {
  readonly key: SubtitleProviderKey;
  search(
    credential: SelectedProviderCredential | null,
    input: SubtitleSearchInput,
    options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<ProviderSearchOutcome>;
}
