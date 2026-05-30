import Link from "next/link";
import { ArrowRight, type LucideIcon, KeyRound, Server, Shield, Users } from "lucide-react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";

type RoutingCardProps = {
  title: string;
  description: string;
  detail: string;
  href?: string;
  actionLabel?: string;
  icon: LucideIcon;
  future?: boolean;
};

function RoutingCard({
  title,
  description,
  detail,
  href,
  actionLabel,
  icon: Icon,
  future = false,
}: RoutingCardProps) {
  return (
    <div
      className="rounded-lg border bg-muted/20 p-4"
      data-testid={`settings-routing-${title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-background text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </div>
        <StatusBadge tone={future ? "secondary" : "success"}>
          {future ? "后续版本" : "当前入口"}
        </StatusBadge>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
      {href && actionLabel ? (
        <Button asChild className="mt-4 w-full justify-between sm:w-auto" size="sm" variant="outline">
          <Link href={href}>
            {actionLabel}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export function ConfigRouting() {
  return (
    <div
      className="grid gap-4 desktop:grid-cols-2"
      data-testid="settings-config-routing-grid"
    >
      <RoutingCard
        actionLabel="前往服务商页"
        description="Provider 运行策略、凭据池、启停状态与最近异常不在本页编辑。"
        detail="请先进入服务商页，再从具体实例进入服务商详情完成深配置。"
        href="/providers"
        icon={Server}
        title="服务商详情"
      />
      <RoutingCard
        actionLabel="前往 API 密钥页"
        description="调用方 Key 的创建、轮换、停用与明文展示窗口由 API 密钥页承接。"
        detail="Settings 只确认当前是否存在可用 Key，不在此页展示生命周期操作。"
        href="/api-keys"
        icon={KeyRound}
        title="API 密钥"
      />
      <RoutingCard
        actionLabel="前往用户页"
        description="成员邀请、暂停 / 恢复与基础会话处置由用户页承接。"
        detail="当前页只说明后台访问治理边界，不提供成员编辑与风险处置操作。"
        href="/users"
        icon={Users}
        title="用户"
      />
      <RoutingCard
        description="复杂权限矩阵、审批护栏与细粒度访问策略仍属于后续能力。"
        detail="本页只保留 access-control 分流语义，不提前渲染成可编辑功能。"
        future
        icon={Shield}
        title="访问控制"
      />
    </div>
  );
}
