import { AppError } from "@/lib/errors";
import { readEnv } from "@/lib/env";

export type OpenSubtitlesSearchInput = {
  query: string;
  language?: string;
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

export class OpenSubtitlesAdapter {
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
    credentialSecret: string,
    input: OpenSubtitlesSearchInput,
  ): Promise<OpenSubtitlesSubtitle[]> {
    const params = new URLSearchParams({ query: input.query });
    if (input.language) {
      params.set("languages", input.language);
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
          files?: Array<{ file_name?: string | null }>;
          download_count?: number | null;
        };
      };

      return {
        id: String(record.id ?? ""),
        language: record.attributes?.language ?? null,
        fileName: record.attributes?.files?.[0]?.file_name ?? null,
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

    const response = await this.fetchImpl(payload.link, {
      headers: { "User-Agent": "SubHub/0.1.0" },
    });

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
          "User-Agent": "SubHub/0.1.0",
        },
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          "PROVIDER_CREDENTIAL_EXHAUSTED",
          "OpenSubtitles 拒绝当前上游凭据。",
          "provider_credential",
        );
      }

      if (response.status === 429) {
        throw new AppError(
          "PROVIDER_CREDENTIAL_EXHAUSTED",
          "OpenSubtitles 上游限流，当前凭据进入冷却或耗尽状态。",
          "provider_credential",
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
