import packageJson from "../../../package.json";
import type {
  ProviderSearchOutcome,
  ProviderSearchResult,
  SubtitleProviderAdapter,
} from "@/server/providers/provider-adapter";
import type { SelectedProviderCredential } from "@/server/providers/credential-pool";
import type { SubtitleSearchInput } from "@/server/subtitles/subtitle-gateway";

const XUNLEI_BASE_URL = "https://api-shoulei-ssl.xunlei.com/oracle/subtitle";

type XunleiSubtitleRecord = {
  cid?: string;
  gcid?: string;
  url?: string;
  ext?: string;
  name?: string;
  duration?: number;
  languages?: string[];
  source?: string;
  score?: number;
  fingerprintf_score?: number;
  extra_name?: string;
  mt?: number;
};

export type XunleiAdapterOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class XunleiAdapter implements SubtitleProviderAdapter {
  readonly key = "xunlei" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: XunleiAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? XUNLEI_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async search(
    _credential: SelectedProviderCredential | null,
    input: SubtitleSearchInput,
    _options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<ProviderSearchOutcome> {
    void _credential;
    void _options;

    const name = input.query?.trim();
    const languages = input.language?.trim();

    if (!name || !languages) {
      return {
        ok: true,
        skipped: true,
        reason: "missing_required_field",
        results: [],
      };
    }

    const params = new URLSearchParams();
    params.set("name", name);
    params.set("languages", languages);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}?${params.toString()}`,
        {
          headers: { "User-Agent": `SubHub/${packageJson.version}` },
          signal: controller.signal,
        },
      );

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          skipped: false,
          error: {
            reason: "authentication_failed",
            message: "迅雷字幕 provider 拒绝当前请求的认证。",
          },
        };
      }

      if (response.status === 429) {
        return {
          ok: false,
          skipped: false,
          error: {
            reason: "rate_limited",
            message: "迅雷字幕 provider 上游限流。",
          },
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          skipped: false,
          error: {
            reason: "upstream_failed",
            message: `迅雷字幕 provider 上游返回 ${response.status}。`,
          },
        };
      }

      const data = (await response.json()) as unknown;
      const records = Array.isArray(data) ? data : [];

      const results: ProviderSearchResult[] = records
        .map((item) => this.parseRecord(item as XunleiSubtitleRecord))
        .filter((r): r is ProviderSearchResult => r !== null);

      return { ok: true, skipped: false, results };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          ok: false,
          skipped: false,
          error: { reason: "timeout", message: "迅雷字幕 provider 请求超时。" },
        };
      }

      return {
        ok: false,
        skipped: false,
        error: {
          reason: "upstream_failed",
          message: "迅雷字幕 provider 上游请求不可用。",
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseRecord(
    record: XunleiSubtitleRecord,
  ): ProviderSearchResult | null {
    const id = record.gcid || record.cid;
    if (!id) return null;

    const language = record.languages?.[0] ?? null;
    const format = record.ext?.toLowerCase() || "srt";

    return {
      id,
      language,
      releaseName: record.name ?? null,
      format,
      providerDownloadUrl: record.url ?? null,
      score: record.score ?? null,
      raw: {
        cid: record.cid,
        gcid: record.gcid,
        url: record.url,
        ext: record.ext,
        name: record.name,
        duration: record.duration,
        languages: record.languages,
        source: record.source,
        score: record.score,
        fingerprintf_score: record.fingerprintf_score,
        extra_name: record.extra_name,
        mt: record.mt,
        original_payload: record,
      },
    };
  }
}
