import { randomBytes } from "node:crypto";

import { and, desc, eq, lte } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import { isUniqueConstraintError } from "@/server/storage/database-errors";
import {
  adminInvitations,
  adminSessions,
  adminUsers,
  type AdminInvitation,
  type AdminSession,
  type AdminUser,
  type NewAdminInvitation,
} from "@/server/storage/schema";

export type AdminMember = {
  id: string;
  identifier: string;
  displayName: string;
  status: AdminUser["status"];
  rolePreset: AdminUser["role"];
  lastActiveAt: string | null;
};

export type AdminInvitationSummary = Pick<
  AdminInvitation,
  | "id"
  | "identifier"
  | "status"
  | "rolePreset"
  | "accessPreset"
  | "expiresAt"
  | "createdAt"
  | "updatedAt"
>;

export type AdminSessionAttentionSummary = {
  id: string;
  memberId: string;
  status: "needs_attention";
  reason: string | null;
  lastSeenAt: string | null;
  deviceLabel: string | null;
};

export type AdminUsersOverview = {
  members: AdminMember[];
  invitations: AdminInvitationSummary[];
  sessionsNeedingAttention: AdminSessionAttentionSummary[];
};

export type CreateInvitationInput = Pick<
  AdminInvitation,
  "identifier" | "rolePreset" | "accessPreset" | "invitedByAdminUserId"
> & {
  now: Date;
};

const invitationTtlMs = 7 * 24 * 60 * 60 * 1000;

const createInvitationId = () =>
  `invite_${randomBytes(16).toString("base64url")}`;

const toMember = (user: AdminUser): AdminMember => ({
  id: user.id,
  identifier: user.identifier,
  displayName: user.displayName,
  status: user.status,
  rolePreset: user.role,
  lastActiveAt: user.lastLoginAt,
});

export const toAdminInvitationSummary = (
  invitation: AdminInvitation,
): AdminInvitationSummary => ({
  id: invitation.id,
  identifier: invitation.identifier,
  status: invitation.status,
  rolePreset: invitation.rolePreset,
  accessPreset: invitation.accessPreset,
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
  updatedAt: invitation.updatedAt,
});

const toSessionAttentionSummary = (
  session: AdminSession,
): AdminSessionAttentionSummary => ({
  id: session.id,
  memberId: session.adminUserId,
  status: "needs_attention",
  reason: session.attentionReason,
  lastSeenAt: session.lastSeenAt,
  deviceLabel: session.deviceLabel,
});

export class AdminUserRepository {
  constructor(private readonly db = getStorageClient().db) {}

