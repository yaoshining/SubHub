"use client";

import * as React from "react";
import { AlertTriangle, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

import type {
  CallerKey,
  CallerKeyReveal,
  CallerKeyRotationResult,
} from "@/lib/api/caller-keys";
import { fetchCallerKeys } from "@/lib/api/caller-keys";
import {
  EmptyStateActionButton,
  EmptyStateCard,
} from "@/components/admin/empty-state-card";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  CallerKeyDetail,
  type RevealWindowState,
} from "@/components/api-keys/caller-key-detail";
import { CallerKeyForm } from "@/components/api-keys/caller-key-form";
import {
  CallerKeyInventory,
  type CallerKeyFilter,
} from "@/components/api-keys/caller-key-inventory";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError } from "@/lib/errors";

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return "Caller Key 列表加载失败，请稍后重试。";
};

function ApiKeysSkeleton() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-label="正在加载 API Keys 页面"
    >
      <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="h-28 rounded-lg border bg-surface" key={item} />
        ))}
      </div>
      <div className="grid gap-6 desktop:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
        <div className="h-96 rounded-lg border bg-surface" />
        <div className="h-96 rounded-lg border bg-surface" />
      </div>
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

const matchesFilter = (callerKey: CallerKey, filter: CallerKeyFilter) =>
  filter === "all" ||
  callerKey.environment === filter ||
  callerKey.status === filter;

