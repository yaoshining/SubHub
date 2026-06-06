import { eq, sql } from "drizzle-orm";

import type { CreateInitialAdminInput } from "@/server/services/bootstrap-service";
import { createInitialAdmin } from "@/server/services/bootstrap-service";
import type { StorageDatabase } from "./client";
import { adminUsers, providers } from "./schema";

const bootstrapRequiredTables = [
  "admin_users",
  "admin_invitations",
  "admin_sessions",
  "providers",
  "provider_credentials",
  "caller_keys",
  "caller_key_rotations",
  "admin_action_results",
] as const;

export type BootstrapMode = "production" | "staging" | "development";
export type SeedState = "not_applicable" | "pending" | "applied";
export type AdminInitializationState = "migrated" | "required" | "completed";

/**
 * 三态语义（与 `specs/002-migrate-neon-vercel/data-model.md` 的 `BootstrapState`
 * 保持一致，但当前实现不持久化"已 bootstrap 初始化"标记）：
 *
 * - `required`：数据库中没有任何管理员，处于 greenfield 阶段；只有显式允许
 *   首个管理员初始化时，才允许进入后续状态。
 * - `migrated`：数据库中已存在管理员（来源可能是首次 bootstrap 或受控导入），
 *   但当前进程未通过 `runBootstrap` 触发 `createInitialAdmin`。
 *   当前实现凭 `adminUsersCount > 0` 推断，因此**不能**用来严格区分
 *   "bootstrap 创建"与"受控导入"。
 * - `completed`：当前进程已通过 `runBootstrap` 显式完成首次管理员初始化。
 *   该结论仅在**同一进程内**可稳定复现（基于进程内标志）；跨进程再次
 *   `inspectBootstrapState` 时会回落为 `migrated`，直到未来引入持久化标记。
 *
 * 如需在外部 `inspectBootstrapState`（无 override）下也能稳定拿到
 * `completed`，必须引入持久化标记（schema 列 / 元数据表 / 配置项等），
 * 不应继续依赖 `adminUsersCount` 隐式推断。
 */
let hasInitializedInitialAdminInProcess = false;

export const resetBootstrapRuntimeMarkersForTesting = () => {
  hasInitializedInitialAdminInProcess = false;
};

export type BootstrapState = {
  schemaReady: boolean;
  bootstrapReady: boolean;
  seedState: SeedState;
  adminInitializationState: AdminInitializationState;
  lastValidatedAt: string;
};

export type BootstrapInspection = {
  mode: BootstrapMode;
  state: BootstrapState;
  missingTables: string[];
  adminUsersCount: number;
};

export type RunBootstrapOptions = {
  db: StorageDatabase;
  mode: BootstrapMode;
  now?: Date;
  allowInitialAdminBootstrap?: boolean;
  initialAdminInput?: CreateInitialAdminInput;
};

export type BootstrapExecutionResult = BootstrapInspection & {
  createdInitialAdmin: boolean;
};

export type SeedExecutionResult = BootstrapInspection & {
  seedProviderId: string;
  insertedProviders: number;
  updatedProviders: number;
};

const inspectBootstrapTable = async (
  db: StorageDatabase,
  tableName: (typeof bootstrapRequiredTables)[number],
) => {
  await db.execute(sql.raw(`select 1 from "${tableName}" limit 0`));
};

const resolveMissingBootstrapTables = async (db: StorageDatabase) => {
  const missingTables: string[] = [];

  for (const tableName of bootstrapRequiredTables) {
    try {
      await inspectBootstrapTable(db, tableName);
    } catch {
      missingTables.push(tableName);
    }
  }

  return missingTables;
};

const resolveAdminUsersCount = async (db: StorageDatabase) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(adminUsers);

  return Number(row?.count ?? 0);
};

const resolveAdminInitializationState = ({
  adminUsersCount,
  hasInitializedInitialAdminInProcess,
}: {
  adminUsersCount: number;
  hasInitializedInitialAdminInProcess: boolean;
}): AdminInitializationState => {
  if (adminUsersCount === 0) {
    return "required";
  }

  if (hasInitializedInitialAdminInProcess) {
    return "completed";
  }

  return "migrated";
};

const buildBootstrapState = ({
  mode,
  now,
  missingTables,
  adminUsersCount,
  seedStateOverride,
  adminInitializationStateOverride,
}: {
  mode: BootstrapMode;
  now: Date;
  missingTables: string[];
  adminUsersCount: number;
  seedStateOverride?: SeedState;
  adminInitializationStateOverride?: AdminInitializationState;
}): BootstrapInspection => {
  const schemaReady = missingTables.length === 0;
  const adminInitializationState =
    adminInitializationStateOverride ??
    resolveAdminInitializationState({
      adminUsersCount,
      hasInitializedInitialAdminInProcess,
    });
  const seedState =
    seedStateOverride ?? (mode === "production" ? "not_applicable" : "pending");

  return {
    mode,
    missingTables,
    adminUsersCount,
    state: {
      schemaReady,
      bootstrapReady: schemaReady,
      seedState,
      adminInitializationState,
      lastValidatedAt: now.toISOString(),
    },
  };
};

