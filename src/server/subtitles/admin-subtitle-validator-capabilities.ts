import {
  type ProviderWithCredentialSummary,
  providerTypeRequiresCredentials,
} from "@/server/providers/provider-repository";
import type { SubtitleProviderKey } from "@/server/providers/provider-adapter";
import type {
  SubtitleValidatorProviderCapability,
  SubtitleValidatorSearchField,
} from "@/server/subtitles/admin-subtitle-validator-schema";

const baseFields: SubtitleValidatorSearchField[] = [
  "title",
  "query",
  "language",
  "type",
  "year",
];

const extendedFieldsByProvider: Record<
  SubtitleProviderKey,
  SubtitleValidatorSearchField[]
> = {
  opensubtitles: ["season", "episode", "imdbId", "tmdbId"],
  xunlei: [],
};

const extendedFieldNoticeByProvider: Record<SubtitleProviderKey, string> = {
  opensubtitles:
    "IMDb ID、TMDb ID 与 season / episode 属于 OpenSubtitles 扩展参数，用于缩小结果范围，不是系统统一业务字段。",
  xunlei:
    "Xunlei 当前优先验证关键词搜索链路；未展示的字段表示当前 provider 不需要额外扩展参数。",
};

const capabilityNotes: Record<SubtitleProviderKey, string[]> = {
  opensubtitles: [
    "可执行搜索与统一下载校验。",
    "依赖有效凭据池，适合验证凭据可用性与上游响应。",
  ],
  xunlei: [
    "支持搜索结果验证，但统一下载校验会返回不支持。",
    "不依赖 API 凭据池，下载通常使用 provider 直链。",
  ],
};

export function buildSubtitleValidatorSearchFieldGroups(
  providerKey: SubtitleProviderKey,
) {
  return {
    baseFields,
    extendedFields: extendedFieldsByProvider[providerKey],
    baseNotice:
      "基础通用参数覆盖关键词、语言、媒体类型与年份；切换 provider 时这部分保持稳定。",
    extendedNotice: extendedFieldNoticeByProvider[providerKey],
  };
}

export function mapProviderToValidatorCapability(
  provider: ProviderWithCredentialSummary,
): SubtitleValidatorProviderCapability {
  const providerKey = provider.type;
  const requiresCredentials = providerTypeRequiresCredentials(provider.type);
  const fieldGroups = buildSubtitleValidatorSearchFieldGroups(providerKey);

  return {
    providerId: provider.id,
    providerKey,
    providerName: provider.name,
    status: provider.status,
    healthStatus:
      provider.lastHealthStatus === "ready" ||
      provider.lastHealthStatus === "degraded"
        ? provider.lastHealthStatus
        : "unknown",
    requiresCredentials,
    credentialCount: provider.credentialCount,
    availableCredentialCount: provider.availableCredentialCount,
    supportsSearch: true,
    supportsDownloadValidation: providerKey === "opensubtitles",
    supportsDirectDownloadUrl: providerKey === "xunlei",
    baseFields: fieldGroups.baseFields,
    extendedFields: fieldGroups.extendedFields,
    baseFieldNotice: fieldGroups.baseNotice,
    extendedFieldNotice: fieldGroups.extendedNotice,
    notes: capabilityNotes[providerKey],
    lastHealthCheckAt: provider.lastHealthCheckedAt,
    lastHealthErrorSummary: provider.lastErrorSummary,
  };
}
