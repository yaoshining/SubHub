import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
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
import { providers } from "@/server/storage/schema";
import * as searchRoute from "@/app/api/subtitles/search/route";
import * as downloadRoute from "@/app/api/subtitles/download/route";
import { expectApiError } from "../helpers/api";

let tempDir: string;

const nextRequest = (url: string, key: string) =>
  new NextRequest(url, {
    headers: { authorization: ["Bearer", key].join(" ") },
  });

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-subtitle-flow-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("字幕出口端到端 API 流程", () => {
  it("创建 Caller Key 后可查询下载，停用后立即拒绝新请求", async () => {
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
                },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            content: "1\n00:00:01,000 --> 00:00:02,000\n你好",
            file_name: "Example.zh-CN.srt",
          }),
        ),
    );

    const search = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example",
        callerKey.key,
      ),
    );
    const payload = (await search.json()) as {
      data: { results: Array<{ id: string }> };
    };

    expect(payload.data.results).toHaveLength(1);

    const download = await downloadRoute.GET(
      nextRequest(
        `http://localhost/api/subtitles/download?subtitleId=${encodeURIComponent(payload.data.results[0]!.id)}`,
        callerKey.key,
      ),
    );

    expect(download.status).toBe(200);
    await expect(download.text()).resolves.toContain("你好");

    const { suspendCallerKey } =
      await import("@/server/services/caller-key-service");
    await suspendCallerKey(callerKey.callerKey.id);

    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?title=Example",
          callerKey.key,
        ),
      ),
      "CALLER_KEY_SUSPENDED",
    );
  });

  it("ID 定位路径端到端：imdb_id 优先于 query 构造", async () => {
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
        initialCredential: {
          label: "primary",
          secret: "opensubtitles-api-key",
        },
      }),
    ]);

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: "file_010",
            attributes: {
              language: "en",
              files: [{ file_id: "file_010", file_name: "Inception.en.srt" }],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const search = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Inception&imdb_id=tt1375666&language=en",
        callerKey.key,
      ),
    );
    expect(search.status).toBe(200);

    const requestUrl = (fetchMock.mock.calls[0]![0] as string).toString();
    const params = new URLSearchParams(requestUrl.split("?")[1]);
    expect(params.get("imdb_id")).toBe("tt1375666");
    expect(params.get("query")).toBeNull();
  });

  it("query fallback 路径端到端：老调用方零改动行为一致", async () => {
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
        initialCredential: {
          label: "primary",
          secret: "opensubtitles-api-key",
        },
      }),
    ]);

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: "file_011",
            attributes: {
              language: "en",
              files: [
                {
                  file_id: "file_011",
                  file_name: "Breaking.Bad.S01E01.en.srt",
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const search = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Breaking%20Bad&year=2008&season=1&episode=1&language=en",
        callerKey.key,
      ),
    );
    expect(search.status).toBe(200);

    const requestUrl = (fetchMock.mock.calls[0]![0] as string).toString();
    const params = new URLSearchParams(requestUrl.split("?")[1]);
    expect(params.get("query")).toBe("Breaking Bad 2008 S01E01");
    expect(params.get("imdb_id")).toBeNull();
    expect(params.get("tmdb_id")).toBeNull();
  });

  it("跨字段冲突端到端：type=movie + season 返回 400", async () => {
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

  it("完整流程：enable→search 成功→disable→search 失败", async () => {
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
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: "file_001",
              attributes: {
                language: "zh-CN",
                files: [
                  { file_id: "file_001", file_name: "Example.zh-CN.srt" },
                ],
              },
            },
          ],
        }),
      ),
    );

    const searchSuccess = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example",
        callerKey.key,
      ),
    );
    expect(searchSuccess.status).toBe(200);
    const successPayload = (await searchSuccess.json()) as {
      data: { results: Array<{ id: string }> };
    };
    expect(successPayload.data.results).toHaveLength(1);

    const { disableProvider } =
      await import("@/server/services/provider-service");
    await disableProvider(provider.id);

    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?title=Example",
          callerKey.key,
        ),
      ),
      "SERVICE_NOT_READY",
    );
  });

  it("完整流程：disabled→enable→search 成功", async () => {
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

    const { disableProvider, enableProvider } =
      await import("@/server/services/provider-service");
    await disableProvider(provider.id);

    await expectApiError(
      await searchRoute.GET(
        nextRequest(
          "http://localhost/api/subtitles/search?title=Example",
          callerKey.key,
        ),
      ),
      "SERVICE_NOT_READY",
    );

    await enableProvider(provider.id);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: "file_001",
              attributes: {
                language: "zh-CN",
                files: [
                  { file_id: "file_001", file_name: "Example.zh-CN.srt" },
                ],
              },
            },
          ],
        }),
      ),
    );

    const searchSuccess = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example",
        callerKey.key,
      ),
    );
    expect(searchSuccess.status).toBe(200);
    const successPayload = (await searchSuccess.json()) as {
      data: { results: Array<{ id: string }> };
    };
    expect(successPayload.data.results).toHaveLength(1);
  });

  it("成功搜索后会回写 OpenSubtitles provider 健康字段为 ready 并刷新 checkedAt", async () => {
    const callerKey = await createCallerKey({
      callerName: "Jellyfin",
      environment: "production",
      scope: "subtitles:read",
      quotaPolicy: "default",
    });

    const provider = await createProvider({
      name: "OpenSubtitles Primary",
      type: "opensubtitles",
      initialCredential: {
        label: "primary",
        secret: "opensubtitles-api-key",
      },
    });

    const db = getStorageClient().db;

    // Snapshot the health fields *before* the search call so we can assert
    // the gateway actually refreshed them on the success path.
    const beforeRows = await db
      .select()
      .from(providers)
      .where(eq(providers.id, provider.id))
      .limit(1);
    const beforeRow = beforeRows[0];
    expect(beforeRow).toBeDefined();
    // At creation time provider-repository only sets lastHealthStatus
    // (="ready") and lastErrorSummary (=null); lastHealthCheckedAt is left
    // NULL until the first health sync runs.
    expect(beforeRow?.lastHealthStatus).toBe("ready");
    expect(beforeRow?.lastErrorSummary).toBeNull();
    expect(beforeRow?.lastHealthCheckedAt).toBeNull();

    const beforeCallAt = Date.now();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: "file_001",
              attributes: {
                language: "zh-CN",
                files: [
                  { file_id: "file_001", file_name: "Example.zh-CN.srt" },
                ],
              },
            },
          ],
        }),
      ),
    );

    const search = await searchRoute.GET(
      nextRequest(
        "http://localhost/api/subtitles/search?title=Example",
        callerKey.key,
      ),
    );
    expect(search.status).toBe(200);
    const payload = (await search.json()) as {
      data: { results: Array<{ id: string }> };
    };
    expect(payload.data.results).toHaveLength(1);

    // subtitle-gateway syncs provider health as a fire-and-forget Promise.all
    // after the response is returned, so poll the providers table until the
    // lastHealthCheckedAt flips from NULL to a valid ISO timestamp (which
    // implies the gateway has also written lastHealthStatus="ready").
    const pollTimeoutMs = 2_000;
    const pollStartedAt = Date.now();
    let afterRow: typeof beforeRow | undefined;
    while (Date.now() - pollStartedAt < pollTimeoutMs) {
      const rows = await db
        .select()
        .from(providers)
        .where(eq(providers.id, provider.id))
        .limit(1);
      const candidate = rows[0];
      if (candidate?.lastHealthCheckedAt) {
        afterRow = candidate;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(afterRow).toBeDefined();
    expect(afterRow?.lastHealthStatus).toBe("ready");
    expect(afterRow?.lastErrorSummary).toBeNull();
    expect(afterRow?.lastHealthCheckedAt).not.toBeNull();
    // OpenAPI declares `format: date-time` (strict ISO 8601 with `T` and a
    // `+HH:MM` timezone). PGlite emits a slightly different shape
    // ("YYYY-MM-DD HH:MM:SS.sss+08" with a space and short tz). Accept both
    // shapes, then defer to `new Date(...)` for the real parse check.
    expect(afterRow?.lastHealthCheckedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$/,
    );

    // checkedAt must be >= the time we captured right before the search
    // call. Allow a 1s skew to absorb clock jitter / test runner scheduling.
    const checkedAtMs = new Date(afterRow!.lastHealthCheckedAt!).getTime();
    expect(Number.isFinite(checkedAtMs)).toBe(true);
    expect(checkedAtMs).toBeGreaterThanOrEqual(beforeCallAt - 1000);
  });
});
