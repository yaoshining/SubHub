"use client";

import * as React from "react";
import {
  AlertTriangle,
  Ban,
  Clock3,
  KeyRound,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import type {
  CallerKey,
  CallerKeyRotationResult,
  CallerKeyUsage,
} from "@/lib/api/caller-keys";
import {
  fetchCallerKeyUsage,
  rotateCallerKey,
  suspendCallerKey,
} from "@/lib/api/caller-keys";
import { StatusBadge } from "@/components/admin/status-badge";
import { RevealSecret } from "@/components/api-keys/reveal-secret";
import {
  CallerKeyStatusBadge,
  getCallerKeyEnvironmentLabel,
  getCallerKeyStatusLabel,
} from "@/components/api-keys/caller-key-inventory";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppError } from "@/lib/errors";
import { cn } from "@/lib/utils";

export type RevealWindowState = {
  callerKeyId: string;
  secret: string;
  revealUntil: string;
  source: "created" | "rotated";
};

export type CallerKeyDetailProps = {
  callerKey?: CallerKey;
  hiddenByFilter?: boolean;
  revealWindow?: RevealWindowState | null;
  readOnly?: boolean;
  onRevealExpired: (callerKeyId: string) => void;
  onRotated: (result: CallerKeyRotationResult) => void;
  onSuspended: (callerKey: CallerKey) => void;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return "Caller Key 操作失败，请稍后重试。";
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "暂无";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

function UsageSkeleton() {
  return (
    <div className="grid gap-3" role="status" aria-label="正在加载最近使用摘要">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-20 rounded-lg border bg-muted/30" />
        ))}
      </div>
      <div className="h-24 rounded-lg border bg-muted/30" />
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

function EmptySelection() {
  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="caller-key-no-selection"
    >
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base">未选择 Key</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="flex size-12 items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground">
          <KeyRound aria-hidden="true" className="size-5" />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          从左侧 inventory
          选择一个调用方，查看完整业务信息、最近使用与高风险动作。该状态不会残留上一条
          Key 的旧数据。
        </p>
      </CardContent>
    </Card>
  );
}

