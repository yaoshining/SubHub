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

export const subtitleValidatorProviderCapabilitySchema = z.object({
  providerId: z.string().min(1),
  providerKey: providerKeySchema,
  providerName: z.string().min(1),
  status: providerStatusSchema,
  healthStatus: providerHealthSchema,
  requiresCredentials: z.boolean(),
  credentialCount: z.number().int().nonnegative(),
  availableCredentialCount: z.number().int().nonnegative(),
  supportsSearch: z.boolean(),
  supportsDownloadValidation: z.boolean(),
  supportsDirectDownloadUrl: z.boolean(),
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
  provider: providerKeySchema.optional(),
  title: z.string().trim().min(1),
  query: z.string().trim().min(1).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  season: z.number().int().min(1).max(999).optional(),
  episode: z.number().int().min(1).max(999).optional(),
  language: z.string().trim().min(2).max(16).optional(),
  imdbId: z.string().trim().min(1).max(32).optional(),
  tmdbId: z.number().int().positive().optional(),
  type: z.enum(["movie", "episode"]).optional(),
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
});

export const subtitleValidatorSearchResultDataSchema = z.object({
  status: z.enum(["success", "partial"]),
  results: z.array(subtitleValidatorSearchResultSchema),
  providerFailures: z.array(subtitleValidatorProviderFailureSchema).default([]),
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
export type SubtitleValidatorSearchResult = z.infer<
  typeof subtitleValidatorSearchResultSchema
>;
export type SubtitleValidatorProviderFailure = z.infer<
  typeof subtitleValidatorProviderFailureSchema
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
