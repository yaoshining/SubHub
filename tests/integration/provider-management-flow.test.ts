import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  adminActionResults,
  type AdminActionResult,
} from "@/server/storage/schema";
import {
  addProviderCredential,
  createProvider,
  isolateProviderCredential,
  restoreProviderCredential,
  updateProvider,
} from "@/server/services/provider-service";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-provider-flow-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Provider 管理闭环", () => {
  it("创建 Provider、新增凭据、隔离、恢复与策略保存均可追踪", async () => {
    const provider = await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });
    const secondary = await addProviderCredential(provider.id, {
      label: "secondary",
      secret: "secondary-api-key",
    });
    const isolated = await isolateProviderCredential(
      provider.id,
      provider.credentials[0]!.id,
      "异常响应",
    );
    const restored = await restoreProviderCredential(
      provider.id,
      provider.credentials[0]!.id,
    );
    const updated = await updateProvider(provider.id, {
      concurrencyLimit: 2,
      cooldownSeconds: 90,
    });

    expect(secondary.status).toBe("active");
    expect(isolated.provider.availableCredentialCount).toBe(1);
    expect(restored.provider.availableCredentialCount).toBe(2);
    expect(updated).toMatchObject({
      concurrencyLimit: 2,
      cooldownSeconds: 90,
    });

    const actions = await getStorageClient()
      .db.select()
      .from(adminActionResults)
      .orderBy(adminActionResults.createdAt);
    expect(actions.map((action: AdminActionResult) => action.actionType)).toEqual([
      "provider_enabled",
      "credential_isolated",
      "credential_restored",
    ]);
    expect(
      actions.every((action: AdminActionResult) => action.result === "success"),
    ).toBe(true);
  });
});
