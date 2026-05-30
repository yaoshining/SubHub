import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  selectProviderCredential,
  isolateCredential,
  markCredentialFailure,
  markCredentialUsed,
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

  it("覆盖 active、cooldown、isolated、disabled、exhausted 的可调度状态流转", async () => {
    const now = new Date("2026-05-28T00:00:00.000Z");
    const repository = new ProviderRepository(getStorageClient().db);
    const provider = await repository.createProvider(
      {
        name: "OpenSubtitles",
        type: "opensubtitles",
        initialCredential: {
          label: "active",
          secret: "secret-active-token",
        },
      },
      now,
    );
    const cooldown = await repository.addCredential(
      provider.id,
      {
        label: "cooldown",
        secret: "secret-cooldown-token",
      },
      now,
    );
    const isolated = await repository.addCredential(
      provider.id,
      {
        label: "isolated",
        secret: "secret-isolated-token",
      },
      now,
    );
    const disabled = await repository.addCredential(
      provider.id,
      {
        label: "disabled",
        secret: "secret-disabled-token",
      },
      now,
    );
    const exhausted = await repository.addCredential(
      provider.id,
      {
        label: "exhausted",
        secret: "secret-exhausted-token",
      },
      now,
    );

    await markCredentialFailure(
      provider,
      cooldown.id,
      "rate_limited",
      "429 limited",
      { now },
    );
    await isolateCredential(provider.id, isolated.id, "管理员隔离", { now });
    await repository.updateCredential(
      provider.id,
      disabled.id,
      { status: "disabled" },
      now,
    );
    await markCredentialFailure(
      provider,
      exhausted.id,
      "quota_exhausted",
      "quota exhausted",
      { now },
    );

    const selected = await selectProviderCredential(provider.id, { now });
    const detail = await repository.requireProvider(provider.id, now);

    expect(selected.label).toBe("active");
    expect(detail.credentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: cooldown.id, status: "cooldown" }),
        expect.objectContaining({ id: isolated.id, status: "isolated" }),
        expect.objectContaining({ id: disabled.id, status: "disabled" }),
        expect.objectContaining({ id: exhausted.id, status: "exhausted" }),
      ]),
    );
    expect(detail.availableCredentialCount).toBe(1);

    await restoreCredential(provider.id, isolated.id, { now });
    const restored = await repository.requireProvider(provider.id, now);

    expect(restored.availableCredentialCount).toBe(2);
    expect(
      restored.credentials.filter(
        (credential) => credential.status === "active",
      ),
    ).toHaveLength(2);
    expect(
      restored.credentials.find((credential) => credential.id === disabled.id),
    ).toMatchObject({ status: "disabled" });
  });

  it("禁止通过 restore 重新激活 disabled 凭据", async () => {
    const now = new Date("2026-05-28T00:00:00.000Z");
    const repository = new ProviderRepository(getStorageClient().db);
    const provider = await repository.createProvider(
      {
        name: "OpenSubtitles",
        type: "opensubtitles",
        initialCredential: {
          label: "primary",
          secret: "secret-primary-token",
        },
      },
      now,
    );
    const disabled = await repository.addCredential(
      provider.id,
      {
        label: "disabled",
        secret: "secret-disabled-token",
      },
      now,
    );

    await repository.updateCredential(
      provider.id,
      disabled.id,
      { status: "disabled" },
      now,
    );

    await expect(
      restoreCredential(provider.id, disabled.id, { now }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      target: "credentialId",
    });

    const after = await repository.requireCredential(provider.id, disabled.id);
    expect(after.status).toBe("disabled");
  });

  it("cooldown 到期后可重新参与调度，成功使用后恢复 active", async () => {
    const now = new Date("2026-05-28T00:00:00.000Z");
    const later = new Date("2026-05-28T00:02:00.000Z");
    const repository = new ProviderRepository(getStorageClient().db);
    const provider = await repository.createProvider(
      {
        name: "OpenSubtitles",
        type: "opensubtitles",
        initialCredential: {
          label: "primary",
          secret: "secret-primary-token",
        },
      },
      now,
    );
    const credentialId = provider.credentials[0]!.id;

    await markCredentialFailure(
      provider,
      credentialId,
      "rate_limited",
      "429 limited",
      { now },
    );
    await expect(
      selectProviderCredential(provider.id, { now }),
    ).rejects.toMatchObject({
      code: "PROVIDER_CREDENTIAL_EXHAUSTED",
    });

    const selected = await selectProviderCredential(provider.id, {
      now: later,
    });
    await markCredentialUsed(provider.id, credentialId, { now: later });
    const detail = await repository.requireProvider(provider.id, later);

    expect(selected.id).toBe(credentialId);
    expect(detail.availableCredentialCount).toBe(1);
    expect(
      detail.credentials.find((credential) => credential.id === credentialId),
    ).toMatchObject({ status: "active", cooldownUntil: null });
  });
});
