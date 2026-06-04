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
});
