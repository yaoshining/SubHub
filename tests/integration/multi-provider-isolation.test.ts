import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getStorageClient,
  closePGliteStorageForTesting,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../helpers/pglite-storage-client";

import { createCallerKey } from "@/server/services/caller-key-service";
import { createProvider } from "@/server/services/provider-service";
import { searchSubtitles } from "@/server/subtitles/subtitle-gateway";
import type {
  SubtitleProviderAdapter,
  ProviderSearchOutcome,
} from "@/server/providers/provider-adapter";

let tempDir: string;

const nextRequest = (url: string, key?: string) =>
  new Request(url, {
    headers: key ? { authorization: ["Bearer", key].join(" ") } : undefined,
  });

const mockXunleiAdapter = (
  outcome: ProviderSearchOutcome,
): SubtitleProviderAdapter => ({
  key: "xunlei",
  search: vi.fn(async () => outcome),
});

const mockXunleiSuccess: ProviderSearchOutcome = {
  ok: true,
  skipped: false,
  results: [
    {
      id: "gcid_test_001",
      language: "zh",
      releaseName: "肖申克的救赎.srt",
      format: "srt",
      providerDownloadUrl: "https://xunlei.test/subtitle.srt",
      score: 0.95,
      raw: { gcid: "gcid_test_001", url: "https://xunlei.test/subtitle.srt" },
    },
  ],
};

const mockXunleiSkipped: ProviderSearchOutcome = {
  ok: true,
  skipped: true,
  reason: "missing_required_field",
  results: [],
};

const mockXunleiFailed: ProviderSearchOutcome = {
  ok: false,
  skipped: false,
  error: { reason: "upstream_failed", message: "迅雷上游 5xx" },
};

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-multi-provider-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("多 provider 集成", () => {
  it("多 provider 并存：OpenSubtitles + 迅雷同时被调用、结果聚合", async () => {
    const [callerKey] = await Promise.all([
      createCallerKey({
        callerName: "Jellyfin",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      }),
      createProvider({
        name: "OpenSubtitles Primary",
        type: "opensubtitles",
        initialCredential: { label: "primary", secret: "api-key" },
      }),
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: "os_file_001",
              attributes: {
                language: "en",
                files: [
                  { file_id: "os_file_001", file_name: "Example.en.srt" },
                ],
              },
            },
          ],
        }),
      ),
    );

    const data = await searchSubtitles(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example&query=肖申克的救赎&language=zh",
        callerKey.key,
      ),
      { title: "Example", query: "肖申克的救赎", language: "zh" },
      { xunleiAdapter: mockXunleiAdapter(mockXunleiSuccess) },
    );

    expect(data.status).toBe("success");
    expect(data.results.length).toBeGreaterThanOrEqual(2);
    const providers = data.results.map((r) => r.provider);
    expect(providers).toContain("opensubtitles");
    expect(providers).toContain("xunlei");
  });

  it("单 provider 失败隔离：迅雷失败，OpenSubtitles 结果正常返回，status = partial", async () => {
    const [callerKey] = await Promise.all([
      createCallerKey({
        callerName: "Jellyfin",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      }),
      createProvider({
        name: "OpenSubtitles Primary",
        type: "opensubtitles",
        initialCredential: { label: "primary", secret: "api-key" },
      }),
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: "os_file_002",
              attributes: {
                language: "en",
                files: [
                  { file_id: "os_file_002", file_name: "Example.en.srt" },
                ],
              },
            },
          ],
        }),
      ),
    );

    const data = await searchSubtitles(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example&query=test&language=en",
        callerKey.key,
      ),
      { title: "Example", query: "test", language: "en" },
      { xunleiAdapter: mockXunleiAdapter(mockXunleiFailed) },
    );

    expect(data.status).toBe("partial");
    expect(data.results).toHaveLength(1);
    expect(data.results[0]!.provider).toBe("opensubtitles");
    expect(data.provider_failures).toBeDefined();
    expect(data.provider_failures).toHaveLength(1);
    expect(data.provider_failures![0]).toMatchObject({
      provider: "xunlei",
      reason: "upstream_failed",
    });
  });

  it("provider 来源区分：每个结果标注正确 provider", async () => {
    const [callerKey] = await Promise.all([
      createCallerKey({
        callerName: "Jellyfin",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      }),
      createProvider({
        name: "OpenSubtitles Primary",
        type: "opensubtitles",
        initialCredential: { label: "primary", secret: "api-key" },
      }),
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: "os_file_003",
              attributes: {
                language: "en",
                files: [
                  { file_id: "os_file_003", file_name: "Example.en.srt" },
                ],
              },
            },
          ],
        }),
      ),
    );

    const data = await searchSubtitles(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example&query=肖申克&language=zh",
        callerKey.key,
      ),
      { title: "Example", query: "肖申克", language: "zh" },
      { xunleiAdapter: mockXunleiAdapter(mockXunleiSuccess) },
    );

    for (const result of data.results) {
      const [prefix] = result.id.split(":");
      expect(prefix).toBe(result.provider);
    }
  });

  it("迅雷 skipped 不影响 status（仍为 success）", async () => {
    const [callerKey] = await Promise.all([
      createCallerKey({
        callerName: "Jellyfin",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      }),
      createProvider({
        name: "OpenSubtitles Primary",
        type: "opensubtitles",
        initialCredential: { label: "primary", secret: "api-key" },
      }),
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: "os_file_004",
              attributes: {
                language: "en",
                files: [
                  { file_id: "os_file_004", file_name: "Example.en.srt" },
                ],
              },
            },
          ],
        }),
      ),
    );

    const data = await searchSubtitles(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example&language=en",
        callerKey.key,
      ),
      { title: "Example", language: "en" },
      { xunleiAdapter: mockXunleiAdapter(mockXunleiSkipped) },
    );

    expect(data.status).toBe("success");
  });

  it("仅迅雷有结果（无 OpenSubtitles 凭据）时不误报 SERVICE_NOT_READY", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    const data = await searchSubtitles(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example&query=肖申克&language=zh",
        callerKey.key,
      ),
      { title: "Example", query: "肖申克的救赎", language: "zh" },
      { xunleiAdapter: mockXunleiAdapter(mockXunleiSuccess) },
    );

    expect(data.status).toBe("success");
    expect(data.results).toHaveLength(1);
    expect(data.results[0]!.provider).toBe("xunlei");
  });
});
