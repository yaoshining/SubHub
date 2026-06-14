import type { ReactNode } from "react";
import { type LucideIcon, Server, Settings, Shield, Users } from "lucide-react";

import type { SettingsStatus } from "@/lib/api/settings";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent } from "@/components/ui/card";

const environmentLabels = {
  production: "生产环境",
  staging: "预发环境",
  development: "开发环境",
  test: "测试环境",
  unknown: "未知环境",
} as const;

function getEnvironmentLabel(environment: string) {
  return (
    environmentLabels[environment as keyof typeof environmentLabels] ??
    environment
  );
}

function ReadinessCard({
  title,
  value,
  description,
  icon: Icon,
  badge,
  mono = false,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  badge: ReactNode;
  mono?: boolean;
}) {
  return (
    <Card className="border-border bg-muted/20 shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-background text-primary">
            <Icon aria-hidden="true" className="size-4" />
          </div>
          {badge}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p
            className={
              mono ? "font-mono text-lg font-semibold" : "text-lg font-semibold"
            }
          >
            {value}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReadinessCards({ status }: { status: SettingsStatus }) {
  const hasAdminPartialError = status.partialErrors.some(
    (error) => error.target === "admin",
  );
  const hasReadinessPartialError = status.partialErrors.some((error) =>
    ["admin", "provider", "caller_key"].includes(error.target),
  );

  return (
    <section
      className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4"
      data-testid="settings-readiness-cards"
    >
      <ReadinessCard
        badge={
          <StatusBadge tone="secondary">
            {getEnvironmentLabel(status.environment)}
          </StatusBadge>
        }
        description="展示当前实例运行环境，帮助维护者确认部署上下文。"
        icon={Server}
        title="部署环境"
        value={getEnvironmentLabel(status.environment)}
      />
      <ReadinessCard
        badge={<StatusBadge tone="secondary">只读</StatusBadge>}
        description="当前版本号只做读数展示，不在本页承担升级或切换动作。"
        icon={Settings}
        mono
        title="系统版本"
        value={status.version}
      />
      <ReadinessCard
        badge={
          <StatusBadge
            tone={
              hasAdminPartialError
                ? "secondary"
                : status.adminInitialized
                  ? "success"
                  : "warning"
            }
          >
            {hasAdminPartialError
              ? "读数失败"
              : status.adminInitialized
                ? "已完成"
                : "待完成"}
          </StatusBadge>
        }
        description={
          hasAdminPartialError
            ? "管理员初始化摘要暂时不可用，请结合局部失败提示确认失败对象。"
            : "确认后台访问入口是否已建立，避免把未初始化实例误当成正常可运营环境。"
        }
        icon={Users}
        title="首个管理员"
        value={
          hasAdminPartialError
            ? "读数失败"
            : status.adminInitialized
              ? "已初始化"
              : "未初始化"
        }
      />
      <ReadinessCard
        badge={
          <StatusBadge
            tone={
              hasReadinessPartialError
                ? "secondary"
                : status.gatewayReady
                  ? "success"
                  : "warning"
            }
          >
            {hasReadinessPartialError
              ? "读数受限"
              : status.gatewayReady
                ? "已就绪"
                : "未就绪"}
          </StatusBadge>
        }
        description={
          hasReadinessPartialError
            ? "部分 readiness 摘要读取失败，当前只保留已知信息，不把失败项直接判定为缺失。"
            : status.gatewayReady
              ? "Provider、调用方 Key 与管理员入口均满足统一出口的最小条件。"
              : `仍缺少 ${status.missingConditions.length} 项基础条件，需前往对应治理页补齐。`
        }
        icon={Shield}
        title="统一出口状态"
        value={
          hasReadinessPartialError
            ? "等待重新核查"
            : status.gatewayReady
              ? "基础条件通过"
              : "等待补齐条件"
        }
      />
    </section>
  );
}
