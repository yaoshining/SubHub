import { randomBytes } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import { hashCallerKey } from "@/server/api/caller-key-auth";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import {
  callerKeyRotations,
  callerKeys,
  subtitleDownloadRequests,
  subtitleSearchRequests,
  type CallerKey,
  type CallerKeyRotation,
  type NewCallerKey,
  type NewCallerKeyRotation,
  type NewSubtitleDownloadRequest,
  type NewSubtitleSearchRequest,
  type SubtitleDownloadRequest,
  type SubtitleSearchRequest,
} from "@/server/storage/schema";

export type SanitizedCallerKey = Omit<CallerKey, "keyHash" | "revealTokenHash">;

export type CreateCallerKeyInput = Pick<
  CallerKey,
  "callerName" | "environment" | "scope" | "quotaPolicy"
>;

export type CallerKeyCreateResult = {
  callerKey: SanitizedCallerKey;
  key: string;
};

export type CallerKeyRotationResult = {
  callerKey: SanitizedCallerKey;
  rotation: CallerKeyRotation;
  key: string;
};

export type CallerKeyUsageSummary = {
  callerKeyId: string;
  lastUsedAt: string | null;
  searchCount: number;
  downloadCount: number;
  recentSearches: SubtitleSearchRequest[];
  recentDownloads: SubtitleDownloadRequest[];
  recentRotations: CallerKeyRotation[];
};

const revealWindowMs = 10 * 60 * 1000;

const createCallerKeyId = () => `ck_${randomBytes(16).toString("base64url")}`;

const createRotationId = () => `ckr_${randomBytes(16).toString("base64url")}`;

const createSubtitleSearchRequestId = () =>
  `search_${randomBytes(16).toString("base64url")}`;

const createSubtitleDownloadRequestId = () =>
  `download_${randomBytes(16).toString("base64url")}`;

const createPlaintextCallerKey = (environment: CallerKey["environment"]) => {
  const marker =
    environment === "production"
      ? "live"
      : environment === "staging"
        ? "stg"
        : "dev";

  return `subhub_${marker}_${randomBytes(32).toString("base64url")}`;
};

const createDisplayParts = (key: string) => ({
  keyPrefix: key.slice(0, 12),
  keySuffix: key.slice(-6),
});

const sanitizeCallerKey = (callerKey: CallerKey): SanitizedCallerKey => ({
  id: callerKey.id,
  callerName: callerKey.callerName,
  environment: callerKey.environment,
  scope: callerKey.scope,
  quotaPolicy: callerKey.quotaPolicy,
  keyPrefix: callerKey.keyPrefix,
  keySuffix: callerKey.keySuffix,
  status: callerKey.status,
  createdAt: callerKey.createdAt,
  updatedAt: callerKey.updatedAt,
  lastUsedAt: callerKey.lastUsedAt,
  lastRotatedAt: callerKey.lastRotatedAt,
  revealUntil: callerKey.revealUntil,
});

const isSqliteConstraintError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  String(error.code).startsWith("SQLITE_CONSTRAINT");

export class CallerKeyRepository {
  constructor(private readonly db = getStorageClient().db) {}

  async listCallerKeys(): Promise<SanitizedCallerKey[]> {
    const rows = await this.db
      .select()
      .from(callerKeys)
      .orderBy(desc(callerKeys.createdAt));

    return rows.map(sanitizeCallerKey);
  }

  async requireCallerKey(keyId: string): Promise<CallerKey> {
    const [callerKey] = await this.db
      .select()
      .from(callerKeys)
      .where(eq(callerKeys.id, keyId))
      .limit(1);

    if (!callerKey) {
      throw new AppError("CALLER_KEY_INVALID", "Caller Key 不存在。", "keyId");
    }

    return callerKey;
  }

