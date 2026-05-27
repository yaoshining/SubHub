import { eq } from "drizzle-orm";

import {
  adminSessionCookieName,
  createAdminSession,
  revokeAdminSession,
  type AdminSessionWithUser,
} from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { recordAdminActionResult } from "@/server/audit/action-results";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import { adminUsers, type AdminUser } from "@/server/storage/schema";
import { normalizeAdminIdentifier } from "./bootstrap-service";

export { adminSessionCookieName };

export type AdminPrincipal = Pick<
  AdminUser,
  "id" | "identifier" | "displayName" | "role"
>;

export type LoginInput = {
  identifier: string;
  password: string;
  deviceLabel?: string | null;
};

export type LoginResult = {
  admin: AdminPrincipal;
  session: {
    token: string;
    expiresAt: string;
  };
};

export type AuthServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
};

const dummyPasswordHash =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const toAdminPrincipal = (adminUser: AdminUser): AdminPrincipal => ({
  id: adminUser.id,
  identifier: adminUser.identifier,
  displayName: adminUser.displayName,
  role: adminUser.role,
});

export const toCurrentAdmin = (session: AdminSessionWithUser) =>
  toAdminPrincipal(session.adminUser);

export async function loginAdmin(
  input: LoginInput,
  { db = getStorageClient().db, now = new Date() }: AuthServiceOptions = {},
): Promise<LoginResult> {
  const identifier = normalizeAdminIdentifier(input.identifier);
  const [adminUser] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.identifier, identifier))
    .limit(1);

  const passwordValid = await verifyPassword(
    input.password,
    adminUser?.passwordHash ?? dummyPasswordHash,
  );

  if (!adminUser || !passwordValid) {
    await recordAdminActionResult({
      db,
      actionType: "admin_login",
      targetType: "auth",
      result: "failed",
      message: "管理员登录失败：凭据无效。",
      createdAt: now.toISOString(),
    });
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "管理员标识或密码不正确。",
      "credentials",
    );
  }

  if (adminUser.status !== "active") {
    await recordAdminActionResult({
      db,
      actorAdminUserId: adminUser.id,
      actionType: "admin_login",
      targetType: "auth",
      targetId: adminUser.id,
      result: "failed",
      message: "管理员登录失败：账号已暂停。",
      createdAt: now.toISOString(),
    });
    throw new AppError("FORBIDDEN", "管理员账号已被暂停。", "admin_user");
  }

  const lastLoginAt = now.toISOString();
  await db
    .update(adminUsers)
    .set({ lastLoginAt, updatedAt: lastLoginAt })
    .where(eq(adminUsers.id, adminUser.id));

  const { token, session } = await createAdminSession({
    adminUserId: adminUser.id,
    deviceLabel: input.deviceLabel ?? null,
    now,
    db,
  });

  await recordAdminActionResult({
    db,
    actorAdminUserId: adminUser.id,
    actionType: "admin_login",
    targetType: "auth",
    targetId: adminUser.id,
    result: "success",
    message: "管理员登录成功。",
    createdAt: lastLoginAt,
  });

  return {
    admin: toAdminPrincipal({
      ...adminUser,
      lastLoginAt,
      updatedAt: lastLoginAt,
    }),
    session: {
      token,
      expiresAt: session.expiresAt,
    },
  };
}

export async function logoutAdmin(
  token: string,
  { db = getStorageClient().db }: AuthServiceOptions = {},
) {
  return revokeAdminSession(token, db);
}