  async listOverview(): Promise<AdminUsersOverview> {
    const [members, invitations, sessionsNeedingAttention] = await Promise.all([
      this.db
        .select()
        .from(adminUsers)
        .orderBy(desc(adminUsers.updatedAt))
        .then((rows: AdminUser[]) => rows.map(toMember)),
      this.db
        .select()
        .from(adminInvitations)
        .orderBy(desc(adminInvitations.createdAt))
        .then((rows: AdminInvitation[]) => rows.map(toAdminInvitationSummary)),
      this.db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.status, "needs_attention"))
        .orderBy(desc(adminSessions.lastSeenAt))
        .then((rows: AdminSession[]) => rows.map(toSessionAttentionSummary)),
    ]);

    return { members, invitations, sessionsNeedingAttention };
  }

  async requireAdminUser(userId: string): Promise<AdminUser> {
    const [adminUser] = await this.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, userId))
      .limit(1);

    if (!adminUser) {
      throw new AppError("VALIDATION_FAILED", "后台成员不存在。", "userId");
    }

    return adminUser;
  }

  async requireAdminSession(sessionId: string): Promise<AdminSession> {
    const [session] = await this.db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new AppError("VALIDATION_FAILED", "后台会话不存在。", "sessionId");
    }

    return session;
  }

  async createInvitation(input: CreateInvitationInput) {
    const nowIso = input.now.toISOString();
    const expiresAt = new Date(
      input.now.getTime() + invitationTtlMs,
    ).toISOString();

    let invitation: AdminInvitation | undefined;
    try {
      invitation = await this.db.transaction(async (tx: StorageDatabase) => {
        await tx
          .update(adminInvitations)
          .set({ status: "expired", updatedAt: nowIso })
          .where(
            and(
              eq(adminInvitations.status, "pending"),
              lte(adminInvitations.expiresAt, nowIso),
            ),
          );

        const [existingPending] = await tx
          .select()
          .from(adminInvitations)
          .where(
            and(
              eq(adminInvitations.identifier, input.identifier),
              eq(adminInvitations.status, "pending"),
            ),
          )
          .limit(1);

        if (existingPending) {
          throw new AppError(
            "VALIDATION_FAILED",
            "该成员标识已存在待接受邀请。",
            "identifier",
          );
        }

        const [created] = await tx
          .insert(adminInvitations)
          .values({
            id: createInvitationId(),
            identifier: input.identifier,
            status: "pending",
            rolePreset: input.rolePreset,
            accessPreset: input.accessPreset,
            invitedByAdminUserId: input.invitedByAdminUserId,
            acceptedAdminUserId: null,
            expiresAt,
            acceptedAt: null,
            revokedAt: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          } satisfies NewAdminInvitation)
          .returning();

        return created;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "该成员标识已存在待接受邀请。",
          "identifier",
        );
      }
      throw error;
    }

    if (!invitation) {
      throw new AppError("UPSTREAM_FAILED", "创建成员邀请失败。");
    }

    return toAdminInvitationSummary(invitation);
  }

  async revokeInvitation(invitationId: string, now = new Date()) {
    const revokedAt = now.toISOString();
    const [invitation] = await this.db
      .update(adminInvitations)
      .set({
        status: "revoked",
        revokedAt,
        updatedAt: revokedAt,
      })
      .where(
        and(
          eq(adminInvitations.id, invitationId),
          eq(adminInvitations.status, "pending"),
        ),
      )
      .returning();

    if (!invitation) {
      throw new AppError(
        "VALIDATION_FAILED",
        "只能撤销待接受邀请。",
        "invitationId",
      );
    }

    return toAdminInvitationSummary(invitation);
  }

  async suspendUser(userId: string, now = new Date()) {
    await this.requireAdminUser(userId);
    const updatedAt = now.toISOString();

    const user = await this.db.transaction(async (tx: StorageDatabase) => {
      const [updated] = await tx
        .update(adminUsers)
        .set({ status: "suspended", updatedAt })
        .where(eq(adminUsers.id, userId))
        .returning();

      await tx
        .update(adminSessions)
        .set({ status: "revoked" })
        .where(
          and(
            eq(adminSessions.adminUserId, userId),
            eq(adminSessions.status, "active"),
          ),
        );

      await tx
        .update(adminSessions)
        .set({ status: "revoked" })
        .where(
          and(
            eq(adminSessions.adminUserId, userId),
            eq(adminSessions.status, "needs_attention"),
          ),
        );

      return updated;
    });

    if (!user) {
      throw new AppError("VALIDATION_FAILED", "后台成员不存在。", "userId");
    }

    return user;
  }

  async restoreUser(userId: string, now = new Date()) {
    await this.requireAdminUser(userId);
    const updatedAt = now.toISOString();
    const [user] = await this.db
      .update(adminUsers)
      .set({ status: "active", updatedAt })
      .where(eq(adminUsers.id, userId))
      .returning();

    if (!user) {
      throw new AppError("VALIDATION_FAILED", "后台成员不存在。", "userId");
    }

    return user;
  }

  async remediateSession(
    sessionId: string,
    action: "revoke" | "mark_resolved",
    remediatedByAdminUserId: string | null,
    now = new Date(),
  ) {
    const current = await this.requireAdminSession(sessionId);

    if (current.status !== "needs_attention") {
      throw new AppError(
        "FORBIDDEN",
        "仅需要关注的后台会话允许执行基础处置。",
        "sessionId",
      );
    }

    const nextStatus = action === "revoke" ? "revoked" : "remediated";
    const remediatedAt = now.toISOString();
    const [session] = await this.db
      .update(adminSessions)
      .set({
        status: nextStatus,
        remediatedAt,
        remediatedByAdminUserId,
      })
      .where(
        and(
          eq(adminSessions.id, sessionId),
          eq(adminSessions.status, "needs_attention"),
        ),
      )
      .returning();

    if (!session) {
      throw new AppError(
        "VALIDATION_FAILED",
        "后台会话处置失败。",
        "sessionId",
      );
    }

    return session;
  }
}

export const createAdminUserRepository = (db?: StorageDatabase) =>
  new AdminUserRepository(db ?? getStorageClient().db);
