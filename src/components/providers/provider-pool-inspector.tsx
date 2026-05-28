"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, KeyRound, RefreshCw } from "lucide-react";

import type { Provider, ProviderDetail } from "@/lib/api/providers";
import { fetchProviderDetail } from "@/lib/api/providers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppError } from "@/lib/errors";
import {
  CredentialStatusBadge,
  formatDateTime,
  formatTokenFragment,
  getProviderRiskLabel,
  ProviderStatusBadge,
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

export function ProviderPoolInspector({
  provider,
  onDetailLoaded,
}: ProviderPoolInspectorProps) {
  const [detail, setDetail] = React.useState<ProviderDetail | null>(null);
  const [loading, setLoading] = React.useState(Boolean(provider));
  const [error, setError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async () => {
    if (!provider) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const nextDetail = await fetchProviderDetail(provider.id);
      setDetail(nextDetail);
      onDetailLoaded?.(nextDetail);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [onDetailLoaded, provider]);

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
  const credentials = detail?.credentials ?? [];
  const summary = summarizeCredentials(credentials);

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="provider-pool-inspector"
    >
      <CardHeader className="gap-3 space-y-0 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-base">选中 Provider 池检查</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <ProviderStatusBadge status={source.status} />
              <span className="text-sm font-medium">{source.name}</span>
            </div>
          </div>
          <Button
            aria-label="刷新选中 Provider 凭据池"
            size="icon"
            variant="outline"
            onClick={() => void loadDetail()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="grid gap-5 pt-5">
        {error ? (
          <Alert variant="warning" data-testid="provider-pool-error">
            <AlertTriangle aria-hidden="true" className="size-4" />
            <AlertTitle>池检查信息不可用</AlertTitle>
            <AlertDescription>
              {error}。列表选择与详情入口仍可继续使用。
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">活跃 Token</p>
            <p className="mt-1 text-xl font-semibold">{summary.active}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">冷却中</p>
            <p className="mt-1 text-xl font-semibold">{summary.cooldown}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">隔离</p>
            <p className="mt-1 text-xl font-semibold">{summary.isolated}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">额度预警</p>
            <p className="mt-1 text-xl font-semibold">{summary.quotaWarning}</p>
          </div>
        </div>

        <Alert
          variant={
            source.availableCredentialCount > 0 ? "default" : "destructive"
          }
        >
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>调度风险</AlertTitle>
          <AlertDescription>{getProviderRiskLabel(source)}</AlertDescription>
        </Alert>

        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[36rem]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs">Token 片段</TableHead>
                <TableHead className="text-xs">状态</TableHead>
                <TableHead className="text-xs">剩余额度</TableHead>
                <TableHead className="text-xs">最近异常</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.length > 0 ? (
                credentials.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell className="font-mono text-xs">
                      {formatTokenFragment(credential)}
                    </TableCell>
                    <TableCell>
                      <CredentialStatusBadge status={credential.status} />
                    </TableCell>
                    <TableCell>
                      {credential.remainingQuota == null
                        ? "未知"
                        : `${credential.remainingQuota} 次`}
                    </TableCell>
                    <TableCell className="max-w-[16rem] text-muted-foreground">
                      {credential.lastErrorSummary ??
                        `最近使用：${formatDateTime(credential.lastUsedAt)}`}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Alert variant="destructive">
                      <AlertTriangle aria-hidden="true" className="size-4" />
                      <AlertTitle>当前无上游凭据</AlertTitle>
                      <AlertDescription>
                        请进入详情页新增至少一个可用凭据，否则该 Provider
                        无法服务。
                      </AlertDescription>
                    </Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            深配承接：权重、并发、冷却和回退目标必须在 Provider Detail 中保存。
          </p>
          <Button asChild>
            <Link href={`/providers/${source.id}`}>
              进入 Provider 配置
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
