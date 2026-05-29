import { Shield, UserRound } from "lucide-react";

import type { AdminMember, AdminSessionAttentionSummary } from "@/lib/api/users";
import { StatusBadge } from "@/components/admin/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  formatTimestamp,
  getRiskSessionCountForMember,
  memberStatusMeta,
  rolePresetLabel,
} from "@/components/users/users-utils";

type MemberDetailProps = {
  member?: AdminMember;
  hiddenByFilter?: boolean;
  sessionsNeedingAttention: AdminSessionAttentionSummary[];
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <div className="text-sm leading-6">{value}</div>
    </div>
  );
}

export function MemberDetail({
  member,
  hiddenByFilter = false,
  sessionsNeedingAttention,
}: MemberDetailProps) {
  if (!member) {
    return (
      <Card
        className="border-border bg-surface shadow-none"
        data-testid="member-detail-no-selection"
      >
        <CardContent className="flex flex-col gap-3 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">未选择成员</p>
          <p>
            从左侧成员列表选择一个后台成员后，可查看其当前状态、最近活动与会话风险上下文。
          </p>
        </CardContent>
      </Card>
    );
  }

  const riskSessionCount = getRiskSessionCountForMember(
    sessionsNeedingAttention,
    member.id,
  );

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="member-detail"
    >
      <CardHeader className="gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{member.displayName}</CardTitle>
            <p className="text-sm text-muted-foreground">{member.identifier}</p>
          </div>
          <StatusBadge tone={memberStatusMeta[member.status].tone}>
            {memberStatusMeta[member.status].label}
          </StatusBadge>
        </div>

        {hiddenByFilter ? (
          <Alert variant="warning" data-testid="member-hidden-by-filter">
            <UserRound aria-hidden="true" className="size-4" />
            <AlertTitle>当前成员不在筛选结果中</AlertTitle>
            <AlertDescription>
              已保留当前查看对象，方便继续处理详情与风险动作；切换回对应筛选即可在列表中再次看到。
            </AlertDescription>
          </Alert>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <DetailRow
          label="预设角色"
          value={
            <span className="font-medium">{rolePresetLabel[member.rolePreset]}</span>
          }
        />
        <DetailRow label="最近 24h 活动" value={formatTimestamp(member.lastActiveAt)} />
        <DetailRow
          label="负责模块"
          value={
            <span className="text-muted-foreground">
              当前契约未提供模块归属；MVP 仅展示成员治理基础信息。
            </span>
          }
        />
        <DetailRow
          label="时区"
          value={
            <span className="text-muted-foreground">
              当前契约未提供时区信息，避免前端自行推断。
            </span>
          }
        />
        <Separator />
        <DetailRow
          label="风险会话"
          value={
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{riskSessionCount}</span>
              <span className="text-muted-foreground">个待处理对象</span>
            </div>
          }
        />
        <Alert variant={riskSessionCount > 0 ? "warning" : "success"}>
          <Shield aria-hidden="true" className="size-4" />
          <AlertTitle>
            {riskSessionCount > 0 ? "存在待处理会话" : "当前成员无异常会话"}
          </AlertTitle>
          <AlertDescription>
            {riskSessionCount > 0
              ? "请继续在下方会话区执行基础处置；本页不进入高级风控流程。"
              : "当前没有需要管理员立即处理的后台会话。"}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
