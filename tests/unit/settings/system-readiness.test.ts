import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCallerKey } from "@/server/services/caller-key-service";
import { createProvider } from "@/server/services/provider-service";
import { getSystemReadiness } from "@/server/services/settings-service";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
  type StorageDatabase,
} from "@/server/storage/client";
import { adminUsers } from "@/server/storage/schema";

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-settings-service-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("SystemReadiness 聚合", () => {
  it("在管理员、Provider 与 Caller Key 都缺失时返回未就绪原因", async () => {
    const readiness = await getSystemReadiness({
      now: new Date("2026-05-30T09:00:00.000Z"),
    });

    expect(readiness).toMatchObject({
      environment: "test",
      version: "0.1.0",
      adminInitialized: false,
      activeProviderCount: 0,
      activeCallerKeyCount: 0,
      gatewayReady: false,
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
      version: "0.1.0",
      adminInitialized: true,
      activeProviderCount: 1,
      activeCallerKeyCount: 1,
      gatewayReady: true,
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
      version: "0.1.0",
      adminInitialized: true,
      activeProviderCount: 0,
      activeCallerKeyCount: 2,
      gatewayReady: false,
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
});
