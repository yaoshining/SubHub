import { and, count, countDistinct, eq } from "drizzle-orm";

import type { AppErrorCode } from "@/lib/errors";
import { readEnv } from "@/lib/env";
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
  environment: string;
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

const defaultAppVersion = "0.1.0";
const readinessTargets = new Set<SystemReadinessPartialErrorTarget>([
  "admin",
  "provider",
  "caller_key",
]);

const buildRuntimeStatusFallback = (
  now: Date,
  runtimeGateRequired: boolean,
): RuntimeReadinessStatus => ({
  initialized: false,
  mode: runtimeGateRequired ? "production" : "development",
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
  blockingReasons: runtimeGateRequired ? ["bootstrap_not_ready"] : [],
  lastCheckedAt: now.toISOString(),
});

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

const readEnvironment = () => readEnv().NODE_ENV;

const readVersion = () =>
  process.env.NEXT_PUBLIC_APP_VERSION ??
  process.env.APP_VERSION ??
  defaultAppVersion;

export async function getSystemReadiness({
  db = getStorageClient().db,
  now = new Date(),
}: SettingsServiceOptions = {}): Promise<SystemReadiness> {
  const partialErrors: SystemReadinessPartialError[] = [];
  const runtimeGateRequiredByEnv = (() => {
    try {
      return readEnv().resolvedTier === "production";
    } catch {
      return false;
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
      buildRuntimeStatusFallback(now, runtimeGateRequiredByEnv),
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
      runtimeStatus.runtimeReady,
    runtimeGateRequired: runtimeStatus.runtimeGateRequired,
    runtimeReady: runtimeStatus.runtimeReady,
    schemaReady: runtimeStatus.schemaReady,
    bootstrapReady: runtimeStatus.bootstrapReady,
    adminInitializationState:
      runtimeStatus.adminInitializationState,
    directUrlReady: runtimeStatus.directUrlReady,
    directUrlError: runtimeStatus.directUrlError,
    blockingReasons: runtimeStatus.blockingReasons,
    missingConditions,
    lastCheckedAt: now.toISOString(),
    partialErrors,
  };
}
