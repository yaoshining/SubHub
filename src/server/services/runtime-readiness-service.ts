import { AppError } from "@/lib/errors";
import { readEnv, type AppEnv } from "@/lib/env";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import {
  inspectBootstrapState,
  type AdminInitializationState,
  type BootstrapMode,
  type SeedState,
} from "@/server/storage/bootstrap";

export type RuntimeBlockingReason =
  | "direct_url_unreachable"
  | "schema_not_ready"
  | "bootstrap_not_ready"
  | "admin_initialization_required";

export type RuntimeReadinessStatus = {
  initialized: boolean;
  mode: BootstrapMode;
  schemaReady: boolean;
  bootstrapReady: boolean;
  seedState: SeedState;
  adminInitializationState: AdminInitializationState;
  missingTables: string[];
  adminUsersCount: number;
  runtimeGateRequired: boolean;
  directUrlReady: boolean;
  directUrlError: string | null;
  runtimeReady: boolean;
  blockingReasons: RuntimeBlockingReason[];
  lastCheckedAt: string;
};

export type RuntimeReadinessServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
  env?: AppEnv;
  directUrlProbe?: (directUrl: string) => Promise<void>;
};

const resolveBootstrapMode = (env: AppEnv): BootstrapMode => {
  switch (env.resolvedTier) {
    case "production":
      return "production";
    case "staging":
      return "staging";
    default:
      return "development";
  }
};

const defaultDirectUrlProbe = async (directUrl: string) => {
  const client = createDirectPostgresClient({
    directDatabaseUrl: directUrl,
  });

  try {
    await client.sql`select 1`;
  } finally {
    await client.close();
  }
};

const buildBlockingReasons = (status: {
  runtimeGateRequired: boolean;
  directUrlReady: boolean;
  schemaReady: boolean;
  bootstrapReady: boolean;
  adminInitializationState: AdminInitializationState;
}): RuntimeBlockingReason[] => {
  if (!status.runtimeGateRequired) {
    return [];
  }

  const blockingReasons: RuntimeBlockingReason[] = [];

  if (!status.directUrlReady) {
    blockingReasons.push("direct_url_unreachable");
  }

  if (!status.schemaReady) {
    blockingReasons.push("schema_not_ready");
  }

  if (!status.bootstrapReady) {
    blockingReasons.push(
      status.adminInitializationState === "required"
        ? "admin_initialization_required"
        : "bootstrap_not_ready",
    );
  }

  return blockingReasons;
};

export async function getRuntimeReadinessStatus({
  db = getStorageClient().db,
  now = new Date(),
  env = readEnv(),
  directUrlProbe = defaultDirectUrlProbe,
}: RuntimeReadinessServiceOptions = {}): Promise<RuntimeReadinessStatus> {
  const mode = resolveBootstrapMode(env);
  const inspection = await inspectBootstrapState({
    db,
    mode,
    now,
  });
  const runtimeGateRequired = mode === "production";

  let directUrlReady = true;
  let directUrlError: string | null = null;

  if (runtimeGateRequired) {
    try {
      await directUrlProbe(env.DATABASE_URL_UNPOOLED);
    } catch (error) {
      directUrlReady = false;
      directUrlError =
        error instanceof Error
          ? error.message
          : "DATABASE_URL_UNPOOLED 连通性校验失败。";
    }
  }

  const blockingReasons = buildBlockingReasons({
    runtimeGateRequired,
    directUrlReady,
    schemaReady: inspection.state.schemaReady,
    bootstrapReady: inspection.state.bootstrapReady,
    adminInitializationState: inspection.state.adminInitializationState,
  });

  return {
    initialized: inspection.adminUsersCount > 0,
    mode,
    schemaReady: inspection.state.schemaReady,
    bootstrapReady: inspection.state.bootstrapReady,
    seedState: inspection.state.seedState,
    adminInitializationState: inspection.state.adminInitializationState,
    missingTables: inspection.missingTables,
    adminUsersCount: inspection.adminUsersCount,
    runtimeGateRequired,
    directUrlReady,
    directUrlError,
    runtimeReady: blockingReasons.length === 0,
    blockingReasons,
    lastCheckedAt: inspection.state.lastValidatedAt,
  };
}

export async function assertProductionRuntimeReady(
  options: RuntimeReadinessServiceOptions = {},
) {
  const status = await getRuntimeReadinessStatus(options);

  if (!status.runtimeGateRequired || status.runtimeReady) {
    return status;
  }

  if (!status.directUrlReady) {
    throw new AppError(
      "SERVICE_NOT_READY",
      `Production runtime readiness 未通过：DATABASE_URL_UNPOOLED 不可用。${status.directUrlError ? ` ${status.directUrlError}` : ""}`,
      "database_url_unpooled",
    );
  }

  if (!status.schemaReady) {
    throw new AppError(
      "SERVICE_NOT_READY",
      `Production runtime readiness 未通过：schema 未就绪。${status.missingTables.length > 0 ? ` 缺少表：${status.missingTables.join(", ")}。` : ""}`,
      "schema",
    );
  }

  if (status.adminInitializationState === "required") {
    throw new AppError(
      "SERVICE_NOT_READY",
      "Production runtime readiness 未通过：bootstrap 未完成，当前仍需首个管理员初始化。",
      "bootstrap",
    );
  }

  throw new AppError(
    "SERVICE_NOT_READY",
    "Production runtime readiness 未通过：bootstrap 未完成。",
    "bootstrap",
  );
}
