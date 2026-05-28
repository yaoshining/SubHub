import { recordAdminActionResult } from "@/server/audit/action-results";
import {
  createCallerKeyRepository,
  type CreateCallerKeyInput,
} from "@/server/caller-keys/caller-key-repository";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";

export type CallerKeyServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
  actorAdminUserId?: string | null;
};

const getRepository = (db?: StorageDatabase) =>
  createCallerKeyRepository(db ?? getStorageClient().db);

export async function listCallerKeys(options: CallerKeyServiceOptions = {}) {
  const items = await getRepository(options.db).listCallerKeys();

  return { items, total: items.length };
}

export async function createCallerKey(
  input: CreateCallerKeyInput,
  options: CallerKeyServiceOptions = {},
) {
  return getRepository(options.db).createCallerKey(input, options.now);
}

export async function rotateCallerKey(
  keyId: string,
  options: CallerKeyServiceOptions = {},
) {
  const result = await getRepository(options.db).rotateCallerKey(
    keyId,
    options.actorAdminUserId ?? null,
    options.now,
  );

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "caller_key_rotated",
    targetType: "caller_key",
    targetId: keyId,
    result: "success",
    message: `Caller Key 已轮换，新后缀 ${result.callerKey.keySuffix ?? "unknown"}。`,
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return result;
}

export async function suspendCallerKey(
  keyId: string,
  options: CallerKeyServiceOptions = {},
) {
  const callerKey = await getRepository(options.db).suspendCallerKey(
    keyId,
    options.now,
  );

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "caller_key_suspended",
    targetType: "caller_key",
    targetId: keyId,
    result: "success",
    message: "Caller Key 已停用，新请求将立即被拒绝。",
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return callerKey;
}

export async function getCallerKeyUsage(
  keyId: string,
  options: CallerKeyServiceOptions = {},
) {
  return getRepository(options.db).getUsageSummary(keyId);
}
