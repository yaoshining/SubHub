import { subhubApiClient } from "./client";

import type {
  SubtitleValidatorDownloadValidationRequest,
  SubtitleValidatorDownloadValidationResponse,
  SubtitleValidatorDownloadValidationResult,
  SubtitleValidatorProvidersResponse,
  SubtitleValidatorSearchRequest,
  SubtitleValidatorSearchResponse,
  SubtitleValidatorSearchResultData,
} from "@/server/subtitles/admin-subtitle-validator-schema";

export type {
  SubtitleValidatorDownloadValidationRequest,
  SubtitleValidatorDownloadValidationResponse,
  SubtitleValidatorDownloadValidationResult,
  SubtitleValidatorProviderCapability,
  SubtitleValidatorProvidersResponse,
  SubtitleValidatorSearchRequest,
  SubtitleValidatorSearchResponse,
  SubtitleValidatorSearchResultData,
} from "@/server/subtitles/admin-subtitle-validator-schema";

const jsonHeaders = (options?: RequestInit) => ({
  "Content-Type": "application/json",
  ...options?.headers,
});

export async function fetchSubtitleValidatorProviders(
  options?: RequestInit,
): Promise<SubtitleValidatorProvidersResponse["data"]> {
  const response = await subhubApiClient<SubtitleValidatorProvidersResponse>(
    "/api/admin/subtitle-validator/providers",
    {
      ...options,
      method: "GET",
    },
  );

  return response.data;
}

export async function runSubtitleValidatorSearch(
  input: SubtitleValidatorSearchRequest,
  options?: RequestInit,
): Promise<SubtitleValidatorSearchResultData> {
  const response = await subhubApiClient<SubtitleValidatorSearchResponse>(
    "/api/admin/subtitle-validator/search",
    {
      ...options,
      method: "POST",
      headers: jsonHeaders(options),
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function validateSubtitleValidatorDownload(
  input: SubtitleValidatorDownloadValidationRequest,
  options?: RequestInit,
): Promise<SubtitleValidatorDownloadValidationResult> {
  const response =
    await subhubApiClient<SubtitleValidatorDownloadValidationResponse>(
      "/api/admin/subtitle-validator/download-validation",
      {
        ...options,
        method: "POST",
        headers: jsonHeaders(options),
        body: JSON.stringify(input),
      },
    );

  return response.data;
}
