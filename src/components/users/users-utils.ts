import type {
  AdminInvitation,
  AdminInvitationStatus,
  AdminMember,
  AdminRolePreset,
  AdminSessionAttentionSummary,
  AdminUserStatus,
} from "@/lib/api/users";

export type UsersFilter = "active" | "pending" | "suspended";

export const usersFilterOptions: { value: UsersFilter; label: string }[] = [
  { value: "active", label: "活跃成员" },
  { value: "pending", label: "待接受邀请" },
  { value: "suspended", label: "已暂停成员" },
];

export const rolePresetLabel: Record<AdminRolePreset, string> = {
  admin: "管理员",
  operator: "值守操作员",
};

export const memberStatusMeta: Record<
  AdminUserStatus,
  { label: string; tone: "success" | "destructive" }
> = {
  active: {
    label: "活跃",
    tone: "success",
  },
  suspended: {
    label: "已暂停",
    tone: "destructive",
  },
};

export const invitationStatusMeta: Record<
  AdminInvitationStatus,
  {
    label: string;
    tone: "success" | "warning" | "destructive" | "secondary";
  }
> = {
  pending: {
    label: "待接受",
    tone: "warning",
  },
  accepted: {
    label: "已接受",
    tone: "success",
  },
  expired: {
    label: "已过期",
    tone: "secondary",
  },
  revoked: {
    label: "已撤销",
    tone: "destructive",
  },
};

export function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "暂无记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "时间无效";
  }

  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function getOperatorCoverageCount(members: AdminMember[]) {
  const threshold = Date.now() - 24 * 60 * 60 * 1000;

  return members.filter((member) => {
    if (member.status !== "active" || !member.lastActiveAt) {
      return false;
    }

    const lastActiveTime = new Date(member.lastActiveAt).getTime();
    return !Number.isNaN(lastActiveTime) && lastActiveTime >= threshold;
  }).length;
}

export function getRiskSessionCountForMember(
  sessions: AdminSessionAttentionSummary[],
  memberId: string,
) {
  return sessions.filter((session) => session.memberId === memberId).length;
}

export function getVisibleUsersData(
  filter: UsersFilter,
  members: AdminMember[],
  invitations: AdminInvitation[],
) {
  if (filter === "pending") {
    return {
      members: [] as AdminMember[],
      invitations: invitations.filter(
        (invitation) => invitation.status === "pending",
      ),
    };
  }

  return {
    members: members.filter((member) => member.status === filter),
    invitations: [] as AdminInvitation[],
  };
}

export function getSelectedMemberHiddenByFilter(
  filter: UsersFilter,
  member: AdminMember | undefined,
) {
  if (!member) {
    return false;
  }

  if (filter === "pending") {
    return true;
  }

  return member.status !== filter;
}

export function getSessionReasonLabel(reason: string | null) {
  if (!reason) {
    return "待管理员复核";
  }

  return reason
    .split("_")
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}
