import { and, count, countDistinct, eq } from "drizzle-orm";
import packageJson from "../../../package.json";

import type { AppErrorCode } from "@/lib/errors";
import { readEnv, type RuntimeTier } from "@/lib/env";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import {
  getRuntimeReadinessStatus,
  type RuntimeReadinessStatus,
  type RuntimeBlockingReason,
} from "@/server/services/runtime-readiness-service";
import type { AdminInitializationState } from "@/server/storage/bootstrap";
import {
  adminUsers,
  callerKeys,
  providerCredentials,
  providers,
} from "@/server/storage/schema";

export type SystemReadinessPartialErrorTarget =
  | "environment"
  | "version"
  | "runtime"
  | "admin"
  | "provider"
  | "caller_key";

export type SystemReadinessPartialError = {
  target: SystemReadinessPartialErrorTarget;
  code: AppErrorCode;
  message: string;
};

export type SystemReadiness = {
  environment: ReadinessEnvironment;
  version: string;
  adminInitialized: boolean;
  activeProviderCount: number;
  activeCallerKeyCount: number;
  gatewayReady: boolean;
  runtimeGateRequired: boolean;
  runtimeReady: boolean;
  schemaReady: boolean;
  bootstrapReady: boolean;
  adminInitializationState: AdminInitializationState;
  directUrlReady: boolean;
  directUrlError: string | null;
  blockingReasons: RuntimeBlockingReason[];
  missingConditions: Array<"admin" | "provider" | "caller_key">;
  lastCheckedAt: string;
  partialErrors: SystemReadinessPartialError[];
};

export type SettingsServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
};

const defaultAppVersion = packageJson.version;
type ReadinessEnvironment = RuntimeTier | "test" | "unknown";
const readinessTargets = new Set<SystemReadinessPartialErrorTarget>([
  "runtime",
  "admin",
  "provider",
  "caller_key",
]);

const buildRuntimeStatusFallback = (
  now: Date,
  runtimeGateRequired: boolean,
  runtimeTier: RuntimeTier,
): RuntimeReadinessStatus => {
  const mode =
    runtimeTier === "production"
      ? "production"
      : runtimeTier === "staging"
        ? "staging"
        : "development";
  return {
    initialized: false,
    mode,
    schemaReady: !runtimeGateRequired,
    bootstrapReady: !runtimeGateRequired,
    seedState: runtimeGateRequired ? "not_applicable" : "pending",
    adminInitializationState: "required",
    missingTables: [],
    adminUsersCount: 0,
    runtimeGateRequired,
    directUrlReady: !runtimeGateRequired,
    directUrlError: null,
    runtimeReady: !runtimeGateRequired,
    blockingReasons: runtimeGateRequired
      ? [
          "direct_url_unreachable",
          "schema_not_ready",
          "admin_initialization_required",
        ]
      : [],
    lastCheckedAt: now.toISOString(),
  };
};

async function countRows(
  query: Promise<Array<{ value: number }>>,
): Promise<number> {
  const [row] = await query;
  return row?.value ?? 0;
}

function toPartialError(
  target: SystemReadinessPartialErrorTarget,
  error: unknown,
): SystemReadinessPartialError {
  return {
    target,
    code: "UPSTREAM_FAILED",
    message:
      error instanceof Error ? error.message : `${target} 状态读数失败。`,
  };
}

async function readSignal<T>(
  target: SystemReadinessPartialErrorTarget,
  reader: () => Promise<T> | T,
  fallback: T,
  partialErrors: SystemReadinessPartialError[],
) {
  try {
    return await reader();
  } catch (error) {
    partialErrors.push(toPartialError(target, error));
    return fallback;
  }
}

const readEnvironment = (): Exclude<ReadinessEnvironment, "unknown"> => {
  const env = readEnv();
  return env.NODE_ENV === "test" ? "test" : env.resolvedTier;
};

const readVersion = () =>
  process.env.NEXT_PUBLIC_APP_VERSION ??
  process.env.APP_VERSION ??
  defaultAppVersion;

