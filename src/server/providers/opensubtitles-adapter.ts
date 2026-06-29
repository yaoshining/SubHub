import packageJson from "../../../package.json";
import { AppError } from "@/lib/errors";
import { readEnv } from "@/lib/env";
import type { SelectedProviderCredential } from "@/server/providers/credential-pool";
import type {
  ProviderSearchOutcome,
  ProviderSearchResult,
  SubtitleProviderAdapter,
} from "@/server/providers/provider-adapter";
import type { SubtitleSearchInput } from "@/server/subtitles/subtitle-gateway";

export type OpenSubtitlesSearchInput = {
  query?: string;
  imdbId?: string;
  tmdbId?: number;
  season?: number;
  episode?: number;
  language?: string;
  type?: "movie" | "episode";
};

export type OpenSubtitlesSubtitle = {
  id: string;
  language: string | null;
  fileName: string | null;
  downloadCount: number | null;
};

export type OpenSubtitlesDownloadResult = {
  content: string;
  contentType: string;
  fileName: string;
};

export type OpenSubtitlesAdapterOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class OpenSubtitlesAdapter implements SubtitleProviderAdapter {
  readonly key = "opensubtitles" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: OpenSubtitlesAdapterOptions = {}) {
    this.baseUrl =
      options.baseUrl ?? readEnv().OPENSUBTITLES_API_URL.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async search(
    credential: SelectedProviderCredential | null,
    input: SubtitleSearchInput,
    options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
  ): Promise<ProviderSearchOutcome> {
    if (!credential) {
      return {
        ok: true,
        skipped: true,
        reason: "credential_missing",
        results: [],
      };
    }

    const secret = credential.secret;
    const adapterInput = this.toInternalInput(input);
    const executor =
      options && (options.fetchImpl || options.timeoutMs)
        ? new OpenSubtitlesAdapter({
            baseUrl: this.baseUrl,
            fetchImpl: options.fetchImpl,
            timeoutMs: options.timeoutMs,
          })
        : this;

    try {
      const subtitles = await executor.searchRaw(secret, adapterInput);
      const results: ProviderSearchResult[] = subtitles
        .filter((s) => s.id)
        .map((s) => {
          const extension = s.fileName?.includes(".")
            ? s.fileName!.split(".").pop()?.toLowerCase()
            : undefined;
          return {
            id: s.id,
            language: s.language,
            releaseName: s.fileName,
            format: extension || "srt",
            providerDownloadUrl: null,
            raw: {
              download_count: s.downloadCount,
              original_payload: s,
            },
            score: null,
          };
        });
      return { ok: true, skipped: false, results };
    } catch (error) {
      if (error instanceof AppError) {
        const reason = this.mapErrorReason(error);
        return {
          ok: false,
          skipped: false,
          error: { reason, message: error.message },
        };
      }
      return {
        ok: false,
        skipped: false,
        error: {
          reason: "upstream_failed",
          message: "OpenSubtitles 上游请求不可用。",
        },
      };
    }
  }

  private toInternalInput(
    input: SubtitleSearchInput,
  ): OpenSubtitlesSearchInput {
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
    const query = [
      input.title.trim(),
      input.year ? String(input.year) : undefined,
      input.season !== undefined && input.episode !== undefined
        ? `S${String(input.season).padStart(2, "0")}E${String(input.episode).padStart(2, "0")}`
        : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    return {
      query: query || undefined,
      season: input.season,
      episode: input.episode,
      language: input.language,
      type: input.type,
    };
  }

  private mapErrorReason(
    error: AppError,
  ): "upstream_failed" | "timeout" | "rate_limited" | "authentication_failed" {
    if (error.code === "PROVIDER_CREDENTIAL_EXHAUSTED") {
      if (error.target === "rate_limited") return "rate_limited";
      if (error.target === "authentication_failed")
        return "authentication_failed";
    }
    return "upstream_failed";
  }

  async searchRaw(
    credentialSecret: string,
    input: OpenSubtitlesSearchInput,
  ): Promise<OpenSubtitlesSubtitle[]> {
    const params = new URLSearchParams();
    // OpenSubtitles 要求 query 至少 3 字符（过短会返回 400 "Query is too short"），
    // 短于阈值的 query 不透传给上游，避免空 query 误判触发凭据池降级。
    if (input.query && input.query.trim().length >= 3) {
      params.set("query", input.query.trim());
    }
    if (input.imdbId) {
      params.set("imdb_id", input.imdbId);
    }
    if (input.tmdbId !== undefined) {
      params.set("tmdb_id", String(input.tmdbId));
    }
    if (input.season !== undefined) {
      params.set("season_number", String(input.season));
    }
    if (input.episode !== undefined) {
      params.set("episode_number", String(input.episode));
    }
    if (input.language) {
      params.set("languages", input.language);
    }
    if (input.type) {
      params.set("type", input.type);
    }

    const payload = await this.request<{ data?: unknown[] }>(
      `/subtitles?${params.toString()}`,
      credentialSecret,
    );

    return (payload.data ?? []).map((item) => {
      const record = item as {
        id?: string | number;
        attributes?: {
          language?: string | null;
          files?: Array<{
            file_id?: string | number;
            file_name?: string | null;
          }>;
          download_count?: number | null;
        };
      };
      const file = record.attributes?.files?.[0];

      return {
        id: String(file?.file_id ?? ""),
        language: record.attributes?.language ?? null,
        fileName: file?.file_name ?? null,
        downloadCount: record.attributes?.download_count ?? null,
      };
    });
  }

  async download(
    credentialSecret: string,
    subtitleId: string,
  ): Promise<OpenSubtitlesDownloadResult> {
    const payload = await this.request<{
      link?: string;
      file_name?: string;
      fileName?: string;
      content?: string;
    }>("/download", credentialSecret, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: subtitleId }),
    });

    const fileName =
      payload.file_name ?? payload.fileName ?? `${subtitleId}.srt`;

    if (payload.content) {
      return {
        content: payload.content,
        contentType: "application/x-subrip; charset=utf-8",
        fileName,
      };
    }

    if (!payload.link) {
      throw new AppError(
        "SUBTITLE_NOT_FOUND",
        "OpenSubtitles 未返回可下载链接。",
        "subtitleId",
      );
    }

    const dlController = new AbortController();
    const dlTimeout = setTimeout(() => dlController.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(payload.link, {
        headers: { "User-Agent": `SubHub/${packageJson.version}` },
        signal: dlController.signal,
      });
    } finally {
      clearTimeout(dlTimeout);
    }

    if (response.status === 404) {
      throw new AppError(
        "SUBTITLE_NOT_FOUND",
        "OpenSubtitles 下载链接不可用。",
        "subtitleId",
      );
    }

    if (!response.ok) {
      throw new AppError(
        "UPSTREAM_FAILED",
        "OpenSubtitles 字幕文件下载失败。",
        "opensubtitles",
      );
    }

    return {
      content: await response.text(),
      contentType:
        response.headers.get("content-type") ??
        "application/x-subrip; charset=utf-8",
      fileName,
    };
  }

  private async request<T>(
    path: string,
    credentialSecret: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          "Api-Key": credentialSecret,
          "User-Agent": `SubHub/${packageJson.version}`,
        },
        signal: controller.signal,
        redirect: "follow",
      });

      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          "PROVIDER_CREDENTIAL_EXHAUSTED",
          "OpenSubtitles 拒绝当前上游凭据。",
          "authentication_failed",
        );
      }

      if (response.status === 429) {
        throw new AppError(
          "PROVIDER_CREDENTIAL_EXHAUSTED",
          "OpenSubtitles 上游限流，当前凭据进入冷却或耗尽状态。",
          "rate_limited",
        );
      }

      if (!response.ok) {
        throw new AppError(
          "UPSTREAM_FAILED",
          "OpenSubtitles 上游请求失败。",
          "opensubtitles",
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AppError(
          "UPSTREAM_FAILED",
          "OpenSubtitles 上游请求超时。",
          "opensubtitles",
        );
      }

      throw new AppError(
        "UPSTREAM_FAILED",
        "OpenSubtitles 上游请求不可用。",
        "opensubtitles",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