function ActionConfirm({
  title,
  description,
  actionLabel,
  variant = "default",
  disabled,
  children,
  onConfirm,
}: {
  title: string;
  description: string;
  actionLabel: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  children: React.ReactNode;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            className={cn(
              variant === "destructive" &&
                buttonVariants({ variant: "destructive" }),
            )}
            onClick={onConfirm}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CallerKeyDetail({
  callerKey,
  hiddenByFilter,
  revealWindow,
  readOnly,
  onRevealExpired,
  onRotated,
  onSuspended,
}: CallerKeyDetailProps) {
  const [usage, setUsage] = React.useState<CallerKeyUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionPending, setActionPending] = React.useState<
    "rotate" | "suspend" | null
  >(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!callerKey) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setUsage(null);
      setLoadingUsage(true);
      setError(null);
      void fetchCallerKeyUsage(callerKey.id, { signal: controller.signal })
        .then((nextUsage) => {
          if (mountedRef.current) {
            setUsage(nextUsage);
          }
        })
        .catch((usageError: unknown) => {
          if (!controller.signal.aborted && mountedRef.current) {
            setError(getErrorMessage(usageError));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted && mountedRef.current) {
            setLoadingUsage(false);
          }
        });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [callerKey]);

  if (!callerKey) {
    return <EmptySelection />;
  }

  const currentReveal =
    revealWindow?.callerKeyId === callerKey.id ? revealWindow : null;
  const canUseHighRiskActions = !readOnly && callerKey.status === "active";

  async function handleRotate() {
    setError(null);
    setActionPending("rotate");
    try {
      const result = await rotateCallerKey(callerKey!.id);
      onRotated(result);
    } catch (rotateError) {
      setError(getErrorMessage(rotateError));
    } finally {
      setActionPending(null);
    }
  }

  async function handleSuspend() {
    setError(null);
    setActionPending("suspend");
    try {
      const result = await suspendCallerKey(callerKey!.id);
      onSuspended(result);
    } catch (suspendError) {
      setError(getErrorMessage(suspendError));
    } finally {
      setActionPending(null);
    }
  }

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="caller-key-detail"
    >
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="line-clamp-2 text-base">
                {callerKey.callerName}
              </CardTitle>
              <CallerKeyStatusBadge status={callerKey.status} />
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {callerKey.keyPrefix ?? "subhub_••••"}…
              {callerKey.keySuffix ?? "••••••"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
            <ActionConfirm
              title="确认轮换当前 Caller Key"
              description="轮换会创建新版本并让当前 Key 进入已轮换状态。新明文只会在受控窗口内显示，请确认下游具备更新窗口。"
              actionLabel={actionPending === "rotate" ? "轮换中" : "确认轮换"}
              disabled={actionPending !== null}
              onConfirm={() => void handleRotate()}
            >
              <Button
                type="button"
                variant="outline"
                disabled={!canUseHighRiskActions || actionPending !== null}
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                轮换当前 Key
              </Button>
            </ActionConfirm>
            <ActionConfirm
              title="确认停用当前 Caller Key"
              description="停用会立即阻止新的外部字幕请求，且不会生成新版本。这与轮换是不同动作，请确认正在处理正确调用方。"
              actionLabel={actionPending === "suspend" ? "停用中" : "确认停用"}
              variant="destructive"
              disabled={actionPending !== null}
              onConfirm={() => void handleSuspend()}
            >
              <Button
                type="button"
                variant="destructive"
                disabled={!canUseHighRiskActions || actionPending !== null}
              >
                <Ban aria-hidden="true" className="size-4" />
                停用
              </Button>
            </ActionConfirm>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 p-4 pt-0 sm:p-6 sm:pt-0">
        {hiddenByFilter ? (
          <Alert variant="warning" data-testid="caller-key-hidden-by-filter">
            <AlertTriangle aria-hidden="true" className="size-4" />
            <AlertTitle>当前对象不在筛选结果中</AlertTitle>
            <AlertDescription>
              详情仍保留当前选中上下文；切换筛选或从 inventory 选择其他 Key
              可更新详情。
            </AlertDescription>
          </Alert>
        ) : null}

        {readOnly ? (
          <Alert variant="warning" data-testid="caller-key-readonly">
            <ShieldAlert aria-hidden="true" className="size-4" />
            <AlertTitle>只读访问</AlertTitle>
            <AlertDescription>
              当前权限仅允许查看摘要和业务状态，不能
              reveal、copy、轮换或停用完整 Key。
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive" data-testid="caller-key-detail-error">
            <AlertTriangle aria-hidden="true" className="size-4" />
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {getCallerKeyEnvironmentLabel(callerKey.environment)}
          </Badge>
          <Badge variant="outline">{callerKey.scope}</Badge>
          <Badge variant="outline">{callerKey.quotaPolicy}</Badge>
          <Badge variant="outline">
            创建 {formatDateTime(callerKey.createdAt)}
          </Badge>
        </div>

        {currentReveal && !readOnly ? (
          <RevealSecret
            secret={currentReveal.secret}
            revealUntil={currentReveal.revealUntil}
            disabled={readOnly}
            onExpired={() => onRevealExpired(callerKey.id)}
          />
        ) : null}

        {!currentReveal ? (
          <Alert>
            <KeyRound aria-hidden="true" className="size-4" />
            <AlertTitle>默认态不展示完整明文</AlertTitle>
            <AlertDescription>
              当前只保留受控片段。完整明文仅在新建或轮换后的 reveal window
              内可显示与复制。
            </AlertDescription>
          </Alert>
        ) : null}

        <Separator />

        <section className="grid gap-3" aria-label="最近 24 小时使用摘要">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">最近使用与轮换</h3>
            <StatusBadge
              tone={callerKey.status === "active" ? "success" : "secondary"}
            >
              {getCallerKeyStatusLabel(callerKey.status)}
            </StatusBadge>
          </div>
          {loadingUsage && !usage ? <UsageSkeleton /> : null}
          {usage ? (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Search"
                  value={usage.searchCount}
                  helper="最近记录中的查询次数"
                />
                <Metric
                  label="Download"
                  value={usage.downloadCount}
                  helper="最近记录中的下载次数"
                />
                <Metric
                  label="Last used"
                  value={formatDateTime(usage.lastUsedAt)}
                  helper="最近一次外部调用"
                />
              </div>
              <div className="rounded-lg border bg-background p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock3
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  最近轮换结果
                </div>
                {usage.recentRotations.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {usage.recentRotations.slice(0, 3).map((rotation) => (
                      <div
                        key={rotation.id}
                        className="flex flex-col gap-1 rounded-md bg-muted/30 p-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span>
                          {rotation.oldKeySuffix ?? "旧片段"} →{" "}
                          {rotation.newKeySuffix ?? "新片段"}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDateTime(rotation.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    暂无轮换记录。创建后首次轮换会在这里保留结果片段与时间。
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}
