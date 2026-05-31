import { and, count, desc, eq, inArray, isNotNull, or } from "drizzle-orm";

import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import {
  adminActionResults,
  callerKeys,
  providerCredentials,
  providers,
} from "@/server/storage/schema";
import {
  getSystemReadiness,
  type SystemReadiness,
} from "@/server/services/settings-service";

export type DashboardSummary = {
  readiness: SystemReadiness;
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
  const readiness = await getSystemReadiness({ db, now });
  const providerRows = await db
    .select()
    .from(providers)
    .orderBy(providers.priority, providers.name)
    .limit(dashboardProviderSnapshotLimit);
  const providerIds = providerRows.map((provider: any) => provider.id);
  const credentialRows =
    providerIds.length > 0
      ? await db
          .select({
            providerId: providerCredentials.providerId,
            activeCredentialCount: count(),
          })
          .from(providerCredentials)
          .where(
            and(
              eq(providerCredentials.status, "active"),
              inArray(providerCredentials.providerId, providerIds),
            ),
          )
          .groupBy(providerCredentials.providerId)
      : [];
  const providerTotalCount = await countRows(
    db.select({ value: count() }).from(providers),
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
      credential.activeCredentialCount,
    );
  }

  const providerItems = providerRows.map((provider: any) => {
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
  const nextActions = [
    ...(readiness.adminInitialized
      ? []
      : [
          {
            id: "create-admin",
            label: "创建首个管理员",
            href: "/login",
            priority: "high" as const,
          },
        ]),
    ...(readiness.activeProviderCount > 0
      ? []
      : [
          {
            id: "configure-provider",
            label: "配置可用 Provider",
            href: "/providers",
            priority: "high" as const,
          },
        ]),
    ...(readiness.activeCallerKeyCount > 0
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
    readiness,
    northStar: {
      status: readiness.gatewayReady ? "ready" : "not_ready",
      message: readiness.gatewayReady
        ? "统一字幕出口已具备基础服务条件。"
        : "当前实例尚未完成首轮服务条件，请优先处理缺失项。",
    },
    providerSnapshot: {
      total: providerTotalCount,
      available: readiness.activeProviderCount,
      needsAttention: needsAttentionProviderCount,
      items: providerItems,
    },
    callerKeySnapshot: {
      active: readiness.activeCallerKeyCount,
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
    recentIssues: failedActions.map((action: any) => ({
      id: action.id,
      targetType: action.targetType,
      targetId: action.targetId,
      message: action.message,
      createdAt: action.createdAt,
    })),
    nextActions,
  };
}
