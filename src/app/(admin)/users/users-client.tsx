"use client";

import * as React from "react";
import {
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import {
  createAdminInvitation,
  fetchAdminUsersOverview,
  remediateAdminSession,
  restoreAdminUser,
  suspendAdminUser,
  type AdminMember,
  type AdminSessionRemediationRequest,
  type AdminUsersOverview,
  type CreateAdminInvitationRequest,
} from "@/lib/api/users";
import {
  EmptyStateActionButton,
  EmptyStateCard,
} from "@/components/admin/empty-state-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { InvitationForm } from "@/components/users/invitation-form";
import { MemberDetail } from "@/components/users/member-detail";
import { MemberList } from "@/components/users/member-list";
import { MemberRiskActions } from "@/components/users/member-risk-actions";
import { MemberSummaryCards } from "@/components/users/member-summary-cards";
import { SessionRemediation } from "@/components/users/session-remediation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/errors";
import {
  getSelectedMemberHiddenByFilter,
  type UsersFilter,
} from "@/components/users/users-utils";

const emptyOverview: AdminUsersOverview = {
  members: [],
  invitations: [],
  sessionsNeedingAttention: [],
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }

  return "Users 页面加载失败，请稍后重试。";
};

function UsersSkeleton() {
  return (
    <div className="grid gap-6" role="status" aria-label="正在加载 Users 页面">
      <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="h-28 rounded-lg border bg-surface" key={item} />
        ))}
      </div>
      <div className="grid gap-6 desktop:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]">
        <div className="h-[34rem] rounded-lg border bg-surface" />
        <div className="h-[34rem] rounded-lg border bg-surface" />
      </div>
    </div>
  );
}

