"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
} from "lucide-react";

import {
  fetchDashboardSummary,
  type DashboardSummary,
} from "@/lib/api/dashboard";
import { AppError } from "@/lib/errors";
import { StatusBadge } from "@/components/admin/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

type DashboardClientProps = {
  initialSummary?: DashboardSummary;
};

const missingConditionLabels = {
  admin: "首个管理员",
  provider: "可用 Provider",
  caller_key: "调用方 Key",
} as const;

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "摘要请求失败，请稍后重试。";
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (["enabled", "healthy", "ready", "idle"].includes(status)) {
    return "success";
  }
  if (["degraded", "needs_config", "not_ready"].includes(status)) {
    return "warning";
  }
  return "secondary";
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card className="border-border bg-muted/30 shadow-none">
      <CardContent className="space-y-2 p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div
      className="grid gap-6"
      aria-label="正在加载 Dashboard 摘要"
      role="status"
    >
      <div className="h-24 rounded-lg border bg-surface" />
      <div className="grid gap-4 desktop:grid-cols-3">
        <div className="h-32 rounded-lg border bg-surface" />
        <div className="h-32 rounded-lg border bg-surface" />
        <div className="h-32 rounded-lg border bg-surface" />
      </div>
      <div className="h-64 rounded-lg border bg-surface" />
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

