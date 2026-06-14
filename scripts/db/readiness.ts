import { loadEnvConfig } from "@next/env";

import { readEnv } from "../../src/lib/env";
import { createStorageClient } from "../../src/server/storage/client";
import {
  getRuntimeReadinessStatus,
  type RuntimeReadinessStatus,
} from "../../src/server/services/runtime-readiness-service";

/**
 * #70 migration / deploy gate 专用 readiness 消费脚本。
 *
 * 边界约束：
 * - 不重新定义 readiness 判定，#64 已落地的 `getRuntimeReadinessStatus` / `assertProductionRuntimeReady`
 *   仍是规则真源。
 * - 不充当 release orchestration 或自动 rollback 入口。
 * - 仅消费 `RuntimeReadinessStatus.blockingReasons` 与 `runtimeReady` 字段，不引入并行字符串字面量。
 * - 仅在 `resolvedTier === "production"` 时支持 `--enforce` 标志；
 *   非 production tier 传入 `--enforce` 会被显式拒绝（退出非零）。
 * - staging / development 仍允许 inspect 状态，但默认 `enforce=false`，不阻断 deploy smoke。
 */
export type ReadinessGateTier = "production" | "staging" | "development";

export type ReadinessGateInput = {
  tier: ReadinessGateTier;
  /** 是否把任何 blocking reason 视为必须失败；仅在 production tier CLI 执行时支持；非 production 传入 --enforce 会被拒绝。 */
  enforce?: boolean;
};

export type ReadinessGateResult =
  | {
      ok: true;
      status: RuntimeReadinessStatus;
    }
  | {
      ok: false;
      status: RuntimeReadinessStatus;
      blockingReasons: RuntimeReadinessStatus["blockingReasons"];
    };

const isProduction = (tier: ReadinessGateTier) => tier === "production";

const parseEnforceFlag = (argv: readonly string[]) =>
  argv.includes("--enforce") || argv.includes("--enforce=true");

export const evaluateReadinessGate = (
  status: RuntimeReadinessStatus,
  { tier, enforce = isProduction(tier) }: ReadinessGateInput,
): ReadinessGateResult => {
  if (status.runtimeReady) {
    return { ok: true, status };
  }

  // 非 production tier 仅 inspect，不作为强制 gate，便于 staging / dev 的
  // 常规 deploy smoke 在尚未初始化管理员时不被误阻断。
  if (!enforce) {
    return { ok: true, status };
  }

  return {
    ok: false,
    status,
    blockingReasons: status.blockingReasons,
  };
};

const formatBlockingReasons = (
  reasons: RuntimeReadinessStatus["blockingReasons"],
) => reasons.join(", ") || "(无)";

/**
 * 决定 readiness 脚本的 storage client URL 边界。
 *
 * - runtime（pooled）URL = `DATABASE_URL`：承载 `getRuntimeReadinessStatus`
 *   内部的 schema 检查、admin 计数等 read query；这些 read 路径与运行时
 *   业务请求共用 pooled 连接，与 `db:migrate` 仅消费 unpooled 的边界
 *   明确分离。
 * - direct（unpooled）URL = `DATABASE_URL_UNPOOLED`：仅供 #64 readiness
 *   内部 `directUrlProbe` 与 storage client 内部偶发的 DDL 场景。
 *
 * 两者都绑到 unpooled 会破坏已落地的 pooled / unpooled 边界。
 */
export const resolveReadinessClientOptions = ({
  DATABASE_URL,
  DATABASE_URL_UNPOOLED,
}: {
  DATABASE_URL: string;
  DATABASE_URL_UNPOOLED: string;
}) => ({
  runtimeDatabaseUrl: DATABASE_URL,
  directDatabaseUrl: DATABASE_URL_UNPOOLED,
});

const main = async () => {
  loadEnvConfig(process.cwd());
  const env = readEnv();
  const tier = env.resolvedTier;
  const enforce = parseEnforceFlag(process.argv.slice(2));

  if (enforce && !isProduction(tier)) {
    console.error(
      `[readiness-gate] --enforce 仅在 production tier 下支持，当前 tier 为 ${tier}，拒绝执行。`,
    );
    process.exit(1);
  }

  if (tier === "production" && enforce) {
    console.log(
      "[readiness-gate] production tier + --enforce 检测到；将按 #64 blocking reasons 强制阻断。",
    );
  } else if (tier === "production") {
    console.log(
      "[readiness-gate] production tier 但未提供 --enforce；将 inspect 状态但不退出非零。",
    );
  } else {
    console.log(
      `[readiness-gate] ${tier} tier 不会强制阻断 readiness gate，仅 inspect 状态。`,
    );
  }

  const client = createStorageClient(
    resolveReadinessClientOptions({
      DATABASE_URL: env.DATABASE_URL,
      DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED,
    }),
  );

  try {
    const status = await getRuntimeReadinessStatus({
      db: client.db,
      env,
    });

    const gate = evaluateReadinessGate(status, { tier, enforce });

    console.log(
      JSON.stringify(
        {
          tier,
          enforce,
          mode: status.mode,
          runtimeGateRequired: status.runtimeGateRequired,
          schemaReady: status.schemaReady,
          bootstrapReady: status.bootstrapReady,
          adminInitializationState: status.adminInitializationState,
          directUrlReady: status.directUrlReady,
          directUrlError: status.directUrlError,
          adminUsersCount: status.adminUsersCount,
          missingTables: status.missingTables,
          runtimeReady: status.runtimeReady,
          blockingReasons: status.blockingReasons,
          lastCheckedAt: status.lastCheckedAt,
          gate: gate.ok ? "pass" : "block",
        },
        null,
        2,
      ),
    );

    if (!gate.ok) {
      console.error(
        `[readiness-gate] production migration / deploy gate 被阻断：${formatBlockingReasons(gate.blockingReasons)}。`,
      );
      process.exit(1);
    }
  } finally {
    await client.close();
  }
};

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("readiness gate 执行失败：", message);
    process.exit(1);
  });
}