export const inspectBootstrapState = async ({
  db,
  mode,
  now = new Date(),
  seedStateOverride,
  adminInitializationStateOverride,
}: {
  db: StorageDatabase;
  mode: BootstrapMode;
  now?: Date;
  seedStateOverride?: SeedState;
  adminInitializationStateOverride?: AdminInitializationState;
}): Promise<BootstrapInspection> => {
  const missingTables = await resolveMissingBootstrapTables(db);
  const adminUsersCount =
    missingTables.length === 0 ? await resolveAdminUsersCount(db) : 0;

  return buildBootstrapState({
    mode,
    now,
    missingTables,
    adminUsersCount,
    seedStateOverride,
    adminInitializationStateOverride,
  });
};

export const runBootstrap = async ({
  db,
  mode,
  now = new Date(),
  allowInitialAdminBootstrap = false,
  initialAdminInput,
}: RunBootstrapOptions): Promise<BootstrapExecutionResult> => {
  const inspected = await inspectBootstrapState({ db, mode, now });

  if (!inspected.state.schemaReady) {
    return {
      ...inspected,
      createdInitialAdmin: false,
    };
  }

  let createdInitialAdmin = false;
  let adminInitializationStateOverride: AdminInitializationState | undefined;

  if (initialAdminInput) {
    if (!allowInitialAdminBootstrap) {
      throw new Error(
        "首个管理员初始化已被显式禁用。仅允许在无管理员且明确允许的 greenfield 场景执行。",
      );
    }

    if (inspected.adminUsersCount === 0) {
      await createInitialAdmin(initialAdminInput, {
        db,
        now,
        allowBootstrap: true,
      });
      createdInitialAdmin = true;
      hasInitializedInitialAdminInProcess = true;
      adminInitializationStateOverride = "completed";
    }
  }

  const nextState = await inspectBootstrapState({
    db,
    mode,
    now,
    adminInitializationStateOverride,
  });

  return {
    ...nextState,
    createdInitialAdmin,
  };
};

const buildSeedProvider = (
  mode: Exclude<BootstrapMode, "production">,
  now: Date,
) => {
  const createdAt = now.toISOString();

  return {
    id: `seed_provider_${mode}_opensubtitles`,
    name: `Seed ${mode} OpenSubtitles`,
    type: "opensubtitles" as const,
    status: "needs_config" as const,
    priority: 100,
    weight: 100,
    concurrencyLimit: 1,
    rotationEnabled: true,
    cooldownSeconds: 60,
    lastHealthStatus: "seeded",
    lastErrorSummary: `${mode} seed placeholder provider，需后续补充真实凭据。`,
    fallbackProviderId: null,
    createdAt,
    updatedAt: createdAt,
  };
};

export const applyManagedSeed = async ({
  db,
  mode,
  now = new Date(),
}: {
  db: StorageDatabase;
  mode: BootstrapMode;
  now?: Date;
}): Promise<SeedExecutionResult> => {
  if (mode === "production") {
    throw new Error("production 禁止执行 seed。");
  }

  const inspected = await inspectBootstrapState({ db, mode, now });

  if (!inspected.state.schemaReady) {
    throw new Error("schema 尚未就绪，无法执行 non-production seed。");
  }

  const seedProvider = buildSeedProvider(mode, now);
  const [existing] = await db
    .select({ id: providers.id })
    .from(providers)
    .where(eq(providers.id, seedProvider.id))
    .limit(1);

  if (existing) {
    await db
      .update(providers)
      .set({
        name: seedProvider.name,
        status: seedProvider.status,
        priority: seedProvider.priority,
        weight: seedProvider.weight,
        concurrencyLimit: seedProvider.concurrencyLimit,
        rotationEnabled: seedProvider.rotationEnabled,
        cooldownSeconds: seedProvider.cooldownSeconds,
        lastHealthStatus: seedProvider.lastHealthStatus,
        lastErrorSummary: seedProvider.lastErrorSummary,
        updatedAt: seedProvider.updatedAt,
      })
      .where(eq(providers.id, seedProvider.id));
  } else {
    await db.insert(providers).values(seedProvider);
  }

  const nextState = await inspectBootstrapState({
    db,
    mode,
    now,
    seedStateOverride: "applied",
  });

  return {
    ...nextState,
    seedProviderId: seedProvider.id,
    insertedProviders: existing ? 0 : 1,
    updatedProviders: existing ? 1 : 0,
  };
};
