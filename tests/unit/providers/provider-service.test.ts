import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getStorageClient,
  closePGliteStorageForTesting,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../../helpers/pglite-storage-client";
import {
  createProvider,
  disableProvider,
  enableProvider,
  isolateProviderCredential,
  restoreProviderCredential,
  updateProvider,
} from "@/server/services/provider-service";

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-provider-service-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Provider service 状态流转", () => {
  it("带初始凭据创建 OpenSubtitles Provider 后进入 enabled 并隐藏明文", async () => {
    const provider = await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    expect(provider.status).toBe("enabled");
    expect(provider.availableCredentialCount).toBe(1);
    expect(provider.credentials[0]).toMatchObject({
      label: "primary",
      displayPrefix: "open",
      displaySuffix: "-key",
      status: "active",
    });
    expect(provider.credentials[0]).not.toHaveProperty("secret");
    expect(provider.credentials[0]).not.toHaveProperty("secretEncrypted");
    expect(provider.credentials[0]).not.toHaveProperty("secretHash");
  });

  it("无凭据 Provider 保持 needs_config，启用时返回凭据池错误", async () => {
    const provider = await createProvider({
      name: "OpenSubtitles Empty",
      type: "opensubtitles",
    });

    expect(provider.status).toBe("needs_config");
    await expect(enableProvider(provider.id)).rejects.toMatchObject({
      code: "PROVIDER_CREDENTIAL_EXHAUSTED",
      target: "credential_pool",
    });
  });

  it("支持停用、恢复启用和运行策略更新", async () => {
    const provider = await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    const disabled = await disableProvider(provider.id);
    const enabled = await enableProvider(provider.id);
    const updated = await updateProvider(provider.id, {
      name: "OpenSubtitles Updated",
      priority: 10,
      concurrencyLimit: 2,
      rotationEnabled: false,
      cooldownSeconds: 120,
    });

    expect(disabled.status).toBe("disabled");
    expect(enabled.status).toBe("enabled");
    expect(updated).toMatchObject({
      name: "OpenSubtitles Updated",
      priority: 10,
      concurrencyLimit: 2,
      rotationEnabled: false,
      cooldownSeconds: 120,
    });
  });

  it("最后一个 active 凭据被隔离时 Provider 降级，恢复后重新 enabled", async () => {
    const provider = await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });
    const credentialId = provider.credentials[0]!.id;

    const isolated = await isolateProviderCredential(
      provider.id,
      credentialId,
      "上游认证失败",
    );
    const restored = await restoreProviderCredential(provider.id, credentialId);

    expect(isolated.provider.status).toBe("degraded");
    expect(isolated.provider.availableCredentialCount).toBe(0);
    expect(restored.provider.status).toBe("enabled");
    expect(restored.provider.availableCredentialCount).toBe(1);
  });

  it("拒绝重复隔离已移出活跃池的凭据", async () => {
    const provider = await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });
    const credentialId = provider.credentials[0]!.id;

    await isolateProviderCredential(provider.id, credentialId, "上游认证失败");

    await expect(
      isolateProviderCredential(provider.id, credentialId, "重复隔离"),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      target: "credentialId",
      message: "当前凭据已经不在活跃池中，无需重复隔离。",
    });
  });

  it("同类型 Provider 名称必须可区分", async () => {
    await createProvider({ name: "OpenSubtitles", type: "opensubtitles" });

    await expect(
      createProvider({ name: "OpenSubtitles", type: "opensubtitles" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      target: "name",
    });
  });

  it("无效 Provider 类型返回通用校验错误", async () => {
    await expect(
      createProvider({ name: "Invalid Type", type: "unknown" as never }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      target: "provider",
    });
  });

  it("无效 fallbackProviderId 返回对应字段错误", async () => {
    const provider = await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
    });

    await expect(
      updateProvider(provider.id, { fallbackProviderId: "provider_missing" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      target: "fallbackProviderId",
    });
  });
});
