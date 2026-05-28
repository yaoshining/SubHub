"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CloudOff,
  RefreshCw,
  Server,
} from "lucide-react";

import type {
  Provider,
  ProviderDetail,
  ProviderStatus,
} from "@/lib/api/providers";
import { fetchProviders } from "@/lib/api/providers";
import {
  EmptyStateActionButton,
  EmptyStateCard,
} from "@/components/admin/empty-state-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { CreateProviderDrawer } from "@/components/providers/create-provider-drawer";
import { ProviderList } from "@/components/providers/provider-list";
import { ProviderPoolInspector } from "@/components/providers/provider-pool-inspector";
import { providerStatusMeta } from "@/components/providers/provider-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppError } from "@/lib/errors";

const filterOptions = [
  { value: "all", label: "全部状态" },
  { value: "enabled", label: "已启用" },
  { value: "needs_config", label: "待完善配置" },
  { value: "degraded", label: "已降级" },
  { value: "disabled", label: "已停用" },
] as const;

type ProviderFilter = (typeof filterOptions)[number]["value"];

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return "Provider 列表加载失败，请稍后重试。";
};

function ProvidersSkeleton() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-label="正在加载 Provider 列表"
    >
      <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="h-28 rounded-lg border bg-surface" key={item} />
        ))}
      </div>
      <div className="h-80 rounded-lg border bg-surface" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card className="border-border bg-surface shadow-none">
      <CardContent className="space-y-2 p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function ProvidersClient() {
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = React.useState<string>();
  const [filter, setFilter] = React.useState<ProviderFilter>("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [createdProvider, setCreatedProvider] =
    React.useState<ProviderDetail | null>(null);
  const mountedRef = React.useRef(true);

  const loadProviders = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchProviders();
      if (!mountedRef.current) {
        return;
      }
      setProviders(list.items);
      setSelectedProviderId((current) => {
        if (current && list.items.some((item) => item.id === current)) {
          return current;
        }
        return (
          list.items.find((item) => item.status === "degraded")?.id ??
          list.items.find((item) => item.status === "needs_config")?.id ??
          list.items[0]?.id
        );
      });
    } catch (loadError) {
      if (mountedRef.current) {
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProviders();
    }, 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadProviders]);

  const filteredProviders = providers.filter((provider) =>
    filter === "all" ? true : provider.status === filter,
  );
  const selectedProvider = providers.find(
    (provider) => provider.id === selectedProviderId,
  );
  const totalCredentialCount = providers.reduce(
    (sum, provider) => sum + provider.credentialCount,
    0,
  );
  const activeCredentialCount = providers.reduce(
    (sum, provider) => sum + provider.activeCredentialCount,
    0,
  );
  const cooldownOrRiskCount = providers.filter(
    (provider) =>
      provider.status === "degraded" || provider.availableCredentialCount === 0,
  ).length;

  function handleCreated(provider: ProviderDetail) {
    setProviders((current) => {
      const withoutDuplicate = current.filter(
        (item) => item.id !== provider.id,
      );
      return [provider, ...withoutDuplicate];
    });
    setSelectedProviderId(provider.id);
    setCreatedProvider(provider);
  }

  function handleDetailLoaded(provider: ProviderDetail) {
    setProviders((current) =>
      current.map((item) => (item.id === provider.id ? provider : item)),
    );
  }

  return (
    <div className="grid gap-6" data-testid="providers-page">
      <div className="flex flex-col gap-3 rounded-lg border bg-surface p-4 desktop:flex-row desktop:items-center desktop:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={providers.length > 0 ? "success" : "warning"}>
              {providers.length > 0 ? "已有 Provider" : "未配置 Provider"}
            </StatusBadge>
            <span className="text-sm text-muted-foreground">
              比较、分诊并承接 OpenSubtitles 深配。
            </span>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            列表选中用于池检查；配置详情用于保存策略与处理高风险凭据。
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as ProviderFilter)}
          >
            <SelectTrigger
              className="w-full sm:w-44"
              aria-label="筛选 Provider 状态"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            aria-label="刷新 Provider 列表"
            variant="outline"
            size="icon"
            onClick={() => void loadProviders()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
          <CreateProviderDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onCreated={handleCreated}
          />
        </div>
      </div>

      {createdProvider ? (
        <Alert variant="success" data-testid="provider-create-success">
          <Server aria-hidden="true" className="size-4" />
          <AlertTitle>已成功创建，策略待补充</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {createdProvider.name} 已自动选中。名称与 API Key
                已录入，仍需继续配置权重、并发、冷却和回退目标。
              </span>
              <span className="flex gap-2 sm:shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreatedProvider(null)}
                >
                  留在列表
                </Button>
                <Button asChild size="sm">
                  <Link href={`/providers/${createdProvider.id}?created=1`}>
                    继续配置
                  </Link>
                </Button>
              </span>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" data-testid="providers-error">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>Provider 信息不可用</AlertTitle>
          <AlertDescription>
            {error}。可重试刷新，或继续打开新增抽屉创建 OpenSubtitles Provider。
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && providers.length === 0 ? <ProvidersSkeleton /> : null}

      {!loading && providers.length === 0 ? (
        <EmptyStateCard
          icon="cloud-off"
          title="还没有配置 Provider"
          description="先添加首个 OpenSubtitles Provider。创建后仍需进入详情页补充调度策略，才能稳定参与统一字幕出口服务。"
          action={
            <EmptyStateActionButton onClick={() => setDrawerOpen(true)}>
              新增 OpenSubtitles
            </EmptyStateActionButton>
          }
        />
      ) : null}

      {providers.length > 0 ? (
        <>
          <section
            className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4"
            aria-label="Token 池摘要"
          >
            <SummaryCard
              label="Provider 总数"
              value={providers.length}
              description="包含启用、降级、停用与待完善配置实例。"
            />
            <SummaryCard
              label="活跃 Token"
              value={activeCredentialCount}
              description={`总 Token ${totalCredentialCount} 个。`}
            />
            <SummaryCard
              label="风险 Provider"
              value={cooldownOrRiskCount}
              description="降级、无可用凭据或需要人工处理的实例。"
            />
            <SummaryCard
              label="最近切换"
              value="暂无"
              description="当前契约未提供切换次数读数，详情页展示最近行为轨迹。"
            />
          </section>

          <div className="grid gap-6 desktop:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
            <div className="grid gap-4">
              {filteredProviders.length > 0 ? (
                <ProviderList
                  providers={filteredProviders}
                  selectedProviderId={selectedProviderId}
                  onSelectProvider={setSelectedProviderId}
                />
              ) : (
                <Card className="border-border bg-surface shadow-none">
                  <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                    <CloudOff
                      aria-hidden="true"
                      className="size-6 text-muted-foreground"
                    />
                    <p className="text-sm font-medium">
                      当前筛选下没有 Provider
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      可切换状态筛选或新增 OpenSubtitles Provider。
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
            <ProviderPoolInspector
              provider={selectedProvider}
              onDetailLoaded={handleDetailLoaded}
            />
          </div>

          {selectedProvider ? (
            <Card className="border-border bg-surface shadow-none">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">切换原则与深配承接</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {
                      providerStatusMeta[
                        selectedProvider.status as ProviderStatus
                      ].description
                    }
                    进入详情页可保存调度策略并处理隔离 / 恢复动作。
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/providers/${selectedProvider.id}`}>
                    配置 {selectedProvider.name}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
