import type {
  ProviderSearchOutcome,
  SubtitleProviderAdapter,
} from "@/server/providers/provider-adapter";
import type { SelectedProviderCredential } from "@/server/providers/credential-pool";
import type { SubtitleSearchInput } from "@/server/subtitles/subtitle-gateway";

/**
 * Stub XunleiAdapter — implements SubtitleProviderAdapter interface but always
 * returns skipped. Real logic is implemented in Issue C (004-xunlei-adapter).
 */
export class XunleiAdapter implements SubtitleProviderAdapter {
  readonly key = "xunlei" as const;

  async search(
    _credential: SelectedProviderCredential | null,
    _input: SubtitleSearchInput,
    _options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<ProviderSearchOutcome> {
    void _credential;
    void _input;
    void _options;
    return {
      ok: true,
      skipped: true,
      reason: "missing_required_field",
      results: [],
    };
  }
}
