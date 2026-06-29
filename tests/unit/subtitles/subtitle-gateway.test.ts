import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getStorageClient,
  closePGliteStorageForTesting,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../../helpers/pglite-storage-client";

import { AppError } from "@/lib/errors";
import {
  createProvider,
  getProviderDetail,
} from "@/server/services/provider-service";
import { createCallerKey } from "@/server/services/caller-key-service";
import { searchSubtitles } from "@/server/subtitles/subtitle-gateway";
import { downloadSubtitle } from "@/server/subtitles/subtitle-download";

let tempDir: string;

const requestWithKey = (key: string, url = "http://localhost/api/subtitles") =>
  new Request(url, {
    headers: { authorization: ["Bearer", key].join(" ") },
  });

const createActiveCallerKey = async () =>
  createCallerKey({
    callerName: "Jellyfin",
    environment: "production",
    scope: "subtitles:read",
    quotaPolicy: "default",
  });

const createReadyProvider = async () =>
  createProvider({
    name: "OpenSubtitles Primary",
    type: "opensubtitles",
    initialCredential: {
      label: "primary",
      secret: "opensubtitles-api-key",
    },
  });

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-subtitle-gateway-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("统一字幕查询与下载", () => {
  it("无 Provider 时返回服务未就绪并记录请求", async () => {
    const callerKey = await createActiveCallerKey();

    await expect(
      searchSubtitles(
        requestWithKey(callerKey.key),
        { title: "Example", language: "zh-CN" },
        { adapter: { searchRaw: vi.fn() } },
      ),
    ).rejects.toMatchObject({
      code: "SERVICE_NOT_READY",
      target: "provider_pool",
    });
  });

  it("查询成功时归一化结果并生成下载 URL", async () => {
    const [callerKey] = await Promise.all([
      createActiveCallerKey(),
      createReadyProvider(),
    ]);

    const result = await searchSubtitles(
      requestWithKey(callerKey.key),
      { title: "Example", year: 2024, season: 1, episode: 2 },
      {
        adapter: {
          searchRaw: vi.fn().mockResolvedValue([
            {
              id: "subtitle_001",
              language: "zh-CN",
              fileName: "Example.S01E02.zh-CN.srt",
              downloadCount: 10,
            },
          ]),
        },
      },
    );

    expect(result.status).toBe("success");
    expect(result.results[0]).toMatchObject({
      provider: "opensubtitles",
      language: "zh-CN",
      format: "srt",
      downloadUrl: expect.stringContaining("/api/subtitles/download"),
    });
  });

  it("无结果、无效 Key、上游失败和下载不可用返回统一错误码", async () => {
    const [callerKey, provider] = await Promise.all([
      createActiveCallerKey(),
      createReadyProvider(),
    ]);

    await expect(
      searchSubtitles(
        requestWithKey(callerKey.key),
        { title: "No Result" },
        { adapter: { searchRaw: vi.fn().mockResolvedValue([]) } },
      ),
    ).rejects.toMatchObject({ code: "NO_RESULTS" });

    await expect(
      searchSubtitles(
        requestWithKey("invalid"),
        { title: "Example" },
        { adapter: { searchRaw: vi.fn() } },
      ),
    ).rejects.toMatchObject({ code: "CALLER_KEY_INVALID" });

    await expect(
      searchSubtitles(
        requestWithKey(callerKey.key),
        { title: "Upstream Failed" },
        {
          adapter: {
            searchRaw: vi.fn().mockRejectedValue(new Error("network")),
          },
        },
      ),
    ).rejects.toMatchObject({ code: "UPSTREAM_FAILED" });
    await expect(getProviderDetail(provider.id)).resolves.toMatchObject({
      status: "degraded",
      availableCredentialCount: 0,
    });

    await expect(
      downloadSubtitle(
        requestWithKey(callerKey.key),
        "opensubtitles:provider_missing:subtitle_001",
        {
          adapter: {
            download: vi.fn(),
          },
        },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("下载成功返回内容、文件名和 content type", async () => {
    const [callerKey, provider] = await Promise.all([
      createActiveCallerKey(),
      createReadyProvider(),
    ]);

    const result = await downloadSubtitle(
      requestWithKey(callerKey.key),
      `opensubtitles:${provider.id}:subtitle_001`,
      {
        adapter: {
          download: vi.fn().mockResolvedValue({
            content: "1\n00:00:01,000 --> 00:00:02,000\n你好",
            contentType: "application/x-subrip; charset=utf-8",
            fileName: "Example.zh-CN.srt",
          }),
        },
      },
    );

    expect(result).toMatchObject({
      fileName: "Example.zh-CN.srt",
      contentType: "application/x-subrip; charset=utf-8",
      subtitleRef: `opensubtitles:${provider.id}:subtitle_001`,
    });
  });

  it("Provider 下载明确返回不可用字幕时保留 SUBTITLE_NOT_FOUND 映射", async () => {
    const [callerKey, provider] = await Promise.all([
      createActiveCallerKey(),
      createReadyProvider(),
    ]);

    await expect(
      downloadSubtitle(
        requestWithKey(callerKey.key),
        `opensubtitles:${provider.id}:missing_subtitle`,
        {
          adapter: {
            download: vi
              .fn()
              .mockRejectedValue(
                new AppError(
                  "SUBTITLE_NOT_FOUND",
                  "未找到可下载的字幕项。",
                  "subtitleId",
                ),
              ),
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "SUBTITLE_NOT_FOUND",
      target: "subtitleId",
    });
  });

  it("OpenSubtitles 限流错误会进入 cooldown 而不是 exhausted", async () => {
    const [callerKey, provider] = await Promise.all([
      createActiveCallerKey(),
      createReadyProvider(),
    ]);

    await expect(
      searchSubtitles(
        requestWithKey(callerKey.key),
        { title: "Rate Limited" },
        {
          adapter: {
            searchRaw: vi
              .fn()
              .mockRejectedValue(
                new AppError(
                  "PROVIDER_CREDENTIAL_EXHAUSTED",
                  "OpenSubtitles 上游限流。",
                  "rate_limited",
                ),
              ),
          },
        },
      ),
    ).rejects.toMatchObject({ code: "UPSTREAM_FAILED" });

    const detail = await getProviderDetail(provider.id);
    expect(detail.credentials[0]).toMatchObject({
      status: "cooldown",
      cooldownUntil: expect.any(String),
    });
  });

  it("OpenSubtitles 失败时 provider_failures 保留真实失败原因而非固定 upstream_failed", async () => {
    const [callerKey] = await Promise.all([
      createActiveCallerKey(),
      createReadyProvider(),
    ]);

    const xunleiAdapter = {
      key: "xunlei" as const,
      search: vi.fn().mockResolvedValue({
        ok: true,
        skipped: false,
        results: [
          {
            id: "xunlei_001",
            language: "zh-CN",
            releaseName: "Example.zh-CN.srt",
            format: "srt",
            providerDownloadUrl: "https://xunlei.test/subtitle.srt",
            raw: {},
            score: 0.9,
          },
        ],
      }),
    };

    const result = await searchSubtitles(
      requestWithKey(callerKey.key),
      { title: "Partial Success" },
      {
        adapter: {
          searchRaw: vi
            .fn()
            .mockRejectedValue(
              new AppError(
                "PROVIDER_CREDENTIAL_EXHAUSTED",
                "OpenSubtitles 上游限流。",
                "rate_limited",
              ),
            ),
        },
        xunleiAdapter,
      },
    );

    expect(result.status).toBe("partial");
    expect(result.results).toHaveLength(1);
    expect(result.provider_failures).toHaveLength(1);
    expect(result.provider_failures?.[0]).toMatchObject({
      provider: "opensubtitles",
      reason: "rate_limited",
      message: "OpenSubtitles 上游限流。",
    });
  });
});
