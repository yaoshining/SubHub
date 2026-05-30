import { AppError } from "@/lib/errors";
import { recordAdminActionResult } from "@/server/audit/action-results";
import { createAdminUserRepository } from "@/server/users/admin-user-repository";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";

export type AdminSessionRemediationAction = "revoke" | "mark_resolved";

export type AdminSessionRemediationInput = {
  action: AdminSessionRemediationAction;
  reason: string;
};

export type AdminSessionServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
  actorAdminUserId?: string | null;
};

export type AdminSessionRemediationResult = {
  sessionId: string;
  status: "revoked" | "remediated";
  action: AdminSessionRemediationAction;
};

const getRepository = (db?: StorageDatabase) =>
  createAdminUserRepository(db ?? getStorageClient().db);

export async function remediateAdminSession(
  sessionId: string,
  input: AdminSessionRemediationInput,
  options: AdminSessionServiceOptions = {},
): Promise<AdminSessionRemediationResult> {
  const reason = input.reason.trim();

  if (!reason) {
    throw new AppError("VALIDATION_FAILED", "会话处置原因不能为空。", "reason");
  }

  if (input.action !== "revoke" && input.action !== "mark_resolved") {
    throw new AppError(
      "VALIDATION_FAILED",
      "MVP 仅支持 revoke 或 mark_resolved 基础会话处置。",
      "action",
    );
  }

  const session = await getRepository(options.db).remediateSession(
    sessionId,
    input.action,
    options.actorAdminUserId ?? null,
    options.now,
  );

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "admin_session_remediated",
    targetType: "admin_session",
    targetId: session.id,
    result: "success",
    message: `后台会话已完成基础处置：${input.action} / ${reason}。`,
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return {
    sessionId: session.id,
    status: input.action === "revoke" ? "revoked" : "remediated",
    action: input.action,
  };
}
