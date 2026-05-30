import {
  getDownloadSubtitleUrl,
  getSearchSubtitlesUrl,
} from "./generated/subtitles/subtitles";
import type {
  DownloadSubtitleParams,
  SearchSubtitlesParams,
  SubtitleSearchData,
  SubtitleSearchResponse,
} from "./generated/model";
import { subhubApiClient } from "./client";
import { AppError, type ApiErrorResponse } from "@/lib/errors";

export type {
  DownloadSubtitleParams,
  SearchSubtitlesParams,
  SubtitleSearchData,
};

export async function searchSubtitles(
  params: SearchSubtitlesParams,
  options?: RequestInit,
): Promise<SubtitleSearchData> {
  const response = await subhubApiClient<SubtitleSearchResponse>(
    getSearchSubtitlesUrl(params),
    { ...options, method: "GET" },
  );

  return response.data;
}

export async function downloadSubtitleFile(
  params: DownloadSubtitleParams,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(getDownloadSubtitleUrl(params), {
    ...options,
    method: "GET",
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as ApiErrorResponse | null;
    if (payload?.error) {
      throw new AppError(
        payload.error.code,
        payload.error.message,
        payload.error.target,
      );
    }
    throw new AppError("UPSTREAM_FAILED", `请求失败：${response.status}`);
  }

  return response;
}
