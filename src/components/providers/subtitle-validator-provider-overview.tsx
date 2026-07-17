import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubtitleValidatorProviderCapability } from "@/lib/api/subtitle-validator";

type SubtitleValidatorProviderOverviewProps = {
  provider: SubtitleValidatorProviderCapability | null;
};

const healthLabel: Record<
  SubtitleValidatorProviderCapability["healthStatus"],
  string
> = {
  ready: "健康",
  degraded: "异常",
  unknown: "未知",
};

export function SubtitleValidatorProviderOverview({
  provider,
}: SubtitleValidatorProviderOverviewProps) {
  if (!provider) {
    return (
      <Card className="border-border bg-surface shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Provider Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
            请选择一个
            Provider，右侧会展示当前能力边界、凭据摘要与下载验证支持情况。
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Provider Overview</CardTitle>
          <p className="text-sm text-muted-foreground">
            当前上下文: {provider.providerName} · {provider.providerKey}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{provider.availabilityLabel}</Badge>
          <Badge variant="secondary">
            Health {healthLabel[provider.healthStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {provider.restrictionNote ? (
          <Alert variant="warning">
            <AlertTitle>此 Provider {provider.availabilityLabel}</AlertTitle>
            <AlertDescription>{provider.restrictionNote}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-surface-elevated px-4 py-3">
            <p className="text-xs text-muted-foreground">搜索能力</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {provider.supportsSearch
                ? "支持 provider-aware 搜索"
                : "当前不可搜索"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface-elevated px-4 py-3">
            <p className="text-xs text-muted-foreground">下载验证</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {provider.supportsDownloadValidation
                ? "支持浏览器下载校验"
                : provider.supportsDirectDownloadUrl
                  ? "仅支持 URL 检查"
                  : "当前不支持下载验证"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface-elevated px-4 py-3">
            <p className="text-xs text-muted-foreground">URL 检查</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {provider.supportsDirectDownloadUrl
                ? "服务端受控 URL 检查"
                : "无独立直链检查能力"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface-elevated px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">凭据与限制</p>
            <span className="text-xs text-muted-foreground">
              {provider.requiresCredentials
                ? `可用凭据 ${provider.availableCredentialCount}/${provider.credentialCount}`
                : "当前 Provider 不依赖 API 凭据池"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {provider.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            {provider.lastHealthErrorSummary ? (
              <p>最近错误摘要: {provider.lastHealthErrorSummary}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
