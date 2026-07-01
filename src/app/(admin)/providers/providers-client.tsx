"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Search, Server, X } from "lucide-react";

import type { Provider, ProviderDetail } from "@/lib/api/providers";
import { fetchProviders } from "@/lib/api/providers";
import {
  EmptyStateActionButton,
  EmptyStateCard,
} from "@/components/admin/empty-state-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { CreateProviderDrawer } from "@/components/providers/create-provider-drawer";
import { ProviderList } from "@/components/providers/provider-list";
import { ProviderPoolInspector } from "@/components/providers/provider-pool-inspector";
import {
  emptyStateMessages,
  PROVIDER_TYPE_TABS,
} from "@/components/providers/provider-utils";
import type { ProviderTypeTab } from "@/components/providers/provider-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <div className="grid gap-3">
        {[0, 1, 2].map((item) => (
          <div
            className="h-24 animate-pulse rounded-lg border bg-surface"
            key={item}
          />
        ))}
      </div>
    </div>
  );
}

export function ProvidersClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = React.useState<string>();
  const [filter, setFilter] = React.useState<ProviderFilter>("all");
  const [typeTab, setTypeTab] = React.useState<ProviderTypeTab>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [createdProvider, setCreatedProvider] =
    React.useState<ProviderDetail | null>(null);
  const mountedRef = React.useRef(true);
  const initialSelectedRef = React.useRef(searchParams.get("selected"));

  const loadProviders = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchProviders();
      if (!mountedRef.current) {
        return;
      }
      setProviders(list.items);

      // Restore selection from initial query string, then fallback to degraded > needs_config > first
      const selectedId = initialSelectedRef.current;
      setSelectedProviderId((current) => {
        if (selectedId && list.items.some((item) => item.id === selectedId)) {
          return selectedId;
        }
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
    mountedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void loadProviders();
    }, 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadProviders]);

  // Sync selected ID to query string
  const handleSelectProvider = React.useCallback(
    (id: string) => {
      setSelectedProviderId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("selected", id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Composite filter: type + status + search text
  const filteredProviders = providers.filter((provider) => {
    if (typeTab !== "all" && provider.type !== typeTab) return false;
    if (filter !== "all" && provider.status !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !provider.name.toLowerCase().includes(q) &&
        !provider.id.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const selectedProvider = filteredProviders.find(
    (provider) => provider.id === selectedProviderId,
  );

  // Compute status counts
  const enabledCount = providers.filter((p) => p.status === "enabled").length;
  const degradedCount = providers.filter((p) => p.status === "degraded").length;
  const needsConfigCount = providers.filter(
    (p) => p.status === "needs_config",
  ).length;
  const disabledCount = providers.filter((p) => p.status === "disabled").length;

  const statusChips = [
    {
      key: "enabled" as const,
      label: "已启用",
      count: enabledCount,
      tone: "success" as const,
    },
    {
      key: "degraded" as const,
      label: "降级",
      count: degradedCount,
      tone: "warning" as const,
    },
    {
      key: "needs_config" as const,
      label: "待完善",
      count: needsConfigCount,
      tone: "warning" as const,
    },
    {
      key: "disabled" as const,
      label: "停用",
      count: disabledCount,
      tone: "destructive" as const,
    },
  ];

  // Summary sentence
  const needsAttention = degradedCount + needsConfigCount + disabledCount;
  const summarySentence =
    needsAttention > 0
      ? `当前 ${providers.length} 个实例；${needsAttention} 个需要立即处理`
      : `当前 ${providers.length} 个实例，全部运行正常`;

  const handleCreated = React.useCallback((provider: ProviderDetail) => {
    setProviders((current) => {
      const withoutDuplicate = current.filter(
        (item) => item.id !== provider.id,
      );
      return [provider, ...withoutDuplicate];
    });
    setSelectedProviderId(provider.id);
    setCreatedProvider(provider);
  }, []);

  const handleDetailLoaded = React.useCallback((provider: ProviderDetail) => {
    setProviders((current) =>
      current.map((item) => (item.id === provider.id ? provider : item)),
    );
  }, []);

  const handleClearFilters = React.useCallback(() => {
    setFilter("all");
    setTypeTab("all");
    setSearchQuery("");
  }, []);

  const handleClearSearch = React.useCallback(() => {
    setSearchQuery("");
  }, []);

  // Determine which empty state to show
  const hasProviders = providers.length > 0;
  const hasFilteredResults = filteredProviders.length > 0;
  const isSearchActive = searchQuery.length > 0;
  const isFilterActive = filter !== "all" || typeTab !== "all";
  const isEmptySearch = isSearchActive && !hasFilteredResults;

  return (
    <div className="grid gap-6" data-testid="providers-page">
      {/* === Operational Pulse Strip === */}
      <div className="sticky top-0 z-10 rounded-lg border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Providers</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {summarySentence}
            </p>
          </div>
          <CreateProviderDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onCreated={handleCreated}
          />
        </div>

        {/* Status chips */}
        <div className="mb-3 flex flex-wrap gap-2">
          {statusChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                filter === chip.key
                  ? "border-strong bg-primary/5"
                  : "border-border bg-muted/30 hover:bg-muted/50"
              }`}
              aria-pressed={filter === chip.key}
              onClick={() =>
                setFilter((f) => (f === chip.key ? "all" : chip.key))
              }
            >
              <StatusBadge
                tone={chip.tone}
                className="!rounded-sm !px-1 !text-[10px]"
              >
                {chip.count}
              </StatusBadge>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={typeTab}
            onValueChange={(v) => setTypeTab(v as ProviderTypeTab)}
            className="shrink-0"
          >
            <TabsList className="h-8">
              {PROVIDER_TYPE_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="px-2.5 py-1 text-xs"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as ProviderFilter)}
          >
            <SelectTrigger
              className="h-8 w-36 text-xs"
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

          <div className="relative min-w-[12rem] max-w-xs flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="搜索 Provider 名称或 ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="清空搜索"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={handleClearSearch}
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>

          <Button
            aria-label="刷新 Provider 列表"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => void loadProviders()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Created success alert */}
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

      {/* Error state */}
      {error ? (
        <Alert variant="destructive" data-testid="providers-error">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>Provider 信息不可用</AlertTitle>
          <AlertDescription>
            {error}。可{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:no-underline"
              onClick={() => void loadProviders()}
            >
              重试刷新
            </button>
            ，或继续创建新 Provider。
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Loading skeleton */}
      {loading && providers.length === 0 ? <ProvidersSkeleton /> : null}

      {/* No providers - empty database */}
      {!loading && !hasProviders ? (
        <EmptyStateCard
          icon="cloud-off"
          title={emptyStateMessages["no-providers"].title}
          description={emptyStateMessages["no-providers"].description}
          action={
            <EmptyStateActionButton onClick={() => setDrawerOpen(true)}>
              {emptyStateMessages["no-providers"].actionLabel}
            </EmptyStateActionButton>
          }
        />
      ) : null}

      {/* Has providers, show content */}
      {hasProviders ? (
        <>
          {/* Results count */}
          <p className="text-xs text-muted-foreground">
            {filteredProviders.length} 条结果
            {isFilterActive || isSearchActive ? (
              <button
                type="button"
                className="ml-2 underline underline-offset-2 hover:no-underline"
                onClick={handleClearFilters}
              >
                清空筛选
              </button>
            ) : null}
          </p>

          <div className="grid gap-6 desktop:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
            <div className="grid gap-4">
              {/* No results after filtering */}
              {!hasFilteredResults ? (
                <EmptyStateCard
                  icon="cloud-off"
                  title={
                    isEmptySearch
                      ? `没有匹配 "${searchQuery}" 的 Provider`
                      : emptyStateMessages["no-results"].title
                  }
                  description={
                    isEmptySearch
                      ? emptyStateMessages["no-matches"].description
                      : emptyStateMessages["no-results"].description
                  }
                  action={
                    <EmptyStateActionButton
                      onClick={
                        isEmptySearch ? handleClearSearch : handleClearFilters
                      }
                    >
                      {isEmptySearch
                        ? emptyStateMessages["no-matches"].actionLabel
                        : emptyStateMessages["no-results"].actionLabel}
                    </EmptyStateActionButton>
                  }
                />
              ) : (
                <ProviderList
                  providers={filteredProviders}
                  selectedProviderId={selectedProviderId}
                  onSelectProvider={handleSelectProvider}
                />
              )}
            </div>

            <ProviderPoolInspector
              provider={selectedProvider}
              onDetailLoaded={handleDetailLoaded}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
