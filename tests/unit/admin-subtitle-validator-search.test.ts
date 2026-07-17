import { describe, expect, it, vi } from "vitest";

import { searchSubtitleValidator } from "@/server/subtitles/admin-subtitle-validator";
import type { SubtitleProviderAdapter } from "@/server/providers/provider-adapter";
import type { ProviderWithCredentialSummary } from "@/server/providers/provider-repository";

const createProvider = (
  overrides: Partial<ProviderWithCredentialSummary> = {},
): ProviderWithCredentialSummary => ({
  id: "provider-os-primary",
  name: "OpenSubtitles Primary",
  type: "opensubtitles",
  status: "enabled",
  priority: 1,
  weight: 100,
  concurrencyLimit: 2,
  rotationEnabled: true,
  cooldownSeconds: 30,
  fallbackProviderId: null,
  lastHealthStatus: "ready",
  lastHealthCheckedAt: null,
  lastErrorSummary: null,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
  activeCredentialCount: 1,
  availableCredentialCount: 1,
  credentialCount: 1,
  ...overrides,
});

const emptyAdapter: SubtitleProviderAdapter = {
  key: "opensubtitles",
  search: vi.fn().mockResolvedValue({ ok: true, skipped: false, results: [] }),
};

describe("admin subtitle validator search", () => {
  it("按 providerId 精确执行一个实例，并映射 OpenSubtitles 参数", async () => {
    const selected = createProvider();
    const sibling = createProvider({
      id: "provider-os-secondary",
      name: "OpenSubtitles Secondary",
    });
    const selectCredential = vi.fn().mockResolvedValue({
      id: "credential-1",
      secret: "secret",
    });

    const result = await searchSubtitleValidator(
      {
        providerId: selected.id,
        baseParams: { keyword: "The Matrix" },
        providerParams: {
          language: "en",
          season: 1,
          episode: 2,
          imdbId: "tt0133093",
          tmdbId: 603,
        },
      },
      {
        db: {} as never,
        listProviders: vi.fn().mockResolvedValue([selected, sibling]),
        getAdapter: vi.fn().mockReturnValue(emptyAdapter),
        selectCredential,
        markCredentialUsed: vi.fn(),
        markCredentialFailure: vi.fn(),
      },
    );

    expect(result.status).toBe("empty");
    expect(emptyAdapter.search).toHaveBeenCalledWith(
      { id: "credential-1", secret: "secret" },
      {
        title: "The Matrix",
        query: undefined,
        year: undefined,
        season: 1,
        episode: 2,
        language: "en",
        imdbId: "tt0133093",
        tmdbId: 603,
        type: undefined,
      },
    );
    expect(selectCredential).toHaveBeenCalledTimes(1);
    expect(selectCredential).toHaveBeenCalledWith(
      selected.id,
      expect.anything(),
    );
  });

  it("拒绝当前 provider 不支持的参数", async () => {
    const provider = createProvider({ id: "xunlei-default", type: "xunlei" });

    await expect(
      searchSubtitleValidator(
        {
          providerId: provider.id,
          baseParams: { keyword: "The Matrix" },
          providerParams: { season: 1 },
        },
        {
          db: {} as never,
          listProviders: vi.fn().mockResolvedValue([provider]),
          getAdapter: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      target: "providerParams.season",
    });
  });

  it("将 provider 返回的缺失参数与超时分别归类", async () => {
    const xunlei = createProvider({
      id: "xunlei-default",
      type: "xunlei",
      availableCredentialCount: 0,
      credentialCount: 0,
      activeCredentialCount: 0,
    });
    const missingFieldsAdapter: SubtitleProviderAdapter = {
      key: "xunlei",
      search: vi.fn().mockResolvedValue({
        ok: true,
        skipped: true,
        error: { reason: "missing_required_field" },
      }),
    };

    await expect(
      searchSubtitleValidator(
        {
          providerId: xunlei.id,
          baseParams: { keyword: "The Matrix" },
          providerParams: {},
        },
        {
          db: {} as never,
          listProviders: vi.fn().mockResolvedValue([xunlei]),
          getAdapter: vi.fn().mockReturnValue(missingFieldsAdapter),
        },
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      target: "providerParams",
    });

    const timeoutAdapter: SubtitleProviderAdapter = {
      key: "xunlei",
      search: vi.fn().mockResolvedValue({
        ok: false,
        skipped: false,
        error: { reason: "timeout", message: "upstream timeout token=secret" },
      }),
    };
    await expect(
      searchSubtitleValidator(
        {
          providerId: xunlei.id,
          baseParams: { keyword: "The Matrix" },
          providerParams: { query: "The Matrix", language: "zh-CN" },
        },
        {
          db: {} as never,
          listProviders: vi.fn().mockResolvedValue([xunlei]),
          getAdapter: vi.fn().mockReturnValue(timeoutAdapter),
        },
      ),
    ).rejects.toMatchObject({
      code: "TIMEOUT",
      message: expect.not.stringContaining("secret"),
    });
  });
});
