"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Shield,
} from "lucide-react";

import {
  type SettingsStatus,
  fetchSettingsStatus,
} from "@/lib/api/settings";
import { AppError } from "@/lib/errors";
import { ConfigRouting } from "@/components/settings/config-routing";
import { ReadinessCards } from "@/components/settings/readiness-cards";
import { ReadinessChecklist } from "@/components/settings/readiness-checklist";
import { StatusBadge } from "@/components/admin/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type SettingsClientProps = {
  initialStatus?: SettingsStatus;
};

type ReadinessCondition = SettingsStatus["missingConditions"][number];

const missingConditionLabels: Record<ReadinessCondition, string> = {
  admin: "首个管理员",
  provider: "可用 Provider",
  caller_key: "调用方 Key",
};

const partialErrorTargetLabels = {
  environment: "部署环境",
  version: "版本读数",
  admin: "管理员初始化",
  provider: "Provider 可用性",
  caller_key: "调用方 Key 可用性",
} as const;

const environmentLabels = {
  production: "生产环境",
  development: "开发环境",
  test: "测试环境",
  unknown: "未知环境",
} as const;

function getErrorMessage(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Settings 状态读取失败，请稍后重试。";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getEnvironmentLabel(environment: string) {
  return (
    environmentLabels[environment as keyof typeof environmentLabels] ??
    environment
  );
}

function SectionPanel({
  title,
  description,
  children,
  id,
  testId,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  id?: string;
  testId?: string;
}) {
  return (
    <section id={id} data-testid={testId}>
      <Card className="border-border bg-surface shadow-none">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <div
      aria-label="正在加载 Settings 状态"
      className="grid gap-6"
      role="status"
    >
      <div className="h-24 rounded-lg border bg-surface" />
      <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-36 rounded-lg border bg-surface" key={index} />
        ))}
      </div>
      <div className="h-40 rounded-lg border bg-surface" />
      <div className="h-56 rounded-lg border bg-surface" />
    </div>
  );
}

function FutureCapabilityCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Badge className="rounded-full" variant="secondary">
          后续版本
        </Badge>
      </div>
    </div>
  );
}

