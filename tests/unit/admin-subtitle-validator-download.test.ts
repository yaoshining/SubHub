import { describe, expect, it, vi } from "vitest";

import { validateSubtitleDownload } from "@/server/subtitles/admin-subtitle-validator";
import type { ProviderWithCredentialSummary } from "@/server/providers/provider-repository";
import type { SubtitleProviderAdapter } from "@/server/providers/provider-adapter";

const createProvider = (
  overrides: Partial<ProviderWithCredentialSummary> = {},
): ProviderWithCredentialSummary => ({
  id: "provider-os",
  name: "OpenSubtitles",
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
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z",
  activeCredentialCount: 1,
  availableCredentialCount: 1,
  credentialCount: 1,
  ...overrides,
});

describe("admin subtitle validator download", () => {
  it("将 Xunlei 浏览器下载明确标为不支持，而不发起上游请求", async () => {
    const fetchImpl = vi.fn();

    const result = await validateSubtitleDownload(
      {
        providerId: "provider-xl",
        resultId: "xunlei:provider-xl:subtitle-1",
        mode: "browser_download",
      },
      {
        db: {} as never,
        listProviders: vi.fn().mockResolvedValue([
          createProvider({
            id: "provider-xl",
            name: "Xunlei",
            type: "xunlei",
            availableCredentialCount: 0,
            activeCredentialCount: 0,
            credentialCount: 0,
          }),
        ]),
        fetchImpl,
      },
    );

    expect(result).toMatchObject({
      status: "unsupported",
      provider: "xunlei",
      downloadMode: "browser_download",
      httpStatus: null,
      diagnostic: {
        errorCategory: "unsupported",
        nextActionHint: expect.stringContaining("支持的下载验证模式"),
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("将缺少 Xunlei 直链单独标为 missing_download", async () => {
    const result = await validateSubtitleDownload(
      {
        providerId: "provider-xl",
        resultId: "xunlei:provider-xl:subtitle-1",
        mode: "url_check",
      },
      {
        db: {} as never,
        listProviders: vi.fn().mockResolvedValue([
          createProvider({
            id: "provider-xl",
            name: "Xunlei",
            type: "xunlei",
            availableCredentialCount: 0,
            activeCredentialCount: 0,
            credentialCount: 0,
          }),
        ]),
      },
    );

    expect(result).toMatchObject({
      status: "missing_download",
      message: "该结果没有可验证的下载地址。",
      diagnostic: {
        errorCategory: "missing_download",
      },
    });
  });

  it("对 Xunlei HTTPS 直链执行不携带凭据的 URL 检查", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));

    const result = await validateSubtitleDownload(
      {
        providerId: "provider-xl",
        resultId: "xunlei:provider-xl:subtitle-1",
        mode: "url_check",
        downloadReference: "https://downloads.example.com/subtitle.srt",
      },
      {
        db: {} as never,
        listProviders: vi.fn().mockResolvedValue([
          createProvider({
            id: "provider-xl",
            name: "Xunlei",
            type: "xunlei",
            availableCredentialCount: 0,
            activeCredentialCount: 0,
            credentialCount: 0,
          }),
        ]),
        fetchImpl,
      },
    );

    expect(result).toMatchObject({
      status: "success",
      httpStatus: 204,
      message: "下载 URL 可访问。",
      downloadMode: "url_check",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://downloads.example.com/subtitle.srt",
      expect.objectContaining({ method: "HEAD", redirect: "follow" }),
    );
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("headers");
  });

  it("将不安全或不可访问的下载地址标为 failed，且不回显敏感查询参数", async () => {
    const fetchImpl = vi.fn();
    const provider = createProvider({
      id: "provider-xl",
      name: "Xunlei",
      type: "xunlei",
      availableCredentialCount: 0,
      activeCredentialCount: 0,
      credentialCount: 0,
    });

    const unsafeResult = await validateSubtitleDownload(
      {
        providerId: provider.id,
        resultId: `xunlei:${provider.id}:subtitle-1`,
        mode: "url_check",
        downloadReference: "http://127.0.0.1/internal?token=secret-value",
      },
      {
        db: {} as never,
        listProviders: vi.fn().mockResolvedValue([provider]),
        fetchImpl,
      },
    );

    expect(unsafeResult.status).toBe("failed");
    expect(JSON.stringify(unsafeResult)).not.toContain("secret-value");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("将 OpenSubtitles 浏览器下载成功与上游失败映射为不同结果状态", async () => {
    const provider = createProvider();
    const adapter = {
      key: "opensubtitles" as const,
      search: vi.fn(),
      download: vi.fn().mockResolvedValue({
        content: "subtitle content",
        contentType: "application/x-subrip",
        fileName: "matrix.srt",
      }),
    } satisfies SubtitleProviderAdapter & {
      download: (
        credentialSecret: string,
        subtitleId: string,
      ) => Promise<{ content: string; contentType: string; fileName: string }>;
    };

    const success = await validateSubtitleDownload(
      {
        providerId: provider.id,
        resultId: `opensubtitles:${provider.id}:file-1`,
        mode: "browser_download",
      },
      {
        db: {} as never,
        listProviders: vi.fn().mockResolvedValue([provider]),
        getAdapter: vi.fn().mockReturnValue(adapter),
        selectCredential: vi.fn().mockResolvedValue({
          id: "credential-1",
          secret: "provider-secret",
        }),
        markCredentialUsed: vi.fn(),
        markCredentialFailure: vi.fn(),
      },
    );
    expect(success).toMatchObject({
      status: "success",
      fileName: "matrix.srt",
      contentLength: 16,
      diagnostic: { errorCategory: null },
    });

    adapter.download.mockRejectedValueOnce(
      new Error("upstream failed token=provider-secret"),
    );
    const failed = await validateSubtitleDownload(
      {
        providerId: provider.id,
        resultId: `opensubtitles:${provider.id}:file-2`,
        mode: "browser_download",
      },
      {
        db: {} as never,
        listProviders: vi.fn().mockResolvedValue([provider]),
        getAdapter: vi.fn().mockReturnValue(adapter),
        selectCredential: vi.fn().mockResolvedValue({
          id: "credential-1",
          secret: "provider-secret",
        }),
        markCredentialUsed: vi.fn(),
        markCredentialFailure: vi.fn(),
      },
    );
    expect(failed.status).toBe("failed");
    expect(JSON.stringify(failed)).not.toContain("provider-secret");
    expect(failed.diagnostic.nextActionHint).toBeTruthy();
  });
});
