"use client";

import type {
  AdminInvitation,
  AdminMember,
  AdminSessionAttentionSummary,
} from "@/lib/api/users";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  formatTimestamp,
  getRiskSessionCountForMember,
  getVisibleUsersData,
  invitationStatusMeta,
  memberStatusMeta,
  rolePresetLabel,
  type UsersFilter,
  usersFilterOptions,
} from "@/components/users/users-utils";

type MemberListProps = {
  filter: UsersFilter;
  members: AdminMember[];
  invitations: AdminInvitation[];
  sessionsNeedingAttention: AdminSessionAttentionSummary[];
  selectedMemberId?: string;
  onFilterChange: (filter: UsersFilter) => void;
  onSelectMember: (memberId: string) => void;
};

function MemberMobileCard({
  member,
  selected,
  riskSessionCount,
  onSelect,
}: {
  member: AdminMember;
  selected: boolean;
  riskSessionCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "grid gap-3 rounded-lg border bg-surface p-4 text-left shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary/60 bg-primary/5",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{member.displayName}</p>
          <p className="text-xs text-muted-foreground">{member.identifier}</p>
        </div>
        <StatusBadge tone={memberStatusMeta[member.status].tone}>
          {memberStatusMeta[member.status].label}
        </StatusBadge>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">角色</p>
          <p className="mt-1 font-medium">{rolePresetLabel[member.rolePreset]}</p>
        </div>
        <div>
          <p className="text-muted-foreground">风险会话</p>
          <p className="mt-1 font-medium">{riskSessionCount}</p>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        最近活跃：{formatTimestamp(member.lastActiveAt)}
      </p>
    </button>
  );
}

function InvitationMobileCard({ invitation }: { invitation: AdminInvitation }) {
  const meta = invitationStatusMeta[invitation.status];

  return (
    <div className="grid gap-3 rounded-lg border bg-surface p-4 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{invitation.identifier}</p>
          <p className="text-xs text-muted-foreground">
            {rolePresetLabel[invitation.rolePreset]} · admin_console
          </p>
        </div>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        过期时间：{formatTimestamp(invitation.expiresAt)}
      </p>
    </div>
  );
}

export function MemberList({
  filter,
  members,
  invitations,
  sessionsNeedingAttention,
  selectedMemberId,
  onFilterChange,
  onSelectMember,
}: MemberListProps) {
  const visible = getVisibleUsersData(filter, members, invitations);
  const emptyMessage =
    filter === "pending"
      ? "当前没有待接受邀请。"
      : filter === "active"
        ? "当前没有活跃成员。"
        : "当前没有已暂停成员。";

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="users-member-list"
    >
      <CardHeader className="gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-base">成员与邀请</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Users 范围仅用于成员状态、邀请与基础会话治理，不在此页编辑策略。
          </p>
        </div>
        <Tabs
          onValueChange={(value) => onFilterChange(value as UsersFilter)}
          value={filter}
        >
          <TabsList
            className="h-auto w-full justify-start gap-1 overflow-x-auto p-1"
            data-testid="member-list-tabs"
          >
            {usersFilterOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {filter === "pending" ? (
          visible.invitations.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto rounded-lg border desktop:block">
                <Table className="min-w-[44rem]">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>邀请对象</TableHead>
                      <TableHead>默认角色</TableHead>
                      <TableHead>接入范围</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>过期时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.invitations.map((invitation) => {
                      const meta = invitationStatusMeta[invitation.status];

                      return (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{invitation.identifier}</p>
                              <p className="text-xs text-muted-foreground">
                                创建于 {formatTimestamp(invitation.createdAt)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{rolePresetLabel[invitation.rolePreset]}</TableCell>
                          <TableCell>admin_console</TableCell>
                          <TableCell>
                            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                          </TableCell>
                          <TableCell>{formatTimestamp(invitation.expiresAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 desktop:hidden">
                {visible.invitations.map((invitation) => (
                  <InvitationMobileCard
                    invitation={invitation}
                    key={invitation.id}
                  />
                ))}
              </div>
            </>
          ) : (
            <div
              className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
              data-testid="users-list-empty"
            >
              {emptyMessage}
            </div>
          )
        ) : visible.members.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto rounded-lg border desktop:block">
              <Table className="min-w-[54rem]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>最近活跃</TableHead>
                    <TableHead>风险会话</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.members.map((member) => {
                    const selected = member.id === selectedMemberId;
                    const riskSessionCount = getRiskSessionCountForMember(
                      sessionsNeedingAttention,
                      member.id,
                    );

                    return (
                      <TableRow
                        aria-selected={selected}
                        className={cn(
                          "cursor-pointer hover:bg-muted/40",
                          selected && "bg-primary/5",
                        )}
                        data-state={selected ? "selected" : undefined}
                        key={member.id}
                        onClick={() => onSelectMember(member.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectMember(member.id);
                          }
                        }}
                        tabIndex={0}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{member.displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.identifier}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={memberStatusMeta[member.status].tone}>
                            {memberStatusMeta[member.status].label}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{rolePresetLabel[member.rolePreset]}</TableCell>
                        <TableCell>{formatTimestamp(member.lastActiveAt)}</TableCell>
                        <TableCell>{riskSessionCount}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 desktop:hidden">
              {visible.members.map((member) => (
                <MemberMobileCard
                  key={member.id}
                  member={member}
                  onSelect={() => onSelectMember(member.id)}
                  riskSessionCount={getRiskSessionCountForMember(
                    sessionsNeedingAttention,
                    member.id,
                  )}
                  selected={member.id === selectedMemberId}
                />
              ))}
            </div>
          </>
        ) : (
          <div
            className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
            data-testid="users-list-empty"
          >
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
