import { createHmac, randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { readEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import {
  adminSessions,
  adminUsers,
  type AdminSession,
  type AdminUser,
} from "@/server/storage/schema";

export const adminSessionCookieName = "subhub_admin_session";
export const defaultAdminSessionTtlSeconds = 60 * 60 * 8;

export type AdminSessionWithUser = AdminSession & {
  adminUser: AdminUser;
};

export type AdminSessionAccessDecision = {
  allowed: boolean;
  error?: AppError;
};

export type CreateAdminSessionInput = {
  adminUserId: string;
  deviceLabel?: string | null;
  now?: Date;
  ttlSeconds?: number;
  db?: StorageDatabase;
};

export type AdminSessionLookupOptions = {
  now?: Date;
  touchLastSeen?: boolean;
  db?: StorageDatabase;
};

const nonProductionSessionSecret =
  "development-admin-session-secret-not-for-production";

const getAdminSessionSecret = () => {
  const env = readEnv();
  return env.ADMIN_SESSION_SECRET ?? nonProductionSessionSecret;
};

const createSessionId = () =>
  `session_${randomBytes(16).toString("base64url")}`;

export const generateAdminSessionToken = () =>
  `subhub_admin_${randomBytes(32).toString("base64url")}`;

export const hashAdminSessionToken = (token: string) =>
  createHmac("sha256", getAdminSessionSecret())
    .update(token)
    .digest("base64url");

const isPast = (value: string, now: Date) =>
  new Date(value).getTime() <= now.getTime();

export async function createAdminSession({
  adminUserId,
  deviceLabel = null,
  now = new Date(),
  ttlSeconds = defaultAdminSessionTtlSeconds,
  db = getStorageClient().db,
}: CreateAdminSessionInput) {
  const token = generateAdminSessionToken();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  const [session] = await db
    .insert(adminSessions)
    .values({
      id: createSessionId(),
      adminUserId,
      sessionTokenHash: hashAdminSessionToken(token),
      status: "active",
      createdAt,
      expiresAt,
      lastSeenAt: createdAt,
      deviceLabel,
    })
    .returning();

  return { token, session };
}

export async function getAdminSessionByToken(
  token: string,
  {
    now = new Date(),
    touchLastSeen = false,
    db = getStorageClient().db,
  }: AdminSessionLookupOptions = {},
): Promise<AdminSessionWithUser | null> {
  const [row] = await db
    .select({ session: adminSessions, adminUser: adminUsers })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
    .where(eq(adminSessions.sessionTokenHash, hashAdminSessionToken(token)))
    .limit(1);

  if (!row) {
    return null;
  }

  if (isPast(row.session.expiresAt, now) && row.session.status !== "expired") {
    await db
      .update(adminSessions)
      .set({ status: "expired" })
      .where(eq(adminSessions.id, row.session.id));
    row.session.status = "expired";
  }

  if (touchLastSeen && row.session.status === "active") {
    const lastSeenAt = now.toISOString();
    await db
      .update(adminSessions)
      .set({ lastSeenAt })
      .where(eq(adminSessions.id, row.session.id));
    row.session.lastSeenAt = lastSeenAt;
  }

  return { ...row.session, adminUser: row.adminUser };
}

export function evaluateAdminSessionAccess(
  session: AdminSessionWithUser | null,
  options: { requireHighRiskClearance?: boolean; now?: Date } = {},
): AdminSessionAccessDecision {
  const now = options.now ?? new Date();

  if (!session) {
    return {
      allowed: false,
      error: new AppError(
        "AUTHENTICATION_REQUIRED",
        "需要管理员会话后才能访问。",
        "admin_session",
      ),
    };
  }

  if (session.adminUser.status !== "active") {
    return {
      allowed: false,
      error: new AppError("FORBIDDEN", "管理员账号已被暂停。", "admin_user"),
    };
  }

  if (isPast(session.expiresAt, now) || session.status === "expired") {
    return {
      allowed: false,
      error: new AppError(
        "AUTHENTICATION_REQUIRED",
        "管理员会话已过期。",
        "admin_session",
      ),
    };
  }

  if (session.status === "revoked") {
    return {
      allowed: false,
      error: new AppError(
        "AUTHENTICATION_REQUIRED",
        "管理员会话已撤销。",
        "admin_session",
      ),
    };
  }

  if (session.status === "needs_attention") {
    return {
      allowed: false,
      error: new AppError(
        "FORBIDDEN",
        options.requireHighRiskClearance
          ? "该会话需要先完成基础处置，不能执行高风险管理动作。"
          : "该会话需要先完成基础处置。",
        "admin_session",
      ),
    };
  }

  if (session.status === "remediated") {
    return {
      allowed: false,
      error: new AppError(
        "AUTHENTICATION_REQUIRED",
        "该会话已完成处置，需要重新登录。",
        "admin_session",
      ),
    };
  }

  return { allowed: true };
}

export async function requireActiveAdminSession(
  token: string | undefined,
  options: AdminSessionLookupOptions & {
    requireHighRiskClearance?: boolean;
  } = {},
): Promise<AdminSessionWithUser> {
  const session = token ? await getAdminSessionByToken(token, options) : null;
  const decision = evaluateAdminSessionAccess(session, options);

  if (!decision.allowed) {
    throw decision.error;
  }

  if (!session) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "需要管理员会话后才能访问。",
      "admin_session",
    );
  }

  return session;
}

export async function revokeAdminSession(
  token: string,
  db: StorageDatabase = getStorageClient().db,
) {
  const [session] = await db
    .update(adminSessions)
    .set({ status: "revoked" })
    .where(
      and(
        eq(adminSessions.sessionTokenHash, hashAdminSessionToken(token)),
        eq(adminSessions.status, "active"),
      ),
    )
    .returning();

  return session ?? null;
}
