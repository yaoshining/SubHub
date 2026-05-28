"use client";

import Link from "next/link";
import { ArrowRight, MoreHorizontal } from "lucide-react";

import type { Provider } from "@/lib/api/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getProviderRiskLabel,
  providerStatusMeta,
  ProviderStatusBadge,
  ProviderStatusIcon,
  providerTypeLabel,
} from "@/components/providers/provider-utils";

export type ProviderListProps = {
  providers: Provider[];
  selectedProviderId?: string;
  onSelectProvider: (providerId: string) => void;
};

function ProviderMobileCard({
  provider,
  selected,
  onSelect,
}: {
  provider: Provider;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        "border-border bg-surface shadow-none",
        selected && "border-primary/60 bg-primary/5",
      )}
    >
      <CardContent className="grid gap-4 p-4">
        <button
          type="button"
          className="grid gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30 text-primary">
                <ProviderStatusIcon status={provider.status} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {provider.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {providerTypeLabel(provider.type)} · 优先级{" "}
                  {provider.priority}
                </p>
              </div>
            </div>
            <ProviderStatusBadge status={provider.status} />
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-3 text-xs">
            <div>
              <p className="text-muted-foreground">活跃</p>
              <p className="mt-1 font-semibold">
                {provider.activeCredentialCount} 个
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">可用</p>
              <p className="mt-1 font-semibold">
                {provider.availableCredentialCount} 个
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">权重</p>
              <p className="mt-1 font-semibold">{provider.weight}</p>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            风险：{getProviderRiskLabel(provider)}
          </p>
        </button>
        <div className="flex items-center gap-2">
          <Button
            aria-label={`查看更多 ${provider.name}`}
            className="flex-1"
            type="button"
            variant="outline"
            onClick={onSelect}
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
            更多
          </Button>
          <Button asChild className="flex-1">
            <Link href={`/providers/${provider.id}`}>继续配置</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProviderList({
  providers,
  selectedProviderId,
  onSelectProvider,
}: ProviderListProps) {
  return (
    <section className="grid gap-4" aria-label="Provider 列表">
      <div className="hidden overflow-x-auto rounded-lg border bg-surface desktop:block">
        <Table className="min-w-[58rem]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-xs">Provider</TableHead>
              <TableHead className="text-xs">状态</TableHead>
              <TableHead className="text-xs">凭据池</TableHead>
              <TableHead className="text-xs">策略</TableHead>
              <TableHead className="text-xs">当前风险</TableHead>
              <TableHead className="text-right text-xs">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => {
              const selected = provider.id === selectedProviderId;
              return (
                <TableRow
                  key={provider.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    selected && "bg-primary/5",
                  )}
                  data-state={selected ? "selected" : undefined}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelectProvider(provider.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectProvider(provider.id);
                    }
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/30 text-primary">
                        <ProviderStatusIcon status={provider.status} />
                      </div>
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {providerTypeLabel(provider.type)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <ProviderStatusBadge status={provider.status} />
                      <span className="text-xs text-muted-foreground">
                        {providerStatusMeta[provider.status].description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">
                        {provider.availableCredentialCount}
                      </span>
                      <span className="text-muted-foreground">
                        /{provider.credentialCount} 可用
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      活跃 {provider.activeCredentialCount} 个
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    优先级 {provider.priority} · 权重 {provider.weight}
                    <p className="text-xs text-muted-foreground">
                      并发 {provider.concurrencyLimit} · 冷却{" "}
                      {provider.cooldownSeconds}s
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[18rem] text-sm text-muted-foreground">
                    {getProviderRiskLabel(provider)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      size="sm"
                      variant={
                        provider.status === "needs_config"
                          ? "default"
                          : "outline"
                      }
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Link href={`/providers/${provider.id}`}>
                        {provider.status === "needs_config"
                          ? "继续配置"
                          : "配置详情"}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 desktop:hidden">
        {providers.map((provider) => (
          <ProviderMobileCard
            key={provider.id}
            provider={provider}
            selected={provider.id === selectedProviderId}
            onSelect={() => onSelectProvider(provider.id)}
          />
        ))}
      </div>
    </section>
  );
}
