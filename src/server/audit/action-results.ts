import { randomBytes } from "node:crypto";

import {
  adminActionResults,
  type NewAdminActionResult,
} from "@/server/storage/schema";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";

export type AdminActionResultInput = Pick<
  NewAdminActionResult,
  "actionType" | "targetType" | "result"
> & {
  actorAdminUserId?: string | null;
  targetId?: string | null;
  message?: string | null;
  createdAt?: string;
  db?: StorageDatabase;
};

const maxMessageLength = 500;

const createActionResultId = () =>
  `action_result_${randomBytes(16).toString("base64url")}`;

export const sanitizeActionResultMessage = (message?: string | null) => {
  const normalized = message?.trim().replaceAll(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  return normalized.length > maxMessageLength
    ? `${normalized.slice(0, maxMessageLength - 1)}…`
    : normalized;
};

export async function recordAdminActionResult({
  actorAdminUserId = null,
  actionType,
  targetType,
  targetId = null,
  result,
  message = null,
  createdAt = new Date().toISOString(),
  db = getStorageClient().db,
}: AdminActionResultInput) {
  const [actionResult] = await db
    .insert(adminActionResults)
    .values({
      id: createActionResultId(),
      actorAdminUserId,
      actionType,
      targetType,
      targetId,
      result,
      message: sanitizeActionResultMessage(message),
      createdAt,
    })
    .returning();

  return actionResult;
}
