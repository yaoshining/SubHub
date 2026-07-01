import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getStorageClient,
  closePGliteStorageForTesting,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../helpers/pglite-storage-client";

import {
  adminActionResults,
  type AdminActionResult,
} from "@/server/storage/schema";
import {
  addProviderCredential,
  createProvider,
  disableProvider,
  getProviderDetail,
  isolateProviderCredential,
  listProviders,
  restoreProviderCredential,
  updateProvider,
} from "@/server/services/provider-service";

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-provider-flow-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
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
    expect(
      actions.map((action: AdminActionResult) => action.actionType),
    ).toEqual([
      "provider_enabled",
      "credential_isolated",
      "credential_restored",
    ]);
    expect(
      actions.every((action: AdminActionResult) => action.result === "success"),
    ).toBe(true);
  });

  it("Xunlei 与 OpenSubtitles 并存时列表同时包含两者，Xunlei detail 的 credentials 为空数组", async () => {
    const created = await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    // List all providers — should include both
    const { items } = await listProviders();
    const providerIds = items.map((p) => p.id);
    expect(providerIds).toContain("xunlei-default");
    expect(providerIds).toContain(created.id);

    // List with type filter
    const xunleiProviders = await listProviders({ type: "xunlei" });
    expect(xunleiProviders.items).toHaveLength(1);
    expect(xunleiProviders.items[0]!.type).toBe("xunlei");

    const opensubtitlesProviders = await listProviders({
      type: "opensubtitles",
    });
    expect(opensubtitlesProviders.items.length).toBeGreaterThanOrEqual(1);
    expect(
      opensubtitlesProviders.items.every(
        (p: { type: string }) => p.type === "opensubtitles",
      ),
    ).toBe(true);

    // List with status filter — first disable the created provider
    await disableProvider(created.id);
    const disabledProviders = await listProviders({ status: "disabled" });
    expect(disabledProviders.items.length).toBeGreaterThan(0);
    expect(
      disabledProviders.items.every(
        (p: { status: string }) => p.status === "disabled",
      ),
    ).toBe(true);

    // Xunlei detail — credentials should be empty
    const xunleiDetail = await getProviderDetail("xunlei-default");
    expect(xunleiDetail.id).toBe("xunlei-default");
    expect(xunleiDetail.type).toBe("xunlei");
    expect(xunleiDetail.credentials).toEqual([]);
  });
});
