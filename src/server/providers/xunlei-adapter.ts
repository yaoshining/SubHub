import packageJson from "../../../package.json";
import type {
  ProviderSearchError,
  ProviderSearchOutcome,
  ProviderSearchResult,
  SubtitleProviderAdapter,
} from "@/server/providers/provider-adapter";
import type { SelectedProviderCredential } from "@/server/providers/credential-pool";
import { resolveSubtitleLanguage } from "@/server/subtitles/subtitle-language";
import type { SubtitleSearchInput } from "@/server/subtitles/subtitle-gateway";

const XUNLEI_BASE_URL = "https://api-shoulei-ssl.xunlei.com/oracle/subtitle";

const XUNLEI_DEFAULT_TIMEOUT_MS = 8000;
const XUNLEI_DEFAULT_MAX_RETRIES = 1;
const XUNLEI_DEFAULT_RETRY_BACKOFF_MS = 200;
const XUNLEI_MAX_RETRY_BACKOFF_MS = 2000;

const RETRYABLE_REASONS: ReadonlySet<ProviderSearchError["reason"]> = new Set([
  "timeout",
  "upstream_failed",
]);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

type XunleiSearchResponse = {
  data?: unknown;
};

export type XunleiAdapterOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
};

export class XunleiAdapter implements SubtitleProviderAdapter {
  readonly key = "xunlei" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;

  constructor(options: XunleiAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? XUNLEI_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? XUNLEI_DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? XUNLEI_DEFAULT_MAX_RETRIES;
    this.retryBackoffMs =
      options.retryBackoffMs ?? XUNLEI_DEFAULT_RETRY_BACKOFF_MS;
  }

  async search(
    _credential: SelectedProviderCredential | null,
    input: SubtitleSearchInput,
    _options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<ProviderSearchOutcome> {
    void _credential;
    void _options;

    for (let attempt = 0; ; attempt += 1) {
      const outcome = await this.searchAttempt(input);

      if (outcome.ok) {
        return outcome;
      }

      if (
        attempt >= this.maxRetries ||
        !RETRYABLE_REASONS.has(outcome.error.reason)
      ) {
        return outcome;
      }

      await sleep(this.backoffDelayMs(attempt));
    }
  }

  private backoffDelayMs(attempt: number): number {
    return Math.min(
      this.retryBackoffMs * 2 ** attempt,
      XUNLEI_MAX_RETRY_BACKOFF_MS,
    );
  }

  private async searchAttempt(
    input: SubtitleSearchInput,
  ): Promise<ProviderSearchOutcome> {
    const name = input.query?.trim();

    if (!name) {
      return {
        ok: true,
        skipped: true,
        reason: "missing_required_field",
        results: [],
      };
    }

    // 迅雷上游的 `languages` 参数与 OpenSubtitles 语言码不一致（不认 zh-CN/chi/chs/zh），
    // 传语言过滤反而返回空。这里不把 language 透传上游，抓全量后由 SubHub 侧按归一化语言过滤。
    const params = new URLSearchParams();
    params.set("name", name);

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

      const data = (await response.json()) as XunleiSearchResponse | unknown[];
      const responseData = (data as XunleiSearchResponse).data;
      const records: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray(responseData)
          ? responseData
          : [];

      const results: ProviderSearchResult[] = records
        .map((item) => this.parseRecord(item as XunleiSubtitleRecord))
        .filter((r): r is ProviderSearchResult => r !== null);

      return { ok: true, skipped: false, results };
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") {
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

    const language = resolveSubtitleLanguage(
      record.name,
      record.languages?.[0] ?? null,
    );
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