export function DashboardClient({ initialSummary }: DashboardClientProps) {
  const [summary, setSummary] = React.useState<DashboardSummary | undefined>(
    initialSummary,
  );
  const [loading, setLoading] = React.useState(!initialSummary);
  const [failedObject, setFailedObject] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);

  const fetchAndSetSummary = React.useCallback(async () => {
    if (mountedRef.current) {
      setFailedObject(null);
    }

    try {
      const nextSummary = await fetchDashboardSummary();
      if (mountedRef.current) {
        setSummary(nextSummary);
      }
    } catch (error) {
      if (mountedRef.current) {
        setFailedObject(`Dashboard 摘要：${getErrorMessage(error)}`);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!initialSummary) {
      let mounted = true;

      fetchDashboardSummary()
        .then((nextSummary) => {
          if (mounted) {
            setSummary(nextSummary);
          }
        })
        .catch((error: unknown) => {
          if (mounted) {
            setFailedObject(`Dashboard 摘要：${getErrorMessage(error)}`);
          }
        })
        .finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });

      return () => {
        mounted = false;
      };
    }
    return undefined;
  }, [initialSummary]);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function refreshSummary() {
    setLoading(true);
    await fetchAndSetSummary();
  }

  const actions = (
    <div className="flex flex-col gap-3 rounded-lg border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium">Dashboard 摘要</p>
        <p className="text-xs leading-5 text-muted-foreground">
          本页只做状态发现与跳转，不承载深度编辑。
        </p>
      </div>
      <Button
        aria-label="刷新 Dashboard 摘要"
        variant="outline"
        size="icon"
        onClick={() => void refreshSummary()}
        disabled={loading}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between">
        {summary ? (
          <StatusBadge
            tone={summary.readiness.gatewayReady ? "success" : "warning"}
          >
            {summary.readiness.gatewayReady ? "已就绪" : "未就绪"}
          </StatusBadge>
        ) : null}
        {actions}
      </div>

      {loading && !summary ? <DashboardSkeleton /> : null}

      {failedObject ? (
        <Alert variant="warning" data-testid="dashboard-partial-error">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>局部摘要加载失败</AlertTitle>
          <AlertDescription>
            已保留页面上一次可用信息，失败对象为 {failedObject}。
          </AlertDescription>
        </Alert>
      ) : null}

      {summary ? (
        <div className="grid gap-6" data-testid="dashboard-summary">
          <Alert
            variant={summary.readiness.gatewayReady ? "success" : "warning"}
            className="bg-surface"
          >
            {summary.readiness.gatewayReady ? (
              <CheckCircle2 aria-hidden="true" className="size-4" />
            ) : (
              <AlertTriangle aria-hidden="true" className="size-4" />
            )}
            <AlertTitle>{summary.northStar.message}</AlertTitle>
            <AlertDescription>
              最近检查：{formatDateTime(summary.readiness.lastCheckedAt)}
            </AlertDescription>
          </Alert>

          {!summary.readiness.gatewayReady ? (
            <SectionCard title="未完成首轮开通">
              <div className="grid gap-3 sm:grid-cols-3">
                {summary.readiness.missingConditions.map((condition) => (
                  <div
                    className="rounded-lg border bg-muted/30 p-4"
                    key={condition}
                  >
                    <p className="text-sm font-medium">
                      {missingConditionLabels[condition] ?? condition}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      该条件缺失时，统一字幕出口不会被标记为可服务。
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <section className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
            <MetricCard
              label="可用 Provider"
              value={summary.readiness.activeProviderCount}
              description="已启用且至少存在一个活跃凭据。"
            />
            <MetricCard
              label="活跃调用方 Key"
              value={summary.readiness.activeCallerKeyCount}
              description="外部应用可用于访问统一字幕出口。"
            />
            <MetricCard
              label="待处理队列"
              value={summary.queue.pendingJobs}
              description={`失败任务 ${summary.queue.failedJobs} 个。`}
            />
            <MetricCard
              label="缓存命中"
              value={
                summary.cache.hitRate == null
                  ? "未配置"
                  : `${Math.round(summary.cache.hitRate * 100)}%`
              }
              description={`覆盖状态：${summary.cache.coverage}`}
            />
          </section>

          <div className="grid gap-6 desktop:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
            <SectionCard
              title="Provider 健康快照"
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/providers">管理 Providers</Link>
                </Button>
              }
            >
              {summary.providerSnapshot.items.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-xs">Provider</TableHead>
                      <TableHead className="text-xs">状态</TableHead>
                      <TableHead className="text-xs">活跃凭据</TableHead>
                      <TableHead className="text-xs">最近异常</TableHead>
                      <TableHead className="text-right text-xs">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.providerSnapshot.items.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{provider.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {provider.type}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="rounded-full"
                            data-status-tone={statusTone(provider.status)}
                          >
                            {provider.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{provider.activeCredentialCount}</TableCell>
                        <TableCell className="max-w-[16rem] text-muted-foreground">
                          {provider.lastErrorSummary ?? "无"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/providers/${provider.id}`}>
                              查看详情
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-5">
                  <p className="font-medium">还没有 Provider</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    新增 OpenSubtitles Provider 后，Dashboard
                    将展示可用性与凭据池状态。
                  </p>
                </div>
              )}
            </SectionCard>

            <div className="grid gap-6">
              <SectionCard title="队列与缓存信号">
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                    <Activity
                      aria-hidden="true"
                      className="mt-0.5 size-4 text-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">
                        队列状态：{summary.queue.status}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        当前无独立任务队列积压时，应继续关注 Provider 与调用方
                        Key 是否可用。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                    <Database
                      aria-hidden="true"
                      className="mt-0.5 size-4 text-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">
                        缓存状态：{summary.cache.status}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        MVP 中缓存读数可为空，但必须明确展示覆盖信号。
                      </p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="最近失败对象">
                {summary.recentIssues.length > 0 ? (
                  <div className="space-y-3">
                    {summary.recentIssues.map((issue) => (
                      <div
                        className="rounded-lg border bg-muted/30 p-3 text-sm"
                        key={issue.id}
                      >
                        <p className="font-medium">
                          {issue.targetType}
                          {issue.targetId ? ` · ${issue.targetId}` : ""}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {issue.message ?? "未提供失败原因。"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    最近没有记录到需要人工介入的失败对象。
                  </p>
                )}
              </SectionCard>
            </div>
          </div>

          <SectionCard title="下一步动作">
            <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
              {summary.nextActions.map((action) => (
                <Link
                  className="group rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={action.href}
                  key={action.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Badge
                        variant={
                          action.priority === "high" ? "warning" : "secondary"
                        }
                        className="mb-3 rounded-full"
                      >
                        {action.priority === "high" ? "优先处理" : "建议处理"}
                      </Badge>
                      <p className="font-medium">{action.label}</p>
                    </div>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : !loading ? (
        <Alert variant="destructive">
          <Server aria-hidden="true" className="size-4" />
          <AlertTitle>Dashboard 暂不可用</AlertTitle>
          <AlertDescription>
            当前没有可展示的已知信息，请刷新或检查 Dashboard 摘要接口。
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
