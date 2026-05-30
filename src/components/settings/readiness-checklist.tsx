import {
  type LucideIcon,
  KeyRound,
  Server,
  Shield,
  Users,
} from "lucide-react";

import type { SettingsStatus } from "@/lib/api/settings";
import { StatusBadge } from "@/components/admin/status-badge";

type ChecklistItemProps = {
  title: string;
  description: string;
  summary: string;
  ready: boolean;
  icon: LucideIcon;
};

function ChecklistItem({
  title,
  description,
  summary,
  ready,
  icon: Icon,
}: ChecklistItemProps) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-background text-primary">
            <Icon aria-hidden="true" className="size-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <StatusBadge tone={ready ? "success" : "warning"}>
          {ready ? "通过" : "待补齐"}
        </StatusBadge>
      </div>
      <p className="mt-4 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
        {summary}
      </p>
    </div>
  );
}

export function ReadinessChecklist({ status }: { status: SettingsStatus }) {
  return (
    <div className="grid gap-4" data-testid="settings-readiness-checklist">
      <ChecklistItem
        description="必须至少存在一个启用中的 Provider 且拥有活跃凭据。"
        icon={Server}
        ready={status.activeProviderCount > 0}
        summary={
          status.activeProviderCount > 0
            ? `当前已有 ${status.activeProviderCount} 个可用 Provider 参与统一出口。`
            : "尚未检测到可用 Provider，请前往服务商页补齐。"
        }
        title="Provider 可用性"
      />
      <ChecklistItem
        description="调用方 Key 用于下游应用访问统一字幕出口。"
        icon={KeyRound}
        ready={status.activeCallerKeyCount > 0}
        summary={
          status.activeCallerKeyCount > 0
            ? `当前已有 ${status.activeCallerKeyCount} 个活跃调用方 Key 可用。`
            : "尚未检测到活跃调用方 Key，请前往 API 密钥页创建。"
        }
        title="调用方 Key"
      />
      <ChecklistItem
        description="后台必须存在可用管理员入口，才能继续承接治理动作。"
        icon={Users}
        ready={status.adminInitialized}
        summary={
          status.adminInitialized
            ? "首个管理员已初始化，可继续访问后台治理页面。"
            : "尚未完成管理员初始化，请先完成首轮开通。"
        }
        title="管理员认证"
      />
      <ChecklistItem
        description="统一出口就绪度取决于管理员、Provider 与调用方 Key 是否同时满足基础条件。"
        icon={Shield}
        ready={status.gatewayReady}
        summary={
          status.gatewayReady
            ? "统一出口已具备最小服务条件，可继续通过其他治理页维护细节。"
            : `当前仍缺少：${status.missingConditions
                .map((condition) =>
                  condition === "provider"
                    ? "可用 Provider"
                    : condition === "caller_key"
                      ? "调用方 Key"
                      : "首个管理员",
                )
                .join("、")} 。`
        }
        title="统一出口"
      />
    </div>
  );
}
