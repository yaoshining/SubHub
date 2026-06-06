import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closePGliteStorageForTesting,
  getStorageClient,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../../helpers/pglite-storage-client";
import {
  applyManagedSeed,
  inspectBootstrapState,
  resetBootstrapRuntimeMarkersForTesting,
  runBootstrap,
} from "@/server/storage/bootstrap";
import { providers } from "@/server/storage/schema";

let tempDir: string;

describe("storage/bootstrap", () => {
  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "subhub-bootstrap-unit-"));
    resetBootstrapRuntimeMarkersForTesting();
    await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  });

  afterEach(async () => {
    await closePGliteStorageForTesting();
    await resetPGliteStorageForTesting();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("在 development 基线下报告 pending seed 与 required admin", async () => {
    const inspection = await inspectBootstrapState({
      db: getStorageClient().db,
      mode: "development",
      now: new Date("2026-06-05T00:00:00.000Z"),
    });

    expect(inspection.missingTables).toEqual([]);
    expect(inspection.state).toMatchObject({
      schemaReady: true,
      bootstrapReady: true,
      seedState: "pending",
      adminInitializationState: "required",
    });
  });

  it("只在显式允许时通过 bootstrap 创建首个管理员", async () => {
    await expect(
      runBootstrap({
        db: getStorageClient().db,
        mode: "production",
        now: new Date("2026-06-05T00:00:00.000Z"),
        initialAdminInput: {
          identifier: "owner@example.com",
          displayName: "Owner",
          password: "StrongPass!23",
        },
      }),
    ).rejects.toThrow(/显式禁用/);

    const allowedResult = await runBootstrap({
      db: getStorageClient().db,
      mode: "production",
      now: new Date("2026-06-05T00:00:00.000Z"),
      allowInitialAdminBootstrap: true,
      initialAdminInput: {
        identifier: "owner@example.com",
        displayName: "Owner",
        password: "StrongPass!23",
      },
    });

    expect(allowedResult.createdInitialAdmin).toBe(true);
    expect(allowedResult.state).toMatchObject({
      seedState: "not_applicable",
      adminInitializationState: "completed",
    });
  });

  it("对 non-production seed 保持幂等且阻止 production seed", async () => {
    const firstRun = await applyManagedSeed({
      db: getStorageClient().db,
      mode: "development",
      now: new Date("2026-06-05T00:00:00.000Z"),
    });
    const secondRun = await applyManagedSeed({
      db: getStorageClient().db,
      mode: "development",
      now: new Date("2026-06-05T00:01:00.000Z"),
    });

    const seededProviders = await getStorageClient()
      .db.select({
        id: providers.id,
        name: providers.name,
        status: providers.status,
      })
      .from(providers);

    expect(firstRun).toMatchObject({
      insertedProviders: 1,
      updatedProviders: 0,
      seedProviderId: "seed_provider_development_opensubtitles",
    });
    expect(secondRun).toMatchObject({
      insertedProviders: 0,
      updatedProviders: 1,
      seedProviderId: "seed_provider_development_opensubtitles",
    });
    expect(seededProviders).toEqual([
      {
        id: "seed_provider_development_opensubtitles",
        name: "Seed development OpenSubtitles",
        status: "needs_config",
      },
    ]);

    await expect(
      applyManagedSeed({
        db: getStorageClient().db,
        mode: "production",
      }),
    ).rejects.toThrow(/production 禁止执行 seed/);
  });
});
