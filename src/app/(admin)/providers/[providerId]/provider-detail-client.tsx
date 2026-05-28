"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import type {
  Provider,
  ProviderCredential,
  ProviderDetail,
} from "@/lib/api/providers";
import {
  fetchProviderDetail,
  fetchProviders,
  updateProvider,
} from "@/lib/api/providers";
import { StatusBadge } from "@/components/admin/status-badge";
import { ProviderActivity } from "@/components/providers/provider-activity";
import { ProviderCredentialTable } from "@/components/providers/provider-credential-table";
import {
  ProviderPolicyForm,
  type ProviderPolicyDraft,
} from "@/components/providers/provider-policy-form";
import {
  formatDateTime,
  ProviderStatusBadge,
  providerTypeLabel,
  summarizeCredentials,
} from "@/components/providers/provider-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AppError } from "@/lib/errors";

export type ProviderDetailClientProps = {
  providerId: string;
  postCreate?: boolean;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return "Provider 详情请求失败，请稍后重试。";
};

function toDraft(provider: ProviderDetail): ProviderPolicyDraft {
  return {
    name: provider.name,
    priority: provider.priority,
    weight: provider.weight,
    concurrencyLimit: provider.concurrencyLimit,
    rotationEnabled: provider.rotationEnabled,
    cooldownSeconds: provider.cooldownSeconds,
    fallbackProviderId: provider.fallbackProviderId,
  };
}

function DetailSkeleton() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-label="正在加载 Provider 详情"
    >
      <div className="h-28 rounded-lg border bg-surface" />
      <div className="grid gap-6 desktop:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-96 rounded-lg border bg-surface" />
        <div className="h-80 rounded-lg border bg-surface" />
      </div>
    </div>
  );
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

