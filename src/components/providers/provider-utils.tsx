import { AlertTriangle, CheckCircle2, Clock, PauseCircle } from "lucide-react";

import type {
  Provider,
  ProviderCredential,
  ProviderCredentialStatus,
  ProviderStatus,
} from "@/lib/api/providers";
import {
  StatusBadge,
  type AdminStatusTone,
} from "@/components/admin/status-badge";

export const providerStatusMeta: Record<
  ProviderStatus,
  { label: string; tone: AdminStatusTone; description: string }
> = {
  enabled: {
    label: "已启用",
    tone: "success",
    description: "可参与统一字幕调度。",
  },
  disabled: {
    label: "已停用",
    tone: "destructive",
    description: "不会参与新的上游请求。",
  },
  needs_config: {
    label: "待完善配置",
    tone: "warning",
    description: "已建档，仍需补齐运行策略。",
  },
  degraded: {
    label: "已降级",
    tone: "warning",
    description: "凭据池或上游状态需要处理。",
  },
};

export const credentialStatusMeta: Record<
  ProviderCredentialStatus,
  { label: string; tone: AdminStatusTone }
> = {
  active: { label: "活跃", tone: "success" },
  cooldown: { label: "冷却中", tone: "warning" },
  isolated: { label: "已隔离", tone: "destructive" },
  disabled: { label: "已停用", tone: "destructive" },
  exhausted: { label: "额度耗尽", tone: "destructive" },
};

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  const meta = providerStatusMeta[status];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}

export function CredentialStatusBadge({
  status,
}: {
  status: ProviderCredentialStatus;
}) {
  const meta = credentialStatusMeta[status];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}

export function providerTypeLabel(type: Provider["type"]) {
  return type === "opensubtitles" ? "OpenSubtitles" : type;
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "暂无";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTokenFragment(credential: ProviderCredential) {
  const prefix = credential.displayPrefix ?? "token";
  const suffix = credential.displaySuffix ?? "****";
  return `${prefix}…${suffix}`;
}

export function getProviderRiskLabel(provider: Provider) {
  if (provider.status === "needs_config") {
    return "策略待补齐";
  }
  if (provider.status === "degraded") {
    return provider.lastErrorSummary ?? "凭据池存在风险";
  }
  if (provider.availableCredentialCount === 0) {
    return "无可用凭据";
  }
  return provider.lastErrorSummary ?? "暂无阻断风险";
}

export function ProviderStatusIcon({ status }: { status: ProviderStatus }) {
  if (status === "enabled") {
    return <CheckCircle2 aria-hidden="true" className="size-4" />;
  }
  if (status === "disabled") {
    return <PauseCircle aria-hidden="true" className="size-4" />;
  }
  if (status === "needs_config") {
    return <Clock aria-hidden="true" className="size-4" />;
  }
  return <AlertTriangle aria-hidden="true" className="size-4" />;
}

export function summarizeCredentials(credentials: ProviderCredential[]) {
  return {
    active: credentials.filter((item) => item.status === "active").length,
    cooldown: credentials.filter((item) => item.status === "cooldown").length,
    isolated: credentials.filter((item) => item.status === "isolated").length,
    quotaWarning: credentials.filter(
      (item) => item.remainingQuota != null && item.remainingQuota <= 10,
    ).length,
  };
}