export function UsersClient() {
  const [overview, setOverview] =
    React.useState<AdminUsersOverview>(emptyOverview);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>();
  const [filter, setFilter] = React.useState<UsersFilter>("active");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = React.useState<string | null>(
    null,
  );
  const [success, setSuccess] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);

  const syncSelectedMember = React.useCallback(
    (members: AdminMember[], preferredMemberId?: string) => {
      setSelectedMemberId((current) => {
        const candidateIds = [preferredMemberId, current].filter(Boolean);
        const preserved = candidateIds.find((candidateId) =>
          members.some((member) => member.id === candidateId),
        );

        if (preserved) {
          return preserved;
        }

        return (
          members.find((member) => member.status === "active")?.id ??
          members[0]?.id
        );
      });
    },
    [],
  );

  const loadOverview = React.useCallback(
    async (preferredMemberId?: string) => {
      setLoading(true);
      setError(null);
      setPermissionDenied(null);

      try {
        const nextOverview = await fetchAdminUsersOverview();
        if (!mountedRef.current) {
          return;
        }

        setOverview(nextOverview);
        syncSelectedMember(nextOverview.members, preferredMemberId);
      } catch (loadError) {
        if (!mountedRef.current) {
          return;
        }

        if (loadError instanceof AppError && loadError.code === "FORBIDDEN") {
          setPermissionDenied(loadError.message);
          setOverview(emptyOverview);
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [syncSelectedMember],
  );

  React.useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadOverview();
      }
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [loadOverview]);

  const selectedMember = overview.members.find(
    (member) => member.id === selectedMemberId,
  );
  const selectedHiddenByFilter = getSelectedMemberHiddenByFilter(
    filter,
    selectedMember,
  );
  const hasAnyData =
    overview.members.length > 0 ||
    overview.invitations.length > 0 ||
    overview.sessionsNeedingAttention.length > 0;

  const handleInvitationSubmit = async (
    input: CreateAdminInvitationRequest,
  ) => {
    setSuccess(null);
    const invitation = await createAdminInvitation(input);
    if (!mountedRef.current) {
      return;
    }

    setOverview((current) => ({
      ...current,
      invitations: [
        invitation,
        ...current.invitations.filter((item) => item.id !== invitation.id),
      ],
    }));
    setFilter("pending");
    setSuccess(`${invitation.identifier} 已加入待接受邀请列表。`);
  };

  const handleMemberAction = async (
    member: AdminMember,
    action: "suspend" | "restore",
  ) => {
    setSuccess(null);
    const result =
      action === "suspend"
        ? await suspendAdminUser(member.id)
        : await restoreAdminUser(member.id);
    if (!mountedRef.current) {
      return;
    }

    setOverview((current) => ({
      ...current,
      members: current.members.map((item) =>
        item.id === result.id ? result : item,
      ),
      sessionsNeedingAttention:
        action === "suspend"
          ? current.sessionsNeedingAttention.filter(
              (session) => session.memberId !== member.id,
            )
          : current.sessionsNeedingAttention,
    }));
    setSelectedMemberId(result.id);
    setSuccess(
      action === "suspend"
        ? `${result.displayName} 已暂停，相关风险会话已从待处理列表移除。`
        : `${result.displayName} 已恢复后台访问状态。`,
    );
  };

  const handleSessionRemediation = async (
    sessionId: string,
    input: AdminSessionRemediationRequest,
  ) => {
    setSuccess(null);
    const result = await remediateAdminSession(sessionId, input);
    if (!mountedRef.current) {
      return;
    }

    setOverview((current) => ({
      ...current,
      sessionsNeedingAttention: current.sessionsNeedingAttention.filter(
        (session) => session.id !== result.sessionId,
      ),
    }));
    setSuccess(
      input.action === "revoke"
        ? "风险会话已撤销。"
        : "风险会话已标记为处理完成。",
    );
  };

  return (
    <div className="grid gap-6" data-testid="users-page">
      <div className="flex flex-col gap-3 rounded-lg border bg-surface p-4 desktop:flex-row desktop:items-center desktop:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={
                overview.sessionsNeedingAttention.length > 0
                  ? "warning"
                  : "success"
              }
            >
              {overview.sessionsNeedingAttention.length > 0
                ? "存在待处理会话"
                : "成员治理稳定"}
            </StatusBadge>
            <span className="text-sm text-muted-foreground">
              聚焦后台成员、邀请、暂停 / 恢复与基础会话处置。
            </span>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            严格排除权限矩阵、审批流、完整 RBAC、审计导出与高级风控能力。
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            aria-label="刷新 Users 页面"
            disabled={loading}
            onClick={() => void loadOverview(selectedMemberId)}
            size="icon"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
          <Button
            onClick={() =>
              document.getElementById("invitation-identifier")?.focus()
            }
            type="button"
          >
            <UserPlus aria-hidden="true" className="size-4" />
            发送邀请
          </Button>
        </div>
      </div>

      {success ? (
        <Alert variant="success" data-testid="users-success">
          <ShieldCheck aria-hidden="true" className="size-4" />
          <AlertTitle>操作成功</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{success}</span>
              <Button
                onClick={() => setSuccess(null)}
                size="sm"
                type="button"
                variant="outline"
              >
                知道了
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {permissionDenied ? (
        <Alert variant="warning" data-testid="users-permission">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>当前账号无权管理成员</AlertTitle>
          <AlertDescription>
            {permissionDenied}
            。仅管理员可以邀请、暂停、恢复或处置后台成员与会话；当前页面不展示可误触的治理入口。
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" data-testid="users-error">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>Users 信息不可用</AlertTitle>
          <AlertDescription>
            {error}。可重试刷新；失败对象会在当前页面上下文中保留。
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && !hasAnyData && !permissionDenied ? <UsersSkeleton /> : null}

      {!loading && !permissionDenied ? (
        <>
          <MemberSummaryCards
            invitations={overview.invitations}
            members={overview.members}
            sessionsNeedingAttention={overview.sessionsNeedingAttention}
          />

          {!hasAnyData ? (
            <EmptyStateCard
              action={
                <EmptyStateActionButton
                  onClick={() =>
                    document.getElementById("invitation-identifier")?.focus()
                  }
                >
                  发送首个邀请
                </EmptyStateActionButton>
              }
              description="当前还没有额外成员、待接受邀请或需要处置的风险会话。页面仍保留邀请与治理骨架，以支持后续扩容。"
              icon="users"
              title="Users 当前为空"
            />
          ) : null}

          <div
            className="grid min-w-0 gap-6 desktop:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]"
            data-testid="users-layout-grid"
          >
            <div
              className="grid min-w-0 gap-6"
              data-testid="users-primary-column"
            >
              <MemberList
                filter={filter}
                invitations={overview.invitations}
                members={overview.members}
                onFilterChange={setFilter}
                onSelectMember={setSelectedMemberId}
                selectedMemberId={selectedMemberId}
                sessionsNeedingAttention={overview.sessionsNeedingAttention}
              />
              <InvitationForm onSubmit={handleInvitationSubmit} />
            </div>

            <div
              className="grid min-w-0 gap-6"
              data-testid="users-secondary-column"
            >
              {selectedMember ? (
                <div
                  className="flex flex-col gap-2 rounded-lg border bg-surface p-4 md:hidden"
                  data-testid="users-mobile-selection-bar"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Users aria-hidden="true" className="size-4" />
                    当前选中：{selectedMember.displayName}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href="#member-risk-actions">前往风险动作</a>
                  </Button>
                </div>
              ) : null}

              <MemberDetail
                hiddenByFilter={selectedHiddenByFilter}
                member={selectedMember}
                sessionsNeedingAttention={overview.sessionsNeedingAttention}
              />
              <SessionRemediation
                onRemediate={handleSessionRemediation}
                selectedMember={selectedMember}
                sessions={overview.sessionsNeedingAttention}
              />
              <MemberRiskActions
                member={selectedMember}
                onAction={handleMemberAction}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
