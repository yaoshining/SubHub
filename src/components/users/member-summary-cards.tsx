import type {
  AdminInvitation,
  AdminMember,
  AdminSessionAttentionSummary,
} from "@/lib/api/users";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOperatorCoverageCount } from "@/components/users/users-utils";

type MemberSummaryCardsProps = {
  members: AdminMember[];
  invitations: AdminInvitation[];
  sessionsNeedingAttention: AdminSessionAttentionSummary[];
};

function SummaryCard({
  title,
  value,
  description,
  status,
}: {
  title: string;
  value: string | number;
  description: string;
  status?: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4">
        <div className="space-y-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        {status}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function MemberSummaryCards({
  members,
  invitations,
  sessionsNeedingAttention,
}: MemberSummaryCardsProps) {
  const activeCount = members.filter((member) => member.status === "active").length;
  const pendingInvitationCount = invitations.filter(
    (invitation) => invitation.status === "pending",
  ).length;
  const operatorCoverageCount = getOperatorCoverageCount(members);
  const riskSessionCount = sessionsNeedingAttention.length;

  return (
    <section
      aria-label="成员摘要"
      className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4"
    >
      <SummaryCard
        title="活跃成员"
        value={activeCount}
        description="当前仍可登录后台并执行受保护管理动作的成员数量。"
      />
      <SummaryCard
        title="待接受邀请"
        value={pendingInvitationCount}
        description="等待成员接受的后台邀请；未混同为活跃成员。"
        status={
          pendingInvitationCount > 0 ? (
            <StatusBadge tone="warning">需要跟进</StatusBadge>
          ) : (
            <StatusBadge tone="secondary">暂无堆积</StatusBadge>
          )
        }
      />
      <SummaryCard
        title="Operator coverage"
        value={operatorCoverageCount}
        description="按最近 24 小时有活动且未暂停的成员近似展示值守覆盖信号。"
        status={
          operatorCoverageCount > 0 ? (
            <StatusBadge tone="success">有人值守</StatusBadge>
          ) : (
            <StatusBadge tone="warning">覆盖偏低</StatusBadge>
          )
        }
      />
      <SummaryCard
        title="Risk sessions"
        value={riskSessionCount}
        description="需要管理员立即复核并执行基础会话处置的后台会话。"
        status={
          riskSessionCount > 0 ? (
            <StatusBadge tone="destructive">需要处理</StatusBadge>
          ) : (
            <StatusBadge tone="success">当前安全</StatusBadge>
          )
        }
      />
    </section>
  );
}
