import { recordAdminActionResult } from "@/server/audit/action-results";
import { AppError } from "@/lib/errors";
import {
  createAdminUserRepository,
  type AdminMember,
  type AdminUsersOverview,
} from "@/server/users/admin-user-repository";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import type { AdminUser } from "@/server/storage/schema";

export type AdminUserServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
  actorAdminUserId?: string | null;
};

const getRepository = (db?: StorageDatabase) =>
  createAdminUserRepository(db ?? getStorageClient().db);

export type AdminUserActionResult = AdminMember & {
  updatedAt: string;
};

const toActionResult = (user: AdminUser): AdminUserActionResult => ({
  id: user.id,
  identifier: user.identifier,
  displayName: user.displayName,
  status: user.status,
  rolePreset: user.role,
  lastActiveAt: user.lastLoginAt,
  updatedAt: user.updatedAt,
});

export async function listAdminUsersOverview(
  options: AdminUserServiceOptions = {},
): Promise<AdminUsersOverview> {
  return getRepository(options.db).listOverview();
}

export async function suspendAdminUser(
  userId: string,
  options: AdminUserServiceOptions = {},
): Promise<AdminUserActionResult> {
  const repository = getRepository(options.db);
  const targetUser = await repository.requireAdminUser(userId);
  const overview = await repository.listOverview();
  const activeAdminCount = overview.members.filter(
    (member) => member.rolePreset === "admin" && member.status === "active",
  ).length;

  if (
    targetUser.role === "admin" &&
    targetUser.status === "active" &&
    activeAdminCount <= 1
  ) {
    throw new AppError("FORBIDDEN", "最后一个 active admin 不可被暂停。", "userId");
  }

  if (options.actorAdminUserId && options.actorAdminUserId === userId) {
    throw new AppError("FORBIDDEN", "当前登录管理员不能暂停自己。", "userId");
  }

  const user = await repository.suspendUser(userId, options.now);

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "admin_user_suspended",
    targetType: "admin_user",
    targetId: userId,
    result: "success",
    message: "后台成员已暂停，其现有后台会话已撤销。",
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return toActionResult(user);
}

export async function restoreAdminUser(
  userId: string,
  options: AdminUserServiceOptions = {},
): Promise<AdminUserActionResult> {
  const user = await getRepository(options.db).restoreUser(userId, options.now);

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "admin_user_restored",
    targetType: "admin_user",
    targetId: userId,
    result: "success",
    message: "后台成员已恢复为 active。",
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return toActionResult(user);
}