export function SettingsClient({ initialStatus }: SettingsClientProps) {
  const [status, setStatus] = React.useState<SettingsStatus | undefined>(
    initialStatus,
  );
  const [loading, setLoading] = React.useState(!initialStatus);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);

  const loadStatus = React.useCallback(
    async (isMounted: () => boolean = () => mountedRef.current) => {
      if (isMounted()) {
        setRequestError(null);
      }

      try {
        const nextStatus = await fetchSettingsStatus();
        if (isMounted()) {
          setStatus(nextStatus);
        }
      } catch (error) {
        if (isMounted()) {
          setRequestError(getErrorMessage(error));
        }
      } finally {
        if (isMounted()) {
          setLoading(false);
        }
      }
    },
    [],
  );

  React.useEffect(() => {
    mountedRef.current = true;

    if (!initialStatus) {
      let mounted = true;
      const timeoutId = window.setTimeout(() => {
        void loadStatus(() => mounted && mountedRef.current);
      }, 0);

      return () => {
        mounted = false;
        mountedRef.current = false;
        window.clearTimeout(timeoutId);
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [initialStatus, loadStatus]);

  const missingActions = status?.missingConditions.map((condition) => {
    if (condition === "provider") {
      return {
        href: "/providers",
        label: "前往服务商页补齐 Provider 与凭据",
      };
    }
    if (condition === "caller_key") {
      return {
        href: "/api-keys",
        label: "前往 API 密钥页补齐调用方 Key",
      };
    }
    return {
      href: "/login",
      label: "返回登录页完成首轮开通",
    };
  });

  const readinessPartialErrors =
    status?.partialErrors.filter((error) =>
      ["admin", "provider", "caller_key"].includes(error.target),
    ) ?? [];
  const hasReadinessPartialErrors = readinessPartialErrors.length > 0;

  return (
    <div
      className="grid min-w-0 gap-6 overflow-x-hidden"
      data-testid="settings-page"
    >
      <section
        className="flex flex-col gap-4 rounded-lg border bg-surface p-4 sm:p-5"
        data-testid="settings-header-panel"
      >
        <div className="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between">
          <div className="space-y-3">
            {status ? (
              <StatusBadge
                tone={
                  status.gatewayReady
                    ? "success"
                    : hasReadinessPartialErrors &&
                        status.missingConditions.length === 0
                      ? "secondary"
                      : "warning"
                }
              >
                {status.gatewayReady
                  ? "统一出口已就绪"
                  : hasReadinessPartialErrors &&
                      status.missingConditions.length === 0
                    ? "统一出口读数受限"
                    : "统一出口未就绪"}
              </StatusBadge>
            ) : (
              <StatusBadge tone="secondary">等待状态读数</StatusBadge>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">当前页只做状态确认与配置分流</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Settings 保持只读定位，不在此页提供 Provider、API 密钥、成员治理
                或权限策略的深配置表单与保存动作。
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="sm" variant="outline">
              <a href="#deployment-readings">查看部署信息</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="#version-notes">查看版本说明</a>
            </Button>
          </div>
        </div>
      </section>

      {loading && !status ? <SettingsSkeleton /> : null}

      {requestError && status ? (
        <Alert data-testid="settings-request-error" variant="warning">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>刷新 Settings 状态失败</AlertTitle>
          <AlertDescription>
            已保留页面上一次可用信息，失败原因：{requestError}
          </AlertDescription>
        </Alert>
      ) : null}

      {status ? (
        <div className="grid gap-6" data-testid="settings-content">
          {!status.gatewayReady &&
          hasReadinessPartialErrors &&
          status.missingConditions.length === 0 ? (
            <Alert data-testid="settings-readiness-degraded" variant="warning">
              <AlertTriangle aria-hidden="true" className="size-4" />
              <AlertTitle>统一出口状态暂时无法完全确认</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  部分 readiness 摘要读取失败，当前页面只保留已知可用信息，不把失败项直接当成缺失条件。
                </p>
                <ul className="space-y-2">
                  {readinessPartialErrors.map((error, index) => (
                    <li
                      className="rounded-md border bg-muted/30 px-3 py-2"
                      key={`${error.target}-${index}`}
                    >
                      <span className="font-medium">
                        {partialErrorTargetLabels[error.target] ?? error.target}
                      </span>
                      ：{error.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : !status.gatewayReady ? (
            <Alert data-testid="settings-not-ready" variant="warning">
              <AlertTriangle aria-hidden="true" className="size-4" />
              <AlertTitle>当前实例仍未满足对外服务条件</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  缺失条件：
                  {status.missingConditions
                    .map((condition) => missingConditionLabels[condition])
                    .join("、")}
                  。请前往对应治理页处理，而不是在当前页尝试编辑。
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {missingActions?.map((action) => (
                    <Button asChild className="justify-start" key={action.href} size="sm" variant="outline">
                      <Link href={action.href}>{action.label}</Link>
                    </Button>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="success">
              <CheckCircle2 aria-hidden="true" className="size-4" />
              <AlertTitle>基础服务条件已满足</AlertTitle>
              <AlertDescription>
                最近检测于 {formatDateTime(status.lastCheckedAt)}，当前实例已具备统一出口所需的最小条件。
              </AlertDescription>
            </Alert>
          )}

          {status.partialErrors.length > 0 ? (
            <Alert data-testid="settings-partial-errors" variant="warning">
              <AlertTriangle aria-hidden="true" className="size-4" />
              <AlertTitle>部署读数存在局部失败</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>已保留其余可用信息，并明确标出失败对象：</p>
                <ul className="space-y-2">
                  {status.partialErrors.map((error, index) => (
                    <li className="rounded-md border bg-muted/30 px-3 py-2" key={`${error.target}-${index}`}>
                      <span className="font-medium">
                        {partialErrorTargetLabels[error.target] ?? error.target}
                      </span>
                      ：{error.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <ReadinessCards status={status} />

          <SectionPanel
            description="本页负责说明当前实例是否可用、哪些能力已纳入 MVP，以及管理员下一步应该去哪个治理页处理。"
            testId="settings-scope-section"
            title="范围说明"
          >
            <div className="grid gap-4">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                <Info aria-hidden="true" className="mt-0.5 size-4 text-primary" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Settings 不是系统配置中心
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Provider 调度、API 密钥生命周期、成员治理与复杂权限模型都必须在各自页面完成。
                    当前页只提供确认、解释与分流，不伪装保存动作。
                  </p>
                </div>
              </div>
              <div className="grid gap-3 desktop:grid-cols-2">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-medium">已纳入当前 MVP</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    实例环境、版本、管理员初始化、Provider 可用性、调用方 Key
                    可用性与统一出口 readiness。
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-medium">不在当前页承接</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    深配置表单、保存动作、危险写入、权限矩阵、审批流与系统级策略编辑。
                  </p>
                </div>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel
            description="为不同配置职责提供明确入口，避免“更多设置”式模糊跳转。"
            testId="settings-routing-section"
            title="配置分流"
          >
            <ConfigRouting />
          </SectionPanel>

          <SectionPanel
            description="只读核查当前实例的最小服务条件，不重复各治理页完整明细。"
            testId="settings-checklist-section"
            title="基础服务核查"
          >
            <ReadinessChecklist status={status} />
          </SectionPanel>

          <SectionPanel
            description="部署环境、版本与最近检查时间只做展示，不在本页执行保存、切换或升级。"
            id="deployment-readings"
            testId="settings-deployment-section"
            title="部署读数"
          >
            <div
              className="grid gap-4 desktop:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]"
              data-testid="settings-deployment-grid"
            >
              <div className="rounded-lg border bg-muted/20 p-5">
                <dl className="grid gap-4">
                  <div className="grid gap-1">
                    <dt className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      部署环境
                    </dt>
                    <dd className="text-base font-medium">
                      {getEnvironmentLabel(status.environment)}
                    </dd>
                    {status.partialErrors.some(
                      (error) => error.target === "environment",
                    ) ? (
                      <p className="text-sm text-warning">
                        环境读数失败，当前值为回退展示。
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-1" id="version-notes">
                    <dt className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      系统版本
                    </dt>
                    <dd className="font-mono text-base font-medium">
                      {status.version}
                    </dd>
                    {status.partialErrors.some(
                      (error) => error.target === "version",
                    ) ? (
                      <p className="text-sm text-warning">
                        版本读数失败，当前值为默认回退版本。
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      最近检测
                    </dt>
                    <dd className="font-mono text-sm text-foreground">
                      {status.lastCheckedAt}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-lg border bg-muted/20 p-5">
                <div className="flex items-start gap-3">
                  <Shield
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-primary"
                  />
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">版本说明</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        当前页仅展示实例版本与部署读数，帮助管理员确认环境上下文；
                        若需处理变更，请前往真正承接该配置的治理页。
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                      <p>
                        当前版本：
                        <span className="ml-1 font-mono text-foreground">
                          {status.version}
                        </span>
                      </p>
                      <p className="mt-2">
                        最近检查：{formatDateTime(status.lastCheckedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel
            description="以下能力尚未纳入当前 MVP，只保留边界提示，不提供编辑入口。"
            testId="settings-future-section"
            title="后续能力预留"
          >
            <div
              className="grid gap-4 desktop:grid-cols-2"
              data-testid="settings-future-capabilities"
            >
              <FutureCapabilityCard
                description="缓存预热、命中治理与清理策略仍属于后续能力，不在本页提供可编辑配置。"
                title="缓存治理"
              />
              <FutureCapabilityCard
                description="镜像与同步策略暂未进入 MVP，本页只保留能力边界说明。"
                title="镜像策略 / 媒体同步"
              />
              <FutureCapabilityCard
                description="复杂权限矩阵、审批护栏与精细访问策略仍由未来 access-control 页面承接。"
                title="访问控制"
              />
              <FutureCapabilityCard
                description="高级系统级策略需要独立规则收敛后再进入实现，不在当前页假装可用。"
                title="高级系统策略"
              />
            </div>
          </SectionPanel>
        </div>
      ) : !loading ? (
        <Alert data-testid="settings-empty" variant="destructive">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>Settings 暂不可用</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              当前没有可展示的已知信息，请重新读取状态，或检查 Settings status
              接口是否可用。
            </p>
            {requestError ? (
              <p className="text-sm text-destructive">失败原因：{requestError}</p>
            ) : null}
            <Button
              className="w-fit"
              onClick={() => {
                setLoading(true);
                void loadStatus();
              }}
              size="sm"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className="mr-2 size-4" />
              重新读取状态
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
