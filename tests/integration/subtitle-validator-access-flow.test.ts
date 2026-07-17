import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closePGliteStorageForTesting,
  getStorageClient,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../helpers/pglite-storage-client";

import { listSubtitleValidatorProviders } from "@/server/subtitles/admin-subtitle-validator";
import {
  createProvider,
  disableProvider,
} from "@/server/services/provider-service";

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-validator-access-flow-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Subtitle Validator Provider 访问流", () => {
  it("将可用、禁用与受限 provider 一并暴露为可诊断对象", async () => {
    const enabled = await createProvider({
      name: "OpenSubtitles Enabled",
      type: "opensubtitles",
      initialCredential: {
        label: "enabled",
        secret: "enabled-secret",
      },
    });
    const disabled = await createProvider({
      name: "OpenSubtitles Disabled",
      type: "opensubtitles",
      initialCredential: {
        label: "disabled",
        secret: "disabled-secret",
      },
    });
    await disableProvider(disabled.id);

    const result = await listSubtitleValidatorProviders();

    expect(result.total).toBe(3);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: enabled.id,
          status: "enabled",
          supportsSearch: true,
          supportsDownloadValidation: true,
          availableCredentialCount: 1,
        }),
        expect.objectContaining({
          providerId: disabled.id,
          status: "disabled",
          supportsSearch: true,
          supportsDownloadValidation: true,
          availableCredentialCount: 1,
        }),
        expect.objectContaining({
          providerId: "xunlei-default",
          providerKey: "xunlei",
          requiresCredentials: false,
          supportsDirectDownloadUrl: true,
          supportsDownloadValidation: false,
        }),
      ]),
    );
  });
});