export async function getSystemReadiness({
  db = getStorageClient().db,
  now = new Date(),
}: SettingsServiceOptions = {}): Promise<SystemReadiness> {
  const partialErrors: SystemReadinessPartialError[] = [];
  const fallbackTierInfo = (() => {
    try {
      const env = readEnv();
      return {
        runtimeGateRequired: env.resolvedTier === "production",
        runtimeTier: env.resolvedTier,
      };
    } catch {
      // readEnv() 解析失败（如环境变量缺失/不合法）时，以 VERCEL_ENV 作为最保守
      // 兜底判断，确保 production 部署不会因 readEnv 异常而被误判为非 production。
      // 注意：此处不检查 VERCEL_GIT_COMMIT_REF，仅用于 fallback 的 gate 方向判断。
      const isProd = process.env.VERCEL_ENV === "production";
      return {
        runtimeGateRequired: isProd,
        runtimeTier: (isProd ? "production" : "development") as RuntimeTier,
      };
    }
  })();

  const [
    environment,
    version,
    runtimeStatus,
    adminInitialized,
    activeProviderCount,
    activeCallerKeyCount,
  ] = await Promise.all([
    readSignal("environment", readEnvironment, "unknown", partialErrors),
    readSignal("version", readVersion, defaultAppVersion, partialErrors),
    readSignal(
      "runtime",
      () => getRuntimeReadinessStatus({ db, now }),
      buildRuntimeStatusFallback(
        now,
        fallbackTierInfo.runtimeGateRequired,
        fallbackTierInfo.runtimeTier,
      ),
      partialErrors,
    ),
    readSignal(
      "admin",
      async () => {
        const [adminUser] = await db
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .limit(1);

        return Boolean(adminUser);
      },
      false,
      partialErrors,
    ),
    readSignal(
      "provider",
      () =>
        countRows(
          db
            .select({ value: countDistinct(providerCredentials.providerId) })
            .from(providerCredentials)
            .innerJoin(
              providers,
              eq(providerCredentials.providerId, providers.id),
            )
            .where(
              and(
                eq(providers.status, "enabled"),
                eq(providerCredentials.status, "active"),
              ),
            ),
        ),
      0,
      partialErrors,
    ),
    readSignal(
      "caller_key",
      () =>
        countRows(
          db
            .select({ value: count() })
            .from(callerKeys)
            .where(eq(callerKeys.status, "active")),
        ),
      0,
      partialErrors,
    ),
  ]);

  const missingConditions: SystemReadiness["missingConditions"] = [];
  const failedTargets = new Set(partialErrors.map((error) => error.target));
  const hasReadinessPartialErrors = partialErrors.some((error) =>
    readinessTargets.has(error.target),
  );

  if (!adminInitialized && !failedTargets.has("admin")) {
    missingConditions.push("admin");
  }
  if (activeProviderCount === 0 && !failedTargets.has("provider")) {
    missingConditions.push("provider");
  }
  if (activeCallerKeyCount === 0 && !failedTargets.has("caller_key")) {
    missingConditions.push("caller_key");
  }

  return {
    environment,
    version,
    adminInitialized,
    activeProviderCount,
    activeCallerKeyCount,
    gatewayReady:
      missingConditions.length === 0 &&
      !hasReadinessPartialErrors &&
      runtimeStatus.schemaReady &&
      runtimeStatus.bootstrapReady &&
      (!runtimeStatus.runtimeGateRequired || runtimeStatus.runtimeReady),
    runtimeGateRequired: runtimeStatus.runtimeGateRequired,
    runtimeReady: runtimeStatus.runtimeReady,
    schemaReady: runtimeStatus.schemaReady,
    bootstrapReady: runtimeStatus.bootstrapReady,
    adminInitializationState: runtimeStatus.adminInitializationState,
    directUrlReady: runtimeStatus.directUrlReady,
    directUrlError: runtimeStatus.directUrlError,
    blockingReasons: runtimeStatus.blockingReasons,
    missingConditions,
    lastCheckedAt: now.toISOString(),
    partialErrors,
  };
}
