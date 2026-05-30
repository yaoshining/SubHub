import { createHmac } from "node:crypto";

import { eq } from "drizzle-orm";

import { readEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import { callerKeys, type CallerKey } from "@/server/storage/schema";

export type CallerKeyAuthOptions = {
  request: Request;
  db?: StorageDatabase;
  requiredScope?: "subtitles:read";
  touchLastUsed?: boolean;
  now?: Date;
};

const nonProductionCallerKeySecret =
  "development-caller-key-secret-not-for-production";

const getCallerKeySecret = () => {
  const env = readEnv();
  return env.CALLER_KEY_SECRET ?? nonProductionCallerKeySecret;
};

export const hashCallerKey = (key: string) =>
  createHmac("sha256", getCallerKeySecret()).update(key).digest("base64url");

const readBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token || undefined;
};

export async function requireCallerKey({
  request,
  db = getStorageClient().db,
  requiredScope = "subtitles:read",
  touchLastUsed = true,
  now = new Date(),
}: CallerKeyAuthOptions): Promise<CallerKey> {
  const token = readBearerToken(request);

  if (!token) {
    throw new AppError(
      "CALLER_KEY_INVALID",
      "缺少有效的 Caller Key。",
      "authorization",
    );
  }

  const [callerKey] = await db
    .select()
    .from(callerKeys)
    .where(eq(callerKeys.keyHash, hashCallerKey(token)))
    .limit(1);

  if (!callerKey || callerKey.status === "rotated") {
    throw new AppError(
      "CALLER_KEY_INVALID",
      "Caller Key 无效或已轮换。",
      "caller_key",
    );
  }

  if (callerKey.status === "suspended") {
    throw new AppError(
      "CALLER_KEY_SUSPENDED",
      "Caller Key 已停用。",
      "caller_key",
    );
  }

  if (callerKey.scope !== requiredScope) {
    throw new AppError(
      "FORBIDDEN",
      "Caller Key scope 不允许访问该资源。",
      "caller_key.scope",
    );
  }

  if (touchLastUsed) {
    const [updated] = await db
      .update(callerKeys)
      .set({ lastUsedAt: now.toISOString() })
      .where(eq(callerKeys.id, callerKey.id))
      .returning();
    return updated;
  }

  return callerKey;
}
