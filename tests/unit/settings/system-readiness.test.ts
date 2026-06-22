import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../../package.json";
import type { StorageDatabase } from "@/server/storage/client";

import {
  getStorageClient,
  closePGliteStorageForTesting,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../../helpers/pglite-storage-client";

import { createCallerKey } from "@/server/services/caller-key-service";
import { createProvider } from "@/server/services/provider-service";
import { getSystemReadiness } from "@/server/services/settings-service";
import * as envModule from "@/lib/env";
import * as runtimeReadinessService from "@/server/services/runtime-readiness-service";
import { adminUsers } from "@/server/storage/schema";

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-settings-service-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("SystemReadiness 聚合", () => {
  it("在管理员、Provider 与 Caller Key 都缺失时返回未就绪原因", async () => {
    const readiness = await getSystemReadiness({
      now: new Date("2026-05-30T09:00:00.000Z"),
    });

    expect(readiness).toMatchObject({
      environment: "test",
      version: packageJson.version,
      adminInitialized: false,
      activeProviderCount: 0,
      activeCallerKeyCount: 0,
      gatewayReady: false,
      runtimeGateRequired: false,
      runtimeReady: true,
      schemaReady: true,
      bootstrapReady: true,
      adminInitializationState: "required",
      directUrlReady: true,
      directUrlError: null,
      blockingReasons: [],
      missingConditions: ["admin", "provider", "caller_key"],
      partialErrors: [],
      lastCheckedAt: "2026-05-30T09:00:00.000Z",
    });
  });

  it("在管理员、Provider 与 Caller Key 都可用时返回 ready", async () => {
    await getStorageClient().db.insert(adminUsers).values({
      id: "admin_1",
      identifier: "admin@example.com",
      displayName: "Admin",
      passwordHash: "hashed-password",
      status: "active",
      role: "admin",
      createdAt: "2026-05-30T00:00:00.000Z",
      updatedAt: "2026-05-30T00:00:00.000Z",
      lastLoginAt: null,
    });
    await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });
    await createCallerKey({
      callerName: "Jellyfin Home",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    const readiness = await getSystemReadiness({
      now: new Date("2026-05-30T10:00:00.000Z"),
    });

    expect(readiness).toMatchObject({
      environment: "test",
      version: packageJson.version,
      adminInitialized: true,
      activeProviderCount: 1,
      activeCallerKeyCount: 1,
      gatewayReady: true,
      runtimeGateRequired: false,
      runtimeReady: true,
      schemaReady: true,
      bootstrapReady: true,
      adminInitializationState: "completed",
      directUrlReady: true,
      directUrlError: null,
      blockingReasons: [],
      missingConditions: [],
      partialErrors: [],
      lastCheckedAt: "2026-05-30T10:00:00.000Z",
    });
  });

  it("局部读数失败时保留已知信息并指出失败对象", async () => {
    let selectCount = 0;
    const fakeDb = {
      select: () => ({
        from: () => {
          selectCount += 1;
          if (selectCount === 1) {
            return {
              limit: async () => [{ id: "admin_1" }],
            };
          }
          if (selectCount === 2) {
            return {
              innerJoin: () => ({
                where: async () => {
                  throw new Error("provider summary unavailable");
                },
              }),
            };
          }
          return {
            where: async () => [{ value: 2 }],
          };
        },
      }),
    } as unknown as StorageDatabase;

    const readiness = await getSystemReadiness({
      db: fakeDb,
      now: new Date("2026-05-30T10:30:00.000Z"),
    });

    expect(readiness).toMatchObject({
      environment: "test",
      version: packageJson.version,
      adminInitialized: true,
      activeProviderCount: 0,
      activeCallerKeyCount: 2,
      gatewayReady: false,
      runtimeGateRequired: false,
      runtimeReady: true,
      schemaReady: false,
      bootstrapReady: false,
      adminInitializationState: "required",
      directUrlReady: true,
      directUrlError: null,
      blockingReasons: [],
      missingConditions: [],
      lastCheckedAt: "2026-05-30T10:30:00.000Z",
      partialErrors: [
        {
          target: "provider",
          code: "UPSTREAM_FAILED",
          message: "provider summary unavailable",
        },
      ],
    });
  });

  it("非 test 环境返回 resolvedTier 作为部署环境读数", async () => {
    const readEnvSpy = vi.spyOn(envModule, "readEnv").mockReturnValue({
      NODE_ENV: "production",
      APP_URL: "https://preview-subhub-example.vercel.app",
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
      OPENSUBTITLES_API_URL: "https://api.opensubtitles.com/api/v3",
      deploymentProvider: "vercel",
      vercelEnvironment: "preview",
      gitBranch: "preview",
      resolvedTier: "staging",
      isPreviewDeployment: true,
      requiresDirectMigrationGate: true,
    });

    try {
      const readiness = await getSystemReadiness({
        now: new Date("2026-05-30T11:00:00.000Z"),
      });

      expect(readiness.environment).toBe("staging");
      expect(readiness.runtimeGateRequired).toBe(false);
    } finally {
      readEnvSpy.mockRestore();
    }
  });

  it("production 下 runtime 读数失败时使用保守 fallback 并标记 runtime partial error", async () => {
    const readEnvSpy = vi.spyOn(envModule, "readEnv").mockReturnValue({
      NODE_ENV: "production",
      APP_URL: "https://subhub.example.com",
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
      OPENSUBTITLES_API_URL: "https://api.opensubtitles.com/api/v3",
      deploymentProvider: "vercel",
      vercelEnvironment: "production",
      gitBranch: "main",
      resolvedTier: "production",
      isPreviewDeployment: false,
      requiresDirectMigrationGate: true,
    });

    const fakeDb = {
      select: () => ({
        from: () => ({
          limit: async () => [{ id: "admin_1" }],
          innerJoin: () => ({
            where: async () => [{ value: 1 }],
          }),
          where: async () => [{ value: 1 }],
        }),
      }),
    } as unknown as StorageDatabase;
    const runtimeSpy = vi
      .spyOn(runtimeReadinessService, "getRuntimeReadinessStatus")
      .mockRejectedValue(new Error("runtime status unavailable"));

    try {
      const readiness = await getSystemReadiness({
        db: fakeDb,
        now: new Date("2026-05-30T12:00:00.000Z"),
      });

      expect(readiness).toMatchObject({
        gatewayReady: false,
        runtimeGateRequired: true,
        runtimeReady: false,
        schemaReady: false,
        bootstrapReady: false,
        directUrlReady: false,
        blockingReasons: [
          "direct_url_unreachable",
          "schema_not_ready",
          "admin_initialization_required",
        ],
        partialErrors: [
          expect.objectContaining({
            target: "runtime",
            code: "UPSTREAM_FAILED",
            message: "runtime status unavailable",
          }),
        ],
      });
    } finally {
      runtimeSpy.mockRestore();
      readEnvSpy.mockRestore();
    }
  });
});
