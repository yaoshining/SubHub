import { AppError } from "@/lib/errors";
import { recordAdminActionResult } from "@/server/audit/action-results";
import { normalizeAdminIdentifier } from "@/server/services/bootstrap-service";
import {
  createAdminUserRepository,
  type AdminInvitationSummary,
} from "@/server/users/admin-user-repository";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import type { AdminInvitation } from "@/server/storage/schema";

export type CreateAdminInvitationInput = Pick<
  AdminInvitation,
  "identifier" | "rolePreset" | "accessPreset"
>;

export type AdminInvitationServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
  actorAdminUserId?: string | null;
};

const allowedRolePresets = new Set(["admin", "operator"]);
const allowedAccessPresets = new Set(["admin_console"]);

const getRepository = (db?: StorageDatabase) =>
  createAdminUserRepository(db ?? getStorageClient().db);

const validateInvitationInput = (input: CreateAdminInvitationInput) => {
  const identifier = normalizeAdminIdentifier(input.identifier);

  if (!identifier) {
    throw new AppError(
      "VALIDATION_FAILED",
      "被邀请成员标识不能为空。",
      "identifier",
    );
  }

  if (!allowedRolePresets.has(input.rolePreset)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "MVP 仅支持 admin 或 operator 预设角色。",
      "rolePreset",
    );
  }

  if (!allowedAccessPresets.has(input.accessPreset)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "MVP 仅支持 admin_console 接入范围。",
      "accessPreset",
    );
  }

  return {
    identifier,
    rolePreset: input.rolePreset,
    accessPreset: input.accessPreset,
  };
};

export async function createAdminInvitation(
  input: CreateAdminInvitationInput,
  options: AdminInvitationServiceOptions = {},
): Promise<AdminInvitation> {
  const actorAdminUserId = options.actorAdminUserId ?? null;

  if (!actorAdminUserId) {
    throw new AppError("FORBIDDEN", "缺少邀请创建管理员上下文。", "admin_user");
  }

  const validated = validateInvitationInput(input);
  const invitation = await getRepository(options.db).createInvitation({
    ...validated,
    invitedByAdminUserId: actorAdminUserId,
    now: options.now ?? new Date(),
  });

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId,
    actionType: "admin_invitation_created",
    targetType: "admin_invitation",
    targetId: invitation.id,
    result: "success",
    message: `成员邀请已创建：${invitation.identifier}。`,
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return invitation;
}

export async function revokeAdminInvitation(
  invitationId: string,
  options: AdminInvitationServiceOptions = {},
): Promise<AdminInvitationSummary> {
  const invitation = await getRepository(options.db).revokeInvitation(
    invitationId,
    options.now,
  );

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "admin_invitation_revoked",
    targetType: "admin_invitation",
    targetId: invitation.id,
    result: "success",
    message: `成员邀请已撤销：${invitation.identifier}。`,
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return invitation;
}