export function ApiKeysClient() {
  const [callerKeys, setCallerKeys] = React.useState<CallerKey[]>([]);
  const [selectedCallerKeyId, setSelectedCallerKeyId] =
    React.useState<string>();
  const [filter, setFilter] = React.useState<CallerKeyFilter>("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [revealWindow, setRevealWindow] =
    React.useState<RevealWindowState | null>(null);
  const mountedRef = React.useRef(true);

  const loadCallerKeys = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCallerKeys();
      if (!mountedRef.current) {
        return;
      }
      setCallerKeys(list.items);
      setSelectedCallerKeyId((current) => {
        if (current && list.items.some((item) => item.id === current)) {
          return current;
        }
        return (
          list.items.find((item) => item.status === "active")?.id ??
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
      void loadCallerKeys();
    }, 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadCallerKeys]);

  const filteredCallerKeys = callerKeys.filter((callerKey) =>
    matchesFilter(callerKey, filter),
  );
  const selectedCallerKey = callerKeys.find(
    (callerKey) => callerKey.id === selectedCallerKeyId,
  );
  const selectedHiddenByFilter = Boolean(
    selectedCallerKey &&
    !filteredCallerKeys.some((item) => item.id === selectedCallerKey.id),
  );
  const activeCount = callerKeys.filter(
    (callerKey) => callerKey.status === "active",
  ).length;
  const suspendedCount = callerKeys.filter(
    (callerKey) => callerKey.status === "suspended",
  ).length;
  const rotatedCount = callerKeys.filter(
    (callerKey) => callerKey.status === "rotated",
  ).length;
  const quotaAlertCount = callerKeys.filter(
    (callerKey) => callerKey.quotaPolicy === "limited",
  ).length;

  const handleCreated = React.useCallback((result: CallerKeyReveal) => {
    setCallerKeys((current) => [
      result.callerKey,
      ...current.filter((item) => item.id !== result.callerKey.id),
    ]);
    setSelectedCallerKeyId(result.callerKey.id);
    setRevealWindow({
      callerKeyId: result.callerKey.id,
      secret: result.key,
      revealUntil:
        result.callerKey.revealUntil ??
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      source: "created",
    });
    setSuccess(
      `${result.callerKey.callerName} 已创建。请在受控窗口内复制完整明文。`,
    );
  }, []);

  const handleRotated = React.useCallback((result: CallerKeyRotationResult) => {
    setCallerKeys((current) => [
      result.callerKey,
      ...current
        .map((item) =>
          item.id === result.rotation.callerKeyId
            ? {
                ...item,
                status: "rotated" as const,
                lastRotatedAt: result.rotation.createdAt,
                revealUntil: null,
              }
            : item,
        )
        .filter((item) => item.id !== result.callerKey.id),
    ]);
    setSelectedCallerKeyId(result.callerKey.id);
    setRevealWindow({
      callerKeyId: result.callerKey.id,
      secret: result.key,
      revealUntil:
        result.callerKey.revealUntil ??
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      source: "rotated",
    });
    setSuccess(
      `${result.callerKey.callerName} 已轮换。新版本已选中，旧版本保留为已轮换状态。`,
    );
  }, []);

  const handleSuspended = React.useCallback((callerKey: CallerKey) => {
    setCallerKeys((current) =>
      current.map((item) => (item.id === callerKey.id ? callerKey : item)),
    );
    setSelectedCallerKeyId(callerKey.id);
    setRevealWindow((current) =>
      current?.callerKeyId === callerKey.id ? null : current,
    );
    setSuccess(`${callerKey.callerName} 已停用，新外部请求将立即被拒绝。`);
  }, []);

  const handleRevealExpired = React.useCallback((callerKeyId: string) => {
    setRevealWindow((current) =>
      current?.callerKeyId === callerKeyId ? null : current,
    );
  }, []);

  return (
    <div className="grid gap-6" data-testid="api-keys-page">
      <div className="flex flex-col gap-3 rounded-lg border bg-surface p-4 desktop:flex-row desktop:items-center desktop:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={activeCount > 0 ? "success" : "warning"}>
              {activeCount > 0 ? "对外服务可用" : "对外服务不可用"}
            </StatusBadge>
            <span className="text-sm text-muted-foreground">
              管理下游调用方 Key 的创建、轮换、停用与一次性明文窗口。
            </span>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            停用会立即拒绝新请求；轮换会创建新版本。两者均保留二次确认。
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            aria-label="刷新 Caller Key 列表"
            variant="outline"
            size="icon"
            onClick={() => void loadCallerKeys()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            onClick={() => document.getElementById("caller-name")?.focus()}
          >
            <KeyRound aria-hidden="true" className="size-4" />
            生成新 Key
          </Button>
        </div>
      </div>

      {activeCount === 0 && !loading ? (
        <Alert variant="warning" data-testid="api-keys-service-unavailable">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>对外服务不可用</AlertTitle>
          <AlertDescription>
            当前没有活跃 Caller Key。请创建首个 Key
            或轮换恢复有效入口，否则统一字幕出口无法被下游调用。
          </AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert variant="success" data-testid="caller-key-success">
          <ShieldCheck aria-hidden="true" className="size-4" />
          <AlertTitle>操作成功</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{success}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSuccess(null)}
              >
                知道了
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" data-testid="api-keys-error">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>Caller Key 信息不可用</AlertTitle>
          <AlertDescription>
            {error}。可重试刷新；已知上下文会尽量保留。
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && callerKeys.length === 0 ? <ApiKeysSkeleton /> : null}

      {!loading && callerKeys.length === 0 ? (
        <EmptyStateCard
          icon="key-round"
          title="还没有调用方 Key"
          description="创建首个 Caller Key 后，下游应用才能访问统一字幕出口。完整明文只会在受控窗口内显示一次。"
          action={
            <EmptyStateActionButton
              onClick={() => document.getElementById("caller-name")?.focus()}
            >
              创建首个 Key
            </EmptyStateActionButton>
          }
        />
      ) : null}

      {callerKeys.length > 0 ? (
        <section
          className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4"
          aria-label="Caller Key 摘要"
        >
          <SummaryCard
            label="Active keys"
            value={activeCount}
            description="仍可用于下游外部请求的入口。"
          />
          <SummaryCard
            label="Rotations / 30d"
            value={rotatedCount}
            description="当前契约以已轮换版本数近似展示。"
          />
          <SummaryCard
            label="Suspended"
            value={suspendedCount}
            description="已停用并拒绝新请求的 Key。"
          />
          <SummaryCard
            label="Quota alerts"
            value={quotaAlertCount}
            description="低频配额策略需关注的调用方。"
          />
        </section>
      ) : null}

      <div
        className="grid gap-6 desktop:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]"
        data-testid="api-keys-responsive-grid"
      >
        <div className="grid gap-6">
          {callerKeys.length > 0 ? (
            <CallerKeyInventory
              callerKeys={callerKeys}
              filteredCallerKeys={filteredCallerKeys}
              selectedCallerKeyId={selectedCallerKeyId}
              filter={filter}
              onFilterChange={setFilter}
              onSelectCallerKey={setSelectedCallerKeyId}
            />
          ) : null}
          <CallerKeyForm onCreated={handleCreated} />
        </div>
        <CallerKeyDetail
          callerKey={selectedCallerKey}
          hiddenByFilter={selectedHiddenByFilter}
          revealWindow={revealWindow}
          onRevealExpired={handleRevealExpired}
          onRotated={handleRotated}
          onSuspended={handleSuspended}
        />
      </div>

      <Card className="border-border bg-surface shadow-none">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base">治理说明</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0 text-sm leading-6 text-muted-foreground sm:p-6 sm:pt-0">
          <p>
            轮换与停用是不同动作：轮换生成新版本并提供一次性明文窗口；停用立即拒绝新请求。
          </p>
          <p>
            inventory 只展示受控片段，详情默认也不暴露完整明文；copy
            成功反馈不复述密钥内容。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
