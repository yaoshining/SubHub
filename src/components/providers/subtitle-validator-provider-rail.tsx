import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubtitleValidatorProviderCapability } from "@/server/subtitles/admin-subtitle-validator-schema";

type SubtitleValidatorProviderRailProps = {
  providers: SubtitleValidatorProviderCapability[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
};

const statusLabel: Record<
  SubtitleValidatorProviderCapability["status"],
  string
> = {
  enabled: "已启用",
  disabled: "已禁用",
  needs_config: "待配置",
  degraded: "已降级",
};

const healthLabel: Record<
  SubtitleValidatorProviderCapability["healthStatus"],
  string
> = {
  ready: "健康",
  degraded: "异常",
  unknown: "未知",
};

export function SubtitleValidatorProviderRail({
  providers,
  selectedProviderId,
  onSelectProvider,
}: SubtitleValidatorProviderRailProps) {
  return (
    <section
      aria-label="Provider Rail"
      className="grid gap-3"
      data-testid="subtitle-validator-provider-rail"
      role="listbox"
    >
      {providers.map((provider) => {
        const selected = provider.providerId === selectedProviderId;
        return (
          <Button
            aria-label={`选择 ${provider.providerName}`}
            aria-selected={selected}
            className={cn(
              "h-auto w-full justify-start rounded-2xl border border-border bg-surface px-4 py-4 text-left shadow-none transition-colors hover:bg-surface-elevated",
              selected &&
                "border-primary/60 bg-primary/[0.05] shadow-[inset_3px_0_0] shadow-primary",
            )}
            data-provider-id={provider.providerId}
            data-selected={selected || undefined}
            key={provider.providerId}
            onClick={() => onSelectProvider(provider.providerId)}
            role="option"
            type="button"
            variant="ghost"
          >
            <div className="grid w-full gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {provider.providerName}
                    </span>
                    <Badge variant="outline">{provider.providerKey}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {statusLabel[provider.status]} ·{" "}
                    {healthLabel[provider.healthStatus]}
                  </p>
                </div>
                <Badge
                  variant={
                    provider.supportsDownloadValidation
                      ? "default"
                      : "secondary"
                  }
                >
                  {provider.supportsDownloadValidation
                    ? "支持验证下载"
                    : "仅链路查看"}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>
                  凭据 {provider.availableCredentialCount}/
                  {provider.credentialCount}
                </span>
                <span>
                  {provider.supportsDirectDownloadUrl
                    ? "含直链 URL 检查"
                    : "需服务端受控下载"}
                </span>
              </div>
            </div>
          </Button>
        );
      })}
    </section>
  );
}
