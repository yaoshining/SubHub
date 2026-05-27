import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { recordAdminActionResult } from "@/server/audit/action-results";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import { adminUsers, type AdminUser } from "@/server/storage/schema";

export type BootstrapStatus = {
  initialized: boolean;
};

export type CreateInitialAdminInput = {
  identifier: string;
  displayName: string;
  password: string;
};

export type CreateInitialAdminResult = {
  adminUserId: string;
  status: AdminUser["status"];
};

export type BootstrapServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
};

const createAdminUserId = () =>
  `admin_${randomBytes(16).toString("base64url")}`;

export const normalizeAdminIdentifier = (identifier: string) =>
  identifier.trim().toLowerCase();

export async function getBootstrapStatus({
  db = getStorageClient().db,
}: BootstrapServiceOptions = {}): Promise<BootstrapStatus> {
  const [adminUser] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .limit(1);

  return { initialized: Boolean(adminUser) };
}

export async function createInitialAdmin(
  input: CreateInitialAdminInput,
  {
    db = getStorageClient().db,
    now = new Date(),
  }: BootstrapServiceOptions = {},
): Promise<CreateInitialAdminResult> {
  const existingStatus = await getBootstrapStatus({ db });

  if (existingStatus.initialized) {
    await recordAdminActionResult({
      db,
      actionType: "bootstrap_admin_created",
      targetType: "bootstrap",
      result: "failed",
      message: "系统已完成首轮管理员初始化。",
      createdAt: now.toISOString(),
    });
    throw new AppError(
      "FORBIDDEN",
      "系统已完成首轮管理员初始化。",
      "bootstrap",
    );
  }

  const identifier = normalizeAdminIdentifier(input.identifier);
  const displayName = input.displayName.trim();

  if (!identifier) {
    throw new AppError(
      "VALIDATION_FAILED",
      "管理员标识不能为空。",
      "identifier",
    );
  }

  if (!displayName) {
    throw new AppError(
      "VALIDATION_FAILED",
      "显示名称不能为空。",
      "displayName",
    );
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(input.password);
  } catch (error) {
    throw new AppError(
      "VALIDATION_FAILED",
      error instanceof Error ? error.message : "密码强度不符合要求。",
      "password",
    );
  }

  const createdAt = now.toISOString();
  const [adminUser] = await db
    .insert(adminUsers)
    .values({
      id: createAdminUserId(),
      identifier,
      displayName,
      passwordHash,
      status: "active",
      role: "admin",
      createdAt,
      updatedAt: createdAt,
    })
    .returning();

  await recordAdminActionResult({
    db,
    actorAdminUserId: adminUser.id,
    actionType: "bootstrap_admin_created",
    targetType: "bootstrap",
    targetId: adminUser.id,
    result: "success",
    message: "首个管理员已创建。",
    createdAt,
  });

  const [createdAdminUser] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, adminUser.id))
    .limit(1);

  return {
    adminUserId: createdAdminUser?.id ?? adminUser.id,
    status: createdAdminUser?.status ?? "active",
  };
}
