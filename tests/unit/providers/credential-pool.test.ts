import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  selectProviderCredential,
  isolateCredential,
  restoreCredential,
} from "@/server/providers/credential-pool";
import { ProviderRepository } from "@/server/providers/provider-repository";
import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "@/server/storage/client";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-credential-pool-"));
  setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  getStorageClient().migrate();
});

afterEach(() => {
  closeStorageClient();
  resetStorageDatabasePathForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Provider 凭据池", () => {
  it("只选择 active 且未冷却的凭据，并可解密供 adapter 使用", async () => {
    const repository = new ProviderRepository(getStorageClient().db);
    const provider = await repository.createProvider({
      name: "OpenSubtitles",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "secret-primary-token",
      },
    });

    const selected = await selectProviderCredential(provider.id);

    expect(selected.label).toBe("primary");
    expect(selected.secret).toBe("secret-primary-token");
    expect(selected).not.toHaveProperty("secretEncrypted");
    expect(selected).not.toHaveProperty("secretHash");
  });

  it("隔离单个异常凭据不会影响同 Provider 下其他 active 凭据", async () => {
    const repository = new ProviderRepository(getStorageClient().db);
    const provider = await repository.createProvider({
      name: "OpenSubtitles",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "secret-primary-token",
      },
    });
    const secondary = await repository.addCredential(provider.id, {
      label: "secondary",
      secret: "secret-secondary-token",
    });

    await isolateCredential(
      provider.id,
      provider.credentials[0]!.id,
      "429 限流",
    );
    const afterIsolate = await repository.requireProvider(provider.id);
    const selected = await selectProviderCredential(provider.id);

    expect(afterIsolate.availableCredentialCount).toBe(1);
    expect(selected.id).toBe(secondary.id);
    expect(selected.status).toBe("active");
  });

  it("恢复被隔离凭据后重新进入 active 调度池", async () => {
    const repository = new ProviderRepository(getStorageClient().db);
    const provider = await repository.createProvider({
      name: "OpenSubtitles",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "secret-primary-token",
      },
    });
    const credentialId = provider.credentials[0]!.id;

    await isolateCredential(provider.id, credentialId, "管理员隔离");
    await restoreCredential(provider.id, credentialId);
    const restored = await repository.requireCredential(
      provider.id,
      credentialId,
    );

    expect(restored.status).toBe("active");
    expect(restored.lastErrorSummary).toBeNull();
  });

  it("所有凭据均不可用时返回明确的凭据池耗尽错误", async () => {
    const repository = new ProviderRepository(getStorageClient().db);
    const provider = await repository.createProvider({
      name: "OpenSubtitles",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "secret-primary-token",
      },
    });

    await isolateCredential(provider.id, provider.credentials[0]!.id, "异常");

    await expect(selectProviderCredential(provider.id)).rejects.toMatchObject({
      code: "PROVIDER_CREDENTIAL_EXHAUSTED",
      target: "credential_pool",
    });
  });
});
