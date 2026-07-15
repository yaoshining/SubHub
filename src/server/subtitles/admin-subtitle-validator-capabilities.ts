import {
  type ProviderWithCredentialSummary,
  providerTypeRequiresCredentials,
} from "@/server/providers/provider-repository";
import type { SubtitleProviderKey } from "@/server/providers/provider-adapter";
import type { SubtitleValidatorProviderCapability } from "@/server/subtitles/admin-subtitle-validator-schema";

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

export function mapProviderToValidatorCapability(
  provider: ProviderWithCredentialSummary,
): SubtitleValidatorProviderCapability {
  const providerKey = provider.type;
  const requiresCredentials = providerTypeRequiresCredentials(provider.type);

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
    notes: capabilityNotes[providerKey],
    lastHealthCheckAt: provider.lastHealthCheckedAt,
    lastHealthErrorSummary: provider.lastErrorSummary,
  };
}
