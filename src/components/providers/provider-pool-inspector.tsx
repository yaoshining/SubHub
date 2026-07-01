"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, KeyRound, RefreshCw } from "lucide-react";

import type { Provider, ProviderDetail } from "@/lib/api/providers";
import { fetchProviderDetail } from "@/lib/api/providers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppError } from "@/lib/errors";
import {
  HealthBlock,
  ProviderStatusBadge,
  ProviderTypeBlock,
  RestrictedCapabilityCallout,
  SchedulingSummaryList,
  providerTypeLabel,
  summarizeCredentials,
} from "@/components/providers/provider-utils";

export type ProviderPoolInspectorProps = {
  provider?: Provider;
  onDetailLoaded?: (provider: ProviderDetail) => void;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return "凭据池加载失败，请稍后重试。";
};

function InspectorSkeleton() {
  return (
    <Card className="border-border bg-surface shadow-none" role="status">
      <CardContent className="grid gap-4 p-5" aria-label="正在加载凭据池">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="grid gap-3">
          <div className="h-16 rounded-lg border bg-muted/30" />
          <div className="h-32 rounded-lg border bg-muted/30" />
        </div>
      </CardContent>
    </Card>
  );
}

function SelectedContextHeader({
  provider,
  typeLabel,
}: {
  provider: Provider;
  typeLabel: string;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">当前选中</p>
      <div className="flex items-start gap-3">
        <ProviderTypeBlock type={provider.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{provider.name}</p>
            {provider.type === "xunlei" && (
              <span className="text-xs text-muted-foreground">🔒 受限</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ProviderStatusBadge status={provider.status} />
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          Pool {provider.availableCredentialCount > 0 ? "healthy" : "unhealthy"}
        </span>
      </div>
    </div>
  );
}

function OpenSubtitlesInspectorContent({
  source,
  detail,
}: {
  source: Provider;
  detail: ProviderDetail | null;
}) {
  const credentials = detail?.credentials ?? [];
  const summary = summarizeCredentials(credentials);

  return (
    <div className="grid gap-5">
      {/* Credential pool summary */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          凭据池摘要
        </p>
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border bg-muted/20 p-2 text-center">
            <p className="text-xs text-muted-foreground">active</p>
            <p className="text-lg font-semibold">{summary.active}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2 text-center">
            <p className="text-xs text-muted-foreground">cooling</p>
            <p className="text-lg font-semibold">{summary.cooldown}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2 text-center">
            <p className="text-xs text-muted-foreground">isolated</p>
            <p className="text-lg font-semibold">{summary.isolated}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2 text-center">
            <p className="text-xs text-muted-foreground">quota⚠</p>
            <p className="text-lg font-semibold">{summary.quotaWarning}</p>
          </div>
        </div>
      </div>

      {/* Health */}
      <HealthBlock
        lastHealthStatus={source.lastHealthStatus}
        lastHealthCheckedAt={source.lastHealthCheckedAt}
      />

      {/* Scheduling summary */}
      <SchedulingSummaryList
        priority={source.priority}
        weight={source.weight}
        concurrencyLimit={source.concurrencyLimit}
        cooldownSeconds={source.cooldownSeconds}
        fallbackProviderId={source.fallbackProviderId}
      />
    </div>
  );
}

function XunleiInspectorContent({ source }: { source: Provider }) {
  return (
    <div className="grid gap-5">
      {/* Credential pool restricted callout */}
      <RestrictedCapabilityCallout providerName={source.name} />

      {/* Health */}
      <HealthBlock
        lastHealthStatus={source.lastHealthStatus}
        lastHealthCheckedAt={source.lastHealthCheckedAt}
      />

      {/* Scheduling summary */}
      <SchedulingSummaryList
        priority={source.priority}
        weight={source.weight}
        concurrencyLimit={source.concurrencyLimit}
        cooldownSeconds={source.cooldownSeconds}
        fallbackProviderId={source.fallbackProviderId}
      />
    </div>
  );
}

export function ProviderPoolInspector({
  provider,
  onDetailLoaded,
}: ProviderPoolInspectorProps) {
  const providerId = provider?.id;
  const [detail, setDetail] = React.useState<ProviderDetail | null>(null);
  const [loading, setLoading] = React.useState(Boolean(provider));
  const [error, setError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async () => {
    if (!providerId) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const nextDetail = await fetchProviderDetail(providerId);
      setDetail(nextDetail);
      onDetailLoaded?.(nextDetail);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [onDetailLoaded, providerId]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDetail]);

  if (!provider) {
    return (
      <Card className="border-border bg-surface shadow-none">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground">
            <KeyRound aria-hidden="true" className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">请选择一个 Provider</p>
            <p className="text-sm leading-6 text-muted-foreground">
              选中列表行后，这里会展示凭据池状态与继续配置入口。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading && !detail) {
    return <InspectorSkeleton />;
  }

  const source = detail ?? provider;
  const typeLabel = providerTypeLabel(source.type);

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="provider-pool-inspector"
    >
      <CardContent className="grid gap-5 p-5">
        <div className="flex items-start justify-between">
          <SelectedContextHeader provider={source} typeLabel={typeLabel} />
          <Button
            aria-label="刷新"
            size="icon"
            variant="outline"
            onClick={() => void loadDetail()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
        </div>

        {error ? (
          <Alert variant="warning" data-testid="provider-pool-error">
            <AlertTriangle aria-hidden="true" className="size-4" />
            <AlertTitle>池检查信息不可用</AlertTitle>
            <AlertDescription>
              {error}。列表选择与详情入口仍可继续使用。
            </AlertDescription>
          </Alert>
        ) : null}

        {source.type === "opensubtitles" ? (
          <OpenSubtitlesInspectorContent
            source={source}
            detail={detail}
          />
        ) : (
          <XunleiInspectorContent source={source} />
        )}

        <Button asChild variant="outline" className="w-full">
          <Link href={`/providers/${source.id}`}>
            进入配置详情
            <ArrowRight aria-hidden="true" className="ml-1 size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
