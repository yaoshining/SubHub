import { subhubApiClient } from "./client";

import type {
  SubtitleValidatorDownloadValidationPayload,
  SubtitleValidatorDownloadValidationRequest,
  SubtitleValidatorDownloadValidationResponse,
  SubtitleValidatorProvidersResponse,
  SubtitleValidatorSearchPayload,
  SubtitleValidatorSearchRequest,
  SubtitleValidatorSearchResponse,
} from "@/lib/api/generated/model";

export type {
  SubtitleValidatorDiagnosticSummary,
  SubtitleValidatorDiagnosticSummaryAction,
  SubtitleValidatorDownloadMode,
  SubtitleValidatorDownloadValidationPayload,
  SubtitleValidatorDownloadValidationRequest,
  SubtitleValidatorDownloadValidationResponse,
  SubtitleValidatorDownloadValidationStatus,
  SubtitleValidatorProviderCapability,
  SubtitleValidatorProviderFailure,
  SubtitleValidatorProvidersResponse,
  SubtitleValidatorSearchField,
  SubtitleValidatorSearchPayload,
  SubtitleValidatorSearchRequest,
  SubtitleValidatorSearchResponse,
  SubtitleValidatorSearchResult,
} from "@/lib/api/generated/model";

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
): Promise<SubtitleValidatorSearchPayload> {
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
): Promise<SubtitleValidatorDownloadValidationPayload> {
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