  async createCallerKey(
    input: CreateCallerKeyInput,
    now = new Date(),
  ): Promise<CallerKeyCreateResult> {
    const callerName = input.callerName.trim();
    const scope = input.scope.trim();
    const quotaPolicy = input.quotaPolicy.trim();

    if (!callerName) {
      throw new AppError(
        "VALIDATION_FAILED",
        "调用方名称不能为空。",
        "callerName",
      );
    }
    if (scope !== "subtitles:read") {
      throw new AppError(
        "VALIDATION_FAILED",
        "MVP 仅支持 subtitles:read scope。",
        "scope",
      );
    }
    if (!quotaPolicy) {
      throw new AppError(
        "VALIDATION_FAILED",
        "配额策略不能为空。",
        "quotaPolicy",
      );
    }

    const key = createPlaintextCallerKey(input.environment);
    const createdAt = now.toISOString();
    const revealUntil = new Date(now.getTime() + revealWindowMs).toISOString();

    try {
      const [callerKey] = await this.db
        .insert(callerKeys)
        .values({
          id: createCallerKeyId(),
          callerName,
          environment: input.environment,
          scope,
          quotaPolicy,
          keyHash: hashCallerKey(key),
          ...createDisplayParts(key),
          status: "active",
          createdAt,
          updatedAt: createdAt,
          lastUsedAt: null,
          lastRotatedAt: null,
          revealUntil,
          revealTokenHash: null,
        } satisfies NewCallerKey)
        .returning();

      if (!callerKey) {
        throw new AppError("UPSTREAM_FAILED", "创建 Caller Key 失败。");
      }

      return { callerKey: sanitizeCallerKey(callerKey), key };
    } catch (error) {
      if (isSqliteConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Caller Key 配置不符合约束。",
          "callerKey",
        );
      }
      throw error;
    }
  }

  async rotateCallerKey(
    keyId: string,
    performedByAdminUserId: string | null,
    now = new Date(),
  ): Promise<CallerKeyRotationResult> {
    const current = await this.requireCallerKey(keyId);

    if (current.status === "suspended") {
      throw new AppError(
        "CALLER_KEY_SUSPENDED",
        "已停用 Caller Key 不允许轮换，请先创建新的调用方 Key。",
        "keyId",
      );
    }
    if (current.status === "rotated") {
      throw new AppError(
        "CALLER_KEY_INVALID",
        "已轮换 Caller Key 不允许再次轮换。",
        "keyId",
      );
    }

    const key = createPlaintextCallerKey(current.environment);
    const rotatedAt = now.toISOString();
    const revealUntil = new Date(now.getTime() + revealWindowMs).toISOString();
    const displayParts = createDisplayParts(key);

    const result = this.db.transaction((tx) => {
      const [rotated] = tx
        .update(callerKeys)
        .set({
          status: "rotated",
          updatedAt: rotatedAt,
          lastRotatedAt: rotatedAt,
          revealUntil: null,
          revealTokenHash: null,
        })
        .where(and(eq(callerKeys.id, keyId), eq(callerKeys.status, "active")))
        .returning()
        .all();

      if (!rotated) {
        throw new AppError(
          "CALLER_KEY_INVALID",
          "Caller Key 不存在或已轮换。",
          "keyId",
        );
      }

      const [created] = tx
        .insert(callerKeys)
        .values({
          id: createCallerKeyId(),
          callerName: current.callerName,
          environment: current.environment,
          scope: current.scope,
          quotaPolicy: current.quotaPolicy,
          keyHash: hashCallerKey(key),
          ...displayParts,
          status: "active",
          createdAt: rotatedAt,
          updatedAt: rotatedAt,
          lastUsedAt: null,
          lastRotatedAt: null,
          revealUntil,
          revealTokenHash: null,
        } satisfies NewCallerKey)
        .returning()
        .all();

      if (!created) {
        throw new AppError("UPSTREAM_FAILED", "创建轮换后 Caller Key 失败。");
      }

      const [rotation] = tx
        .insert(callerKeyRotations)
        .values({
          id: createRotationId(),
          callerKeyId: keyId,
          oldKeySuffix: current.keySuffix,
          newKeySuffix: displayParts.keySuffix,
          result: "success",
          reason: "rotated",
          createdAt: rotatedAt,
          performedByAdminUserId,
        } satisfies NewCallerKeyRotation)
        .returning()
        .all();

      if (!rotation) {
        throw new AppError("UPSTREAM_FAILED", "记录 Caller Key 轮换失败。");
      }

      return { created, rotation };
    });

    return {
      callerKey: sanitizeCallerKey(result.created),
      rotation: result.rotation,
      key,
    };
  }

  async suspendCallerKey(keyId: string, now = new Date()) {
    await this.requireCallerKey(keyId);
    const [callerKey] = await this.db
      .update(callerKeys)
      .set({
        status: "suspended",
        updatedAt: now.toISOString(),
        revealUntil: null,
        revealTokenHash: null,
      })
      .where(eq(callerKeys.id, keyId))
      .returning();

    if (!callerKey) {
      throw new AppError("CALLER_KEY_INVALID", "Caller Key 不存在。", "keyId");
    }

    return sanitizeCallerKey(callerKey);
  }

  async recordSearchRequest(input: Omit<NewSubtitleSearchRequest, "id">) {
    const [request] = await this.db
      .insert(subtitleSearchRequests)
      .values({ ...input, id: createSubtitleSearchRequestId() })
      .returning();

    return request;
  }

  async recordDownloadRequest(input: Omit<NewSubtitleDownloadRequest, "id">) {
    const [request] = await this.db
      .insert(subtitleDownloadRequests)
      .values({ ...input, id: createSubtitleDownloadRequestId() })
      .returning();

    return request;
  }

  async getUsageSummary(
    keyId: string,
    limit = 20,
  ): Promise<CallerKeyUsageSummary> {
    const callerKey = await this.requireCallerKey(keyId);
    const [searches, downloads, rotations] = await Promise.all([
      this.db
        .select()
        .from(subtitleSearchRequests)
        .where(eq(subtitleSearchRequests.callerKeyId, keyId))
        .orderBy(desc(subtitleSearchRequests.createdAt))
        .limit(limit),
      this.db
        .select()
        .from(subtitleDownloadRequests)
        .where(eq(subtitleDownloadRequests.callerKeyId, keyId))
        .orderBy(desc(subtitleDownloadRequests.createdAt))
        .limit(limit),
      this.db
        .select()
        .from(callerKeyRotations)
        .where(eq(callerKeyRotations.callerKeyId, keyId))
        .orderBy(desc(callerKeyRotations.createdAt))
        .limit(limit),
    ]);

    return {
      callerKeyId: keyId,
      lastUsedAt: callerKey.lastUsedAt,
      searchCount: searches.length,
      downloadCount: downloads.length,
      recentSearches: searches,
      recentDownloads: downloads,
      recentRotations: rotations,
    };
  }
}

export const createCallerKeyRepository = (db?: StorageDatabase) =>
  new CallerKeyRepository(db ?? getStorageClient().db);
