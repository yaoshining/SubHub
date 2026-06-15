import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closePGliteStorageForTesting,
  getStorageClient,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../../helpers/pglite-storage-client";
import { expectApiError } from "../../helpers/api";
import { AppError } from "@/lib/errors";
import { readEnv } from "@/lib/env";
import * as loginRoute from "@/app/api/admin/auth/login/route";
import { createCallerKey } from "@/server/services/caller-key-service";
import { createProvider } from "@/server/services/provider-service";
import { getSystemReadiness } from "@/server/services/settings-service";
import {
  getRuntimeReadinessStatus,
  type RuntimeReadinessStatus,
} from "@/server/services/runtime-readiness-service";
import * as runtimeReadinessService from "@/server/services/runtime-readiness-service";
import { runBootstrap } from "@/server/storage/bootstrap";
import type { StorageDatabase } from "@/server/storage/client";
import { adminUsers } from "@/server/storage/schema";

let tempDir: string;

const productionEnv = () =>
  readEnv({
    NODE_ENV: "production",
    APP_URL: "https://subhub.example.com",
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "main",
    DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub_prod",
    DATABASE_URL_UNPOOLED:
      "postgresql://direct-user@localhost:5432/subhub_prod",
    PROVIDER_CREDENTIAL_ENCRYPTION_KEY:
      "provider-credential-secret-at-least-32",
    ADMIN_SESSION_SECRET: "admin-session-secret-at-least-32",
    CALLER_KEY_SECRET: "caller-key-secret-at-least-32-chars",
  });

const loginRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("production runtime readiness gate", () => {
  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "subhub-production-readiness-"));
    await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await closePGliteStorageForTesting();
    await resetPGliteStorageForTesting();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("schema 未就绪时不会把 production 误判为 runtime ready", async () => {
    const fakeDb = {
      execute: async () => {
        throw new Error('relation "admin_users" does not exist');
      },
    } as unknown as StorageDatabase;

    const status = await getRuntimeReadinessStatus({
      db: fakeDb,
      env: productionEnv(),
      now: new Date("2026-06-11T00:00:00.000Z"),
      directUrlProbe: vi.fn().mockResolvedValue(undefined),
    });

    expect(status).toMatchObject({
      initialized: false,
      mode: "production",
      schemaReady: false,
      bootstrapReady: false,
      adminInitializationState: "required",
      runtimeGateRequired: true,
      directUrlReady: true,
      runtimeReady: false,
      blockingReasons: expect.arrayContaining([
        "schema_not_ready",
        "admin_initialization_required",
      ]),
    });
  });

  it("bootstrap 未完成时明确标记 required admin 并阻断 readiness", async () => {
    await getStorageClient().migrate();

    const status = await getRuntimeReadinessStatus({
      db: getStorageClient().db,
      env: productionEnv(),
      now: new Date("2026-06-11T00:10:00.000Z"),
      directUrlProbe: vi.fn().mockResolvedValue(undefined),
    });

    expect(status).toMatchObject({
      initialized: false,
      schemaReady: true,
      bootstrapReady: false,
      adminInitializationState: "required",
      runtimeReady: false,
      blockingReasons: ["admin_initialization_required"],
    });
  });

  it("完成首个管理员初始化后 production runtime 才转为 ready", async () => {
    await getStorageClient().migrate();
    await runBootstrap({
      db: getStorageClient().db,
      mode: "production",
      now: new Date("2026-06-11T00:20:00.000Z"),
      allowInitialAdminBootstrap: true,
      initialAdminInput: {
        identifier: "owner@example.com",
        displayName: "Owner",
        password: "StrongPass!23",
      },
    });

    const status = await getRuntimeReadinessStatus({
      db: getStorageClient().db,
      env: productionEnv(),
      now: new Date("2026-06-11T00:21:00.000Z"),
      directUrlProbe: vi.fn().mockResolvedValue(undefined),
    });

    expect(status).toMatchObject({
      initialized: true,
      schemaReady: true,
      bootstrapReady: true,
      adminInitializationState: "completed",
      runtimeReady: true,
      blockingReasons: [],
    });
  });

  it("production gate 失败时登录 API 返回明确的 SERVICE_NOT_READY", async () => {
    vi.spyOn(
      runtimeReadinessService,
      "assertProductionRuntimeReady",
    ).mockRejectedValue(
      new AppError(
        "SERVICE_NOT_READY",
        "Production runtime readiness 未通过：DATABASE_URL_UNPOOLED 不可用。",
        "database_url_unpooled",
      ),
    );

    const response = await loginRoute.POST(
      loginRequest({
        identifier: "admin@example.com",
        password: "CorrectHorse42!",
      }),
    );

    expect(response.status).toBe(503);
    await expectApiError(
      response,
      "SERVICE_NOT_READY",
      "Production runtime readiness 未通过：DATABASE_URL_UNPOOLED 不可用。",
    );
  });

  it("即使 admin/provider/caller key 都满足，runtime gate 失败也不会被误判为健康", async () => {
    await getStorageClient().migrate();
    await getStorageClient().db.insert(adminUsers).values({
      id: "admin_1",
      identifier: "admin@example.com",
      displayName: "Admin",
      passwordHash: "hashed-password",
      status: "active",
      role: "admin",
      createdAt: "2026-06-11T00:00:00.000Z",
      updatedAt: "2026-06-11T00:00:00.000Z",
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

    const degradedRuntime: RuntimeReadinessStatus = {
      initialized: true,
      mode: "production",
      schemaReady: true,
      bootstrapReady: true,
      seedState: "not_applicable",
      adminInitializationState: "completed",
      missingTables: [],
      adminUsersCount: 1,
      runtimeGateRequired: true,
      directUrlReady: false,
      directUrlError: "direct url unavailable",
      runtimeReady: false,
      blockingReasons: ["direct_url_unreachable"],
      lastCheckedAt: "2026-06-11T00:30:00.000Z",
    };

    vi.spyOn(
      runtimeReadinessService,
      "getRuntimeReadinessStatus",
    ).mockResolvedValue(degradedRuntime);

    const readiness = await getSystemReadiness({
      db: getStorageClient().db,
      now: new Date("2026-06-11T00:30:00.000Z"),
    });

    expect(readiness).toMatchObject({
      adminInitialized: true,
      activeProviderCount: 1,
      activeCallerKeyCount: 1,
      gatewayReady: false,
      runtimeGateRequired: true,
      runtimeReady: false,
      directUrlReady: false,
      blockingReasons: ["direct_url_unreachable"],
    });
  });
});
