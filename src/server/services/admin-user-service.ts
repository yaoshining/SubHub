import { recordAdminActionResult } from "@/server/audit/action-results";
import {
  createAdminUserRepository,
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

export async function listAdminUsersOverview(
  options: AdminUserServiceOptions = {},
): Promise<AdminUsersOverview> {
  return getRepository(options.db).listOverview();
}

export async function suspendAdminUser(
  userId: string,
  options: AdminUserServiceOptions = {},
): Promise<AdminUser> {
  const user = await getRepository(options.db).suspendUser(
    userId,
    options.now,
  );

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

  return user;
}

export async function restoreAdminUser(
  userId: string,
  options: AdminUserServiceOptions = {},
): Promise<AdminUser> {
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

  return user;
}
