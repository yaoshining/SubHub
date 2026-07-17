import { z } from "zod";

const providerKeySchema = z.enum(["opensubtitles", "xunlei"]);

const providerStatusSchema = z.enum([
  "enabled",
  "disabled",
  "needs_config",
  "degraded",
]);

const providerHealthSchema = z.enum(["ready", "degraded", "unknown"]);

const providerFailureReasonSchema = z.enum([
  "upstream_failed",
  "timeout",
  "rate_limited",
  "skipped_missing_fields",
  "skipped_disabled",
  "authentication_failed",
]);

const subtitleValidatorSearchFieldSchema = z.enum([
  "title",
  "query",
  "language",
  "type",
  "year",
  "season",
  "episode",
  "imdbId",
  "tmdbId",
]);

const subtitleValidatorErrorCategorySchema = z.enum([
  "invalid_params",
  "empty_results",
  "timeout",
  "provider_error",
  "provider_unavailable",
  "missing_download",
  "invalid_url",
  "download_failed",
  "unknown",
]);

const subtitleValidatorDownloadModeSchema = z.enum([
  "browser_download",
  "url_check",
]);

export const subtitleValidatorProviderCapabilitySchema = z.object({
  providerId: z.string().min(1),
  providerKey: providerKeySchema,
  providerName: z.string().min(1),
  status: providerStatusSchema,
  availabilityLabel: z.string().min(1),
  restrictionNote: z.string().min(1).nullable(),
  healthStatus: providerHealthSchema,
  requiresCredentials: z.boolean(),
  credentialCount: z.number().int().nonnegative(),
  availableCredentialCount: z.number().int().nonnegative(),
  supportsSearch: z.boolean(),
  supportsDownloadValidation: z.boolean(),
  supportsDirectDownloadUrl: z.boolean(),
  baseFields: z.array(subtitleValidatorSearchFieldSchema).default([]),
  extendedFields: z.array(subtitleValidatorSearchFieldSchema).default([]),
  baseFieldNotice: z.string().min(1),
  extendedFieldNotice: z.string().min(1),
  notes: z.array(z.string().min(1)).default([]),
  lastHealthCheckAt: z.string().datetime().nullable(),
  lastHealthErrorSummary: z.string().nullable(),
});

export const subtitleValidatorProviderListSchema = z.object({
  items: z.array(subtitleValidatorProviderCapabilitySchema),
  total: z.number().int().nonnegative(),
});

export const subtitleValidatorProvidersResponseSchema = z.object({
  data: subtitleValidatorProviderListSchema,
});

export const subtitleValidatorSearchRequestSchema = z.object({
  providerId: z.string().trim().min(1),
  baseParams: z.object({
    keyword: z.string().trim().min(1),
  }),
  providerParams: z.record(
    z.string(),
    z.string().or(z.number()).or(z.boolean()).nullable(),
  ),
});

export const subtitleValidatorSearchResultSchema = z.object({
  id: z.string().min(1),
  provider: providerKeySchema,
  language: z.string().nullable(),
  releaseName: z.string().nullable(),
  format: z.string().min(1),
  subtitleRef: z.string().min(1),
  providerDownloadUrl: z.string().url().nullable(),
  raw: z.record(z.string(), z.unknown()).optional(),
  score: z.number().nullable().optional(),
});

export const subtitleValidatorProviderFailureSchema = z.object({
  provider: providerKeySchema,
  reason: providerFailureReasonSchema,
  message: z.string().min(1),
  errorCategory: subtitleValidatorErrorCategorySchema,
  nextActionHint: z.string().min(1).nullable(),
});

export const subtitleValidatorDiagnosticSummarySchema = z.object({
  action: z.enum(["search", "download_validation"]),
  provider: providerKeySchema,
  providerName: z.string().min(1),
  providerStatus: providerStatusSchema,
  status: z.enum(["idle", "loading", "success", "empty", "error"]),
  resultCount: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative().nullable(),
  summary: z.string().min(1),
  errorCategory: subtitleValidatorErrorCategorySchema.nullable(),
  nextActionHint: z.string().min(1).nullable(),
  fileName: z.string().min(1).nullable(),
  downloadMode: subtitleValidatorDownloadModeSchema.nullable(),
});

export const subtitleValidatorSearchResultDataSchema = z.object({
  status: z.enum(["success", "empty"]),
  results: z.array(subtitleValidatorSearchResultSchema),
  providerFailures: z.array(subtitleValidatorProviderFailureSchema).default([]),
  diagnostic: subtitleValidatorDiagnosticSummarySchema.nullable().default(null),
});

export const subtitleValidatorSearchResponseSchema = z.object({
  data: subtitleValidatorSearchResultDataSchema,
});

export const subtitleValidatorDownloadValidationRequestSchema = z.object({
  subtitleRef: z.string().trim().min(1),
});

export const subtitleValidatorDownloadValidationResultSchema = z.object({
  subtitleRef: z.string().min(1),
  provider: providerKeySchema,
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  contentLength: z.number().int().nonnegative(),
  downloadMode: subtitleValidatorDownloadModeSchema,
  diagnostic: subtitleValidatorDiagnosticSummarySchema,
});

export const subtitleValidatorDownloadValidationResponseSchema = z.object({
  data: subtitleValidatorDownloadValidationResultSchema,
});

export type SubtitleValidatorProviderCapability = z.infer<
  typeof subtitleValidatorProviderCapabilitySchema
>;
export type SubtitleValidatorProviderList = z.infer<
  typeof subtitleValidatorProviderListSchema
>;
export type SubtitleValidatorProvidersResponse = z.infer<
  typeof subtitleValidatorProvidersResponseSchema
>;
export type SubtitleValidatorSearchRequest = z.infer<
  typeof subtitleValidatorSearchRequestSchema
>;
export type SubtitleValidatorSearchField = z.infer<
  typeof subtitleValidatorSearchFieldSchema
>;
export type SubtitleValidatorErrorCategory = z.infer<
  typeof subtitleValidatorErrorCategorySchema
>;
export type SubtitleValidatorDownloadMode = z.infer<
  typeof subtitleValidatorDownloadModeSchema
>;
export type SubtitleValidatorSearchResult = z.infer<
  typeof subtitleValidatorSearchResultSchema
>;
export type SubtitleValidatorProviderFailure = z.infer<
  typeof subtitleValidatorProviderFailureSchema
>;
export type SubtitleValidatorDiagnosticSummary = z.infer<
  typeof subtitleValidatorDiagnosticSummarySchema
>;
export type SubtitleValidatorSearchResultData = z.infer<
  typeof subtitleValidatorSearchResultDataSchema
>;
export type SubtitleValidatorSearchResponse = z.infer<
  typeof subtitleValidatorSearchResponseSchema
>;
export type SubtitleValidatorDownloadValidationRequest = z.infer<
  typeof subtitleValidatorDownloadValidationRequestSchema
>;
export type SubtitleValidatorDownloadValidationResult = z.infer<
  typeof subtitleValidatorDownloadValidationResultSchema
>;
export type SubtitleValidatorDownloadValidationResponse = z.infer<
  typeof subtitleValidatorDownloadValidationResponseSchema
>;
