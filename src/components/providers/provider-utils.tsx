import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  PauseCircle,
} from "lucide-react";

import type {
  Provider,
  ProviderCredential,
  ProviderCredentialStatus,
  ProviderStatus,
  ProviderType,
} from "@/lib/api/providers";
import {
  StatusBadge,
  type AdminStatusTone,
} from "@/components/admin/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

export const healthStatusMeta: Record<
  string,
  { label: string; tone: AdminStatusTone }
> = {
  healthy: { label: "健康", tone: "success" },
  degraded: { label: "降级", tone: "warning" },
  unknown: { label: "未知", tone: "secondary" },
  unavailable: { label: "不可用", tone: "destructive" },
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

export function providerTypeLabel(type: ProviderType) {
  return type === "opensubtitles" ? "OpenSubtitles" : "Xunlei";
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

export function formatRelativeTime(value?: string | null) {
  if (!value) {
    return null;
  }
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  return formatDateTime(value);
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

/** 48×48 type identity block: OS=blue, XL=orange+lock */
export function ProviderTypeBlock({
  type,
  className,
}: {
  type: ProviderType;
  className?: string;
}) {
  const isOS = type === "opensubtitles";
  return (
    <div
      className={`relative flex size-12 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
        isOS
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
      } ${className ?? ""}`}
      aria-label={providerTypeLabel(type)}
    >
      {isOS ? "OS" : "XL"}
      {!isOS && (
        <Lock
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 size-3.5 text-muted-foreground"
        />
      )}
    </div>
  );
}

/** Compact health indicator with dot + label + time */
export function HealthBlock({
  lastHealthStatus,
  lastHealthCheckedAt,
  compact,
}: {
  lastHealthStatus: string | null;
  lastHealthCheckedAt: string | null;
  compact?: boolean;
}) {
  const status = lastHealthStatus ?? "unknown";
  const meta = healthStatusMeta[status] ?? healthStatusMeta.unknown;
  const timeText = lastHealthCheckedAt
    ? formatRelativeTime(lastHealthCheckedAt)
    : "尚未检查";

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}
    >
      <span
        className={`inline-block size-2 rounded-full ${
          meta.tone === "success"
            ? "bg-success"
            : meta.tone === "warning"
              ? "bg-warning"
              : meta.tone === "destructive"
                ? "bg-destructive"
                : "bg-muted-foreground"
        }`}
      />
      <span className="text-muted-foreground">
        Health: {meta.label}
        {compact && timeText ? (
          <span className="ml-1">· {timeText}</span>
        ) : null}
      </span>
    </div>
  );
}

/** Pool size indicator showing active/cooling/quarantined */
export function PoolSizeIndicator({
  active,
  cooling,
  quarantined,
}: {
  active: number;
  cooling: number;
  quarantined: number;
}) {
  return (
    <span className="text-xs text-muted-foreground">
      Pool: {active} active{cooling > 0 ? ` · ${cooling} cooling` : ""}
      {quarantined > 0 ? ` · ${quarantined} quarantined` : ""}
    </span>
  );
}

/** Callout for providers that don't need credentials (e.g. Xunlei) */
export function RestrictedCapabilityCallout({
  providerName,
}: {
  providerName: string;
}) {
  return (
    <Alert variant="default" className="border-border/50 bg-muted/30">
      <Info aria-hidden="true" className="size-4" />
      <AlertTitle className="text-xs font-medium">
        该 provider 不需要 API Key
      </AlertTitle>
      <AlertDescription className="mt-1 text-xs leading-5 text-muted-foreground">
        {providerName}由 migration 预置，当前无凭据池结构。
      </AlertDescription>
    </Alert>
  );
}

/** Scheduling summary list for inspector */
export function SchedulingSummaryList({
  priority,
  weight,
  concurrencyLimit,
  cooldownSeconds,
  fallbackProviderId,
}: {
  priority: number;
  weight: number;
  concurrencyLimit: number;
  cooldownSeconds: number;
  fallbackProviderId: string | null;
}) {
  const items = [
    { label: "priority", value: priority },
    { label: "weight", value: weight },
    { label: "concurrency", value: concurrencyLimit },
    { label: "cooldown", value: `${cooldownSeconds}s` },
    { label: "fallback", value: fallbackProviderId ?? "无" },
  ];
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">调度摘要</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {items.map((item) => (
          <div className="flex items-center justify-between" key={item.label}>
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Provider type tabs data */
export const PROVIDER_TYPE_TABS = [
  { value: "all", label: "全部" },
  { value: "opensubtitles", label: "OpenSubtitles" },
  { value: "xunlei", label: "Xunlei" },
] as const;

export type ProviderTypeTab = (typeof PROVIDER_TYPE_TABS)[number]["value"];

/** Empty state messages keyed by type */
export const emptyStateMessages = {
  "no-providers": {
    title: "还没有任何 Provider",
    description:
      "先添加第一个 OpenSubtitles Provider。创建后仍需进入详情页补充调度策略，才能稳定参与统一字幕出口服务。",
    actionLabel: "创建 Provider",
  },
  "no-results": {
    title: "没有符合筛选条件的 Provider",
    description: "可切换状态筛选或清空搜索条件。",
    actionLabel: "清空筛选",
  },
  "no-matches": {
    title: "没有匹配的 Provider",
    description: "没有匹配当前搜索关键词的 Provider。",
    actionLabel: "清空搜索",
  },
} as const;
