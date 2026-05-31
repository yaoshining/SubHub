import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeStorageClient,
  getStorageClient,
  resetStorageDatabasePathForTesting,
  setStorageDatabasePathForTesting,
} from "../helpers/pglite-storage-client";

import { createCallerKey } from "@/server/services/caller-key-service";
import { createProvider } from "@/server/services/provider-service";
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
  await setStorageDatabasePathForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closeStorageClient();
  await resetStorageDatabasePathForTesting();
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
});
