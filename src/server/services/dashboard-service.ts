import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNotNull,
  or,
} from "drizzle-orm";

import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import {
  adminActionResults,
  adminUsers,
  callerKeys,
  providerCredentials,
  providers,
} from "@/server/storage/schema";

export type DashboardSummary = {
  readiness: {
    adminInitialized: boolean;
    activeProviderCount: number;
    activeCallerKeyCount: number;
    gatewayReady: boolean;
    missingConditions: Array<"admin" | "provider" | "caller_key">;
    lastCheckedAt: string;
  };
  northStar: {
    status: "ready" | "not_ready";
    message: string;
  };
  providerSnapshot: {
    total: number;
    available: number;
    needsAttention: number;
    items: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      activeCredentialCount: number;
      lastHealthStatus: string | null;
      lastErrorSummary: string | null;
    }>;
  };
  callerKeySnapshot: {
    active: number;
    suspended: number;
    rotated: number;
  };
  queue: {
    status: "idle";
    pendingJobs: number;
    failedJobs: number;
  };
  cache: {
    status: "not_configured";
    hitRate: number | null;
    coverage: "not_available";
  };
  recentIssues: Array<{
    id: string;
    targetType: string;
    targetId: string | null;
    message: string | null;
    createdAt: string;
  }>;
  nextActions: Array<{
    id: string;
    label: string;
    href: string;
    priority: "high" | "medium";
  }>;
};

export type DashboardServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
};

const dashboardProviderSnapshotLimit = 100;

async function countRows(
  query: Promise<Array<{ value: number }>>,
): Promise<number> {
  const [row] = await query;
  return row?.value ?? 0;
}

export async function getDashboardSummary({
  db = getStorageClient().db,
  now = new Date(),
}: DashboardServiceOptions = {}): Promise<DashboardSummary> {
  const [adminUser] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .limit(1);
  const providerRows = await db
    .select()
    .from(providers)
    .orderBy(providers.priority, providers.name)
    .limit(dashboardProviderSnapshotLimit);
  const providerIds = providerRows.map((provider) => provider.id);
  const credentialRows =
    providerIds.length > 0
      ? await db
          .select({ providerId: providerCredentials.providerId })
          .from(providerCredentials)
          .where(
            and(
              eq(providerCredentials.status, "active"),
              inArray(providerCredentials.providerId, providerIds),
            ),
          )
      : [];
  const providerTotalCount = await countRows(
    db.select({ value: count() }).from(providers),
  );
  const activeProviderCount = await countRows(
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
  );
  const needsAttentionProviderCount = await countRows(
    db
      .select({ value: count() })
      .from(providers)
      .where(
        or(
          eq(providers.status, "degraded"),
          eq(providers.status, "needs_config"),
          isNotNull(providers.lastErrorSummary),
        ),
      ),
  );
  const activeCallerKeyCount = await countRows(
    db
      .select({ value: count() })
      .from(callerKeys)
      .where(eq(callerKeys.status, "active")),
  );
  const suspendedCallerKeyCount = await countRows(
    db
      .select({ value: count() })
      .from(callerKeys)
      .where(eq(callerKeys.status, "suspended")),
  );
  const rotatedCallerKeyCount = await countRows(
    db
      .select({ value: count() })
      .from(callerKeys)
      .where(eq(callerKeys.status, "rotated")),
  );
  const failedActions = await db
    .select()
    .from(adminActionResults)
    .where(eq(adminActionResults.result, "failed"))
    .orderBy(desc(adminActionResults.createdAt))
    .limit(5);

  const activeCredentialCountByProvider = new Map<string, number>();
  for (const credential of credentialRows) {
    activeCredentialCountByProvider.set(
      credential.providerId,
      (activeCredentialCountByProvider.get(credential.providerId) ?? 0) + 1,
    );
  }

  const providerItems = providerRows.map((provider) => {
    const activeCredentialCount =
      activeCredentialCountByProvider.get(provider.id) ?? 0;

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      status: provider.status,
      activeCredentialCount,
      lastHealthStatus: provider.lastHealthStatus,
      lastErrorSummary: provider.lastErrorSummary,
    };
  });
  const missingConditions: DashboardSummary["readiness"]["missingConditions"] =
    [];
  if (!adminUser) {
    missingConditions.push("admin");
  }
  if (activeProviderCount === 0) {
    missingConditions.push("provider");
  }
  if (activeCallerKeyCount === 0) {
    missingConditions.push("caller_key");
  }
  const gatewayReady = missingConditions.length === 0;
  const nextActions = [
    ...(adminUser
      ? []
      : [
          {
            id: "create-admin",
            label: "创建首个管理员",
            href: "/login",
            priority: "high" as const,
          },
        ]),
    ...(activeProviderCount > 0
      ? []
      : [
          {
            id: "configure-provider",
            label: "配置可用 Provider",
            href: "/providers",
            priority: "high" as const,
          },
        ]),
    ...(activeCallerKeyCount > 0
      ? []
      : [
          {
            id: "create-caller-key",
            label: "创建调用方 Key",
            href: "/api-keys",
            priority: "medium" as const,
          },
        ]),
  ];

  return {
    readiness: {
      adminInitialized: Boolean(adminUser),
      activeProviderCount,
      activeCallerKeyCount,
      gatewayReady,
      missingConditions,
      lastCheckedAt: now.toISOString(),
    },
    northStar: {
      status: gatewayReady ? "ready" : "not_ready",
      message: gatewayReady
        ? "统一字幕出口已具备基础服务条件。"
        : "当前实例尚未完成首轮服务条件，请优先处理缺失项。",
    },
    providerSnapshot: {
      total: providerTotalCount,
      available: activeProviderCount,
      needsAttention: needsAttentionProviderCount,
      items: providerItems,
    },
    callerKeySnapshot: {
      active: activeCallerKeyCount,
      suspended: suspendedCallerKeyCount,
      rotated: rotatedCallerKeyCount,
    },
    queue: {
      status: "idle",
      pendingJobs: 0,
      failedJobs: 0,
    },
    cache: {
      status: "not_configured",
      hitRate: null,
      coverage: "not_available",
    },
    recentIssues: failedActions.map((action) => ({
      id: action.id,
      targetType: action.targetType,
      targetId: action.targetId,
      message: action.message,
      createdAt: action.createdAt,
    })),
    nextActions,
  };
}