export function ProviderDetailClient({
  providerId,
  postCreate,
}: ProviderDetailClientProps) {
  const [provider, setProvider] = React.useState<ProviderDetail | null>(null);
  const [fallbackCandidates, setFallbackCandidates] = React.useState<
    Provider[]
  >([]);
  const [draft, setDraft] = React.useState<ProviderPolicyDraft | null>(null);
  const [dirtyFields, setDirtyFields] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );
  const [notes, setNotes] = React.useState(
    "该说明用于记录此 Provider 的配置意图。MVP 暂不持久化说明文本。",
  );
  const mountedRef = React.useRef(true);

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, list] = await Promise.all([
        fetchProviderDetail(providerId),
        fetchProviders().catch(() => ({ items: [], total: 0 })),
      ]);
      if (!mountedRef.current) {
        return;
      }
      setProvider(detail);
      setDraft(toDraft(detail));
      setFallbackCandidates(list.items);
      setDirtyFields([]);
    } catch (loadError) {
      if (mountedRef.current) {
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [providerId]);

  React.useEffect(() => {
    mountedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadDetail]);

  React.useEffect(() => {
    if (dirtyFields.length === 0) {
      return undefined;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyFields.length]);

  function updateDraft(nextDraft: ProviderPolicyDraft, fieldLabel: string) {
    setDraft(nextDraft);
    setSuccessMessage(null);
    setDirtyFields((current) =>
      current.includes(fieldLabel) ? current : [...current, fieldLabel],
    );
  }

  function updateCredentials(
    credentials: ProviderCredential[],
    dirtyLabel: string,
  ) {
    setProvider((current) => (current ? { ...current, credentials } : current));
    toast.success(`凭据操作已即时应用：${dirtyLabel}`);
  }

  async function savePolicy() {
    if (!provider || !draft) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProvider(provider.id, draft);
      setProvider((current) => ({
        ...(current ?? updated),
        ...updated,
        credentials: current?.credentials ?? updated.credentials,
      }));
      setDraft(toDraft(updated));
      setDirtyFields([]);
      setSuccessMessage(
        "策略已保存并生效。凭据操作已即时应用。可返回列表继续比较 Provider。所影响模块：运行策略。",
      );
      toast.success("Provider 策略已保存");
    } catch (saveError) {
      const message = getErrorMessage(saveError);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !provider) {
    return <DetailSkeleton />;
  }

  if (error && !provider) {
    return (
      <Alert variant="destructive" data-testid="provider-detail-error">
        <AlertTriangle aria-hidden="true" className="size-4" />
        <AlertTitle>Provider Detail 暂不可用</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadDetail()}
            >
              重试
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!provider || !draft) {
    return null;
  }

  const summary = summarizeCredentials(provider.credentials);
  const dirty = dirtyFields.length > 0;

  return (
    <div className="grid min-w-0 gap-6" data-testid="provider-detail-page">
      <div className="grid gap-4 rounded-lg border bg-surface p-4">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link href="/providers">
            <ChevronLeft aria-hidden="true" className="size-4" />
            返回服务商列表
          </Link>
        </Button>
        <div className="flex flex-col gap-4 desktop:flex-row desktop:items-start desktop:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {provider.name}
              </h1>
              <ProviderStatusBadge status={provider.status} />
              <StatusBadge tone="secondary">
                {providerTypeLabel(provider.type)}
              </StatusBadge>
              {dirty ? (
                <StatusBadge tone="warning">含未保存变更</StatusBadge>
              ) : null}
            </div>
            <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
              集中管理运行策略、上游 Token 池与最近行为。最后更新：
              {formatDateTime(provider.updatedAt)}。
            </p>
          </div>
          <Button onClick={() => void savePolicy()} disabled={saving || !dirty}>
            <Save aria-hidden="true" className="size-4" />
            {saving ? "保存中" : "保存配置"}
          </Button>
        </div>
      </div>

      {postCreate ? (
        <Alert variant="warning" data-testid="post-create-guide">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>Provider 已创建，以下策略项仍待补充</AlertTitle>
          <AlertDescription>
            名称与首个 API Key 已录入。请继续确认
            <a className="mx-1 underline" href="#policy-weight-concurrency">
              权重 / 并发
            </a>
            <a className="mx-1 underline" href="#policy-rotation-cooldown">
              轮换 / 冷却
            </a>
            <a className="mx-1 underline" href="#policy-fallback">
              失败切换与回退 Provider
            </a>
            。
          </AlertDescription>
        </Alert>
      ) : null}

      {dirty ? (
        <Alert variant="warning" data-testid="dirty-state-alert">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>存在未保存变更</AlertTitle>
          <AlertDescription>
            受影响模块：{dirtyFields.join("、")}
            。离开或刷新前请保存，避免策略变更丢失。
          </AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert variant="success" data-testid="provider-save-success">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          <AlertTitle>保存成功</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section
        className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4"
        aria-label="Provider 关键指标"
      >
        <MetricCard
          label="优先级"
          value={provider.priority}
          description="数值越高越优先进入调度。"
        />
        <MetricCard
          label="活跃 Token"
          value={summary.active}
          description={`可用凭据 ${provider.availableCredentialCount} 个。`}
        />
        <MetricCard
          label="冷却窗口"
          value={`${provider.cooldownSeconds}s`}
          description={`冷却中 Token ${summary.cooldown} 个。`}
        />
        <MetricCard
          label="回退目标"
          value={provider.fallbackProviderId ?? "未设置"}
          description="不可用时的备用 Provider。"
        />
      </section>

      <div
        className="grid min-w-0 gap-6 desktop:grid-cols-[minmax(0,1fr)_22rem] desktop:items-start"
        data-testid="provider-detail-layout-grid"
      >
        <div
          className="grid min-w-0 gap-6"
          data-testid="provider-detail-primary-column"
        >
          <ProviderPolicyForm
            provider={provider}
            draft={draft}
            fallbackCandidates={fallbackCandidates}
            onDraftChange={updateDraft}
          />
          <ProviderCredentialTable
            providerId={provider.id}
            credentials={provider.credentials}
            onCredentialsChange={updateCredentials}
          />
        </div>
        <div
          className="grid min-w-0 gap-6 desktop:sticky desktop:top-20 desktop:self-start"
          data-testid="provider-detail-secondary-column"
        >
          <ProviderActivity provider={provider} />
          <Card className="border-border bg-surface shadow-none">
            <CardHeader>
              <CardTitle className="text-base">配置说明</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-32"
                aria-label="Provider 配置说明"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                更新说明不需要单独保存；当前 MVP 暂不向后端持久化该说明。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
