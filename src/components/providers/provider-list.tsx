"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { Provider } from "@/lib/api/providers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HealthBlock,
  PoolSizeIndicator,
  ProviderStatusBadge,
  ProviderTypeBlock,
} from "@/components/providers/provider-utils";

export type ProviderListProps = {
  providers: Provider[];
  selectedProviderId?: string;
  onSelectProvider: (providerId: string) => void;
  onToggleEnable?: (providerId: string) => void;
  togglingProviderId?: string;
};

function ProviderRow({
  provider,
  selected,
  onSelect,
  onToggleEnable,
  isToggling,
}: {
  provider: Provider;
  selected: boolean;
  onSelect: () => void;
  onToggleEnable?: (providerId: string) => void;
  isToggling?: boolean;
}) {
  const isEnabled =
    provider.status === "enabled" || provider.status === "degraded";

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-lg border bg-surface p-4 transition-colors hover:bg-muted/20",
        selected &&
          "border-primary/60 bg-primary/[0.03] shadow-[inset_3px_0_0] shadow-primary",
      )}
      data-testid="provider-list-row"
      data-selected={selected || undefined}
      tabIndex={0}
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Layer 1 & 2: Type + Identity */}
      <div className="flex items-start gap-3">
        <ProviderTypeBlock type={provider.type} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-medium">{provider.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                id: {provider.id}
              </p>
            </div>
            <ProviderStatusBadge status={provider.status} />
          </div>
        </div>
      </div>

      {/* Layer 3: Status & Health */}
      <div className="flex items-center gap-4 pl-[3.75rem]">
        <HealthBlock
          lastHealthStatus={provider.lastHealthStatus}
          lastHealthCheckedAt={provider.lastHealthCheckedAt}
          compact
        />
      </div>

      {/* Layer 4: Pool & Actions */}
      <div className="flex items-center justify-between pl-[3.75rem]">
        {provider.type === "opensubtitles" ? (
          <PoolSizeIndicator
            active={provider.activeCredentialCount}
            cooling={0}
            quarantined={0}
          />
        ) : (
          <span className="text-xs text-muted-foreground">
            无凭据可配（不需要 API Key）
          </span>
        )}
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {onToggleEnable ? (
            isEnabled ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive"
                onClick={() => onToggleEnable(provider.id)}
                disabled={isToggling}
              >
                {isToggling ? "处理中..." : "禁用"}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="text-xs"
                onClick={() => onToggleEnable(provider.id)}
                disabled={isToggling}
              >
                {isToggling ? "处理中..." : "启用"}
              </Button>
            )
          ) : null}
          <Button variant="outline" size="sm" asChild className="text-xs">
            <Link href={`/providers/${provider.id}`}>
              详情
              <ArrowRight aria-hidden="true" className="ml-0.5 size-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProviderList({
  providers,
  selectedProviderId,
  onSelectProvider,
  onToggleEnable,
  togglingProviderId,
}: ProviderListProps) {
  return (
    <section className="grid gap-3" aria-label="Provider 列表" role="listbox">
      {providers.map((provider) => (
        <ProviderRow
          key={provider.id}
          provider={provider}
          selected={provider.id === selectedProviderId}
          onSelect={() => onSelectProvider(provider.id)}
          onToggleEnable={onToggleEnable}
          isToggling={provider.id === togglingProviderId}
        />
      ))}
    </section>
  );
}
