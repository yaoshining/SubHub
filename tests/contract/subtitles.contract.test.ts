import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getStorageClient,
  closePGliteStorageForTesting,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../helpers/pglite-storage-client";

import { createCallerKey } from "@/server/services/caller-key-service";
import { createProvider } from "@/server/services/provider-service";
import * as searchRoute from "@/app/api/subtitles/search/route";
import * as downloadRoute from "@/app/api/subtitles/download/route";
import { expectApiError } from "../helpers/api";

let tempDir: string;

const nextRequest = (url: string, key?: string) =>
  new NextRequest(url, {
    headers: key
      ? {
          authorization: ["Bearer", key].join(" "),
        }
      : undefined,
  });

const readJson = async <T>(response: Response) => (await response.json()) as T;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-subtitles-contract-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("对外字幕 API 契约", () => {
  it("缺少 Caller Key 时返回统一错误结构", async () => {
    const response = await searchRoute.GET(
      nextRequest("http://localhost/api/subtitles/search?title=Example"),
    );

    await expectApiError(response, "CALLER_KEY_INVALID");
  });

  it("查询与下载参数校验失败时返回统一校验错误", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?year=2024",
          callerKey.key,
        ),
      ),
      "VALIDATION_FAILED",
    );
    await expectApiError(
      await downloadRoute.GET(
        nextRequest("http://localhost/api/subtitles/download", callerKey.key),
      ),
      "VALIDATION_FAILED",
    );
  });

  it("无 Provider、无结果、上游失败和下载不可用均返回统一错误结构", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?title=Example",
          callerKey.key,
        ),
      ),
      "SERVICE_NOT_READY",
    );

    await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [],
        }),
      ),
    );
    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?title=Missing",
          callerKey.key,
        ),
      ),
      "NO_RESULTS",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("failed", { status: 502 })),
    );
    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?title=Broken",
          callerKey.key,
        ),
      ),
      "UPSTREAM_FAILED",
    );

    await expectApiError(
      await downloadRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/download?subtitleId=invalid",
          callerKey.key,
        ),
      ),
      "SUBTITLE_NOT_FOUND",
    );
  });

  it("查询与下载成功响应结构稳定，并返回文件下载响应头", async () => {
    const [callerKey, provider] = await Promise.all([
      createCallerKey({
        callerName: "Jellyfin",
        environment: "production",
        scope: "subtitles:read",
        quotaPolicy: "default",
      }),
      createProvider({
        name: "OpenSubtitles Primary",
        type: "opensubtitles",
        initialCredential: {
          label: "primary",
          secret: "opensubtitles-api-key",
        },
      }),
    ]);

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            data: [
              {
                id: "file_001",
                attributes: {
                  language: "zh-CN",
                  files: [
                    { file_id: "file_001", file_name: "Example.zh-CN.srt" },
                  ],
                  download_count: 3,
                },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            link: "https://example.test/subtitle.srt",
            file_name: "Example.zh-CN.srt",
          }),
        )
        .mockResolvedValueOnce(
          new Response("1\n00:00:01,000 --> 00:00:02,000\n你好", {
            status: 200,
            headers: { "content-type": "application/x-subrip" },
          }),
        ),
    );

    const search = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example&language=zh-CN",
        callerKey.key,
      ),
    );
    const searchPayload = await readJson<{
      data: {
        status: string;
        results: Array<{ id: string; downloadUrl: string }>;
      };
    }>(search);

    expect(searchPayload.data).toMatchObject({
      status: "success",
      results: [
        expect.objectContaining({
          id: `opensubtitles:${provider.id}:file_001`,
          downloadUrl: expect.stringContaining("/api/subtitles/download"),
        }),
      ],
    });

    const download = await downloadRoute.GET(
      nextRequest(
        `http://localhost/api/subtitles/download?subtitleId=${encodeURIComponent(searchPayload.data.results[0]!.id)}`,
        callerKey.key,
      ),
    );

    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain(
      "application/x-subrip",
    );
    expect(download.headers.get("content-disposition")).toContain(
      "attachment;",
    );
    await expect(download.text()).resolves.toContain("你好");
  });

  it("传入 imdb_id 时走 ID 定位路径并返回 200", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: "file_002",
            attributes: {
              language: "en",
              files: [{ file_id: "file_002", file_name: "Inception.en.srt" }],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Inception&imdb_id=tt1375666&language=en",
        callerKey.key,
      ),
    );

    expect(response.status).toBe(200);
    const payload = await readJson<{
      data: { status: string; results: Array<{ id: string }> };
    }>(response);
    expect(payload.data.status).toBe("success");
    expect(payload.data.results).toHaveLength(1);

    const requestUrl = (fetchMock.mock.calls[0]![0] as string).toString();
    const params = new URLSearchParams(requestUrl.split("?")[1]);
    expect(params.get("imdb_id")).toBe("tt1375666");
    expect(params.get("query")).toBeNull();
  });

  it("传入 tmdb_id + season + episode + type=episode 时走 ID 定位路径", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: "file_003",
            attributes: {
              language: "en",
              files: [
                {
                  file_id: "file_003",
                  file_name: "Breaking.Bad.S01E01.en.srt",
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Breaking%20Bad&tmdb_id=1396&season=1&episode=1&type=episode&language=en",
        callerKey.key,
      ),
    );

    expect(response.status).toBe(200);
    const requestUrl = (fetchMock.mock.calls[0]![0] as string).toString();
    const params = new URLSearchParams(requestUrl.split("?")[1]);
    expect(params.get("tmdb_id")).toBe("1396");
    expect(params.get("season_number")).toBe("1");
    expect(params.get("episode_number")).toBe("1");
    expect(params.get("type")).toBe("episode");
  });

  it("type=movie + season 同时出现返回 400 VALIDATION_FAILED", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?title=Inception&type=movie&season=1",
          callerKey.key,
        ),
      ),
      "VALIDATION_FAILED",
    );
  });

  it("imdb_id 格式不合法返回 400 VALIDATION_FAILED", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?title=Inception&imdb_id=invalid",
          callerKey.key,
        ),
      ),
      "VALIDATION_FAILED",
    );
  });

  it("老调用方仅传 title 时行为与现状一致", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: "file_004",
            attributes: {
              language: "en",
              files: [{ file_id: "file_004", file_name: "Inception.en.srt" }],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Inception",
        callerKey.key,
      ),
    );

    expect(response.status).toBe(200);
    const requestUrl = (fetchMock.mock.calls[0]![0] as string).toString();
    const params = new URLSearchParams(requestUrl.split("?")[1]);
    expect(params.get("query")).toBe("Inception");
    expect(params.get("imdb_id")).toBeNull();
    expect(params.get("tmdb_id")).toBeNull();
  });

  it("老调用方传完整现有字段走 query fallback 路径", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: "file_005",
            attributes: {
              language: "en",
              files: [
                {
                  file_id: "file_005",
                  file_name: "Breaking.Bad.S01E01.en.srt",
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Breaking%20Bad&year=2008&season=1&episode=1&language=en",
        callerKey.key,
      ),
    );

    expect(response.status).toBe(200);
    const requestUrl = (fetchMock.mock.calls[0]![0] as string).toString();
    const params = new URLSearchParams(requestUrl.split("?")[1]);
    expect(params.get("query")).toBe("Breaking Bad 2008 S01E01");
    expect(params.get("languages")).toBe("en");
    expect(params.get("imdb_id")).toBeNull();
  });
});
