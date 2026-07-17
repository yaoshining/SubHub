import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closePGliteStorageForTesting,
  getStorageClient,
  initializePGliteStorageForTesting,
  resetPGliteStorageForTesting,
} from "../helpers/pglite-storage-client";

import { validateSubtitleDownload } from "@/server/subtitles/admin-subtitle-validator";

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-validator-download-flow-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.pglite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Subtitle Validator 下载验证闭环", () => {
  it("在 PGlite provider 配置上保持 Xunlei 的 URL check / browser download 分支隔离", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));

    const urlCheck = await validateSubtitleDownload(
      {
        providerId: "xunlei-default",
        resultId: "xunlei:xunlei-default:subtitle-1",
        mode: "url_check",
        downloadReference: "https://downloads.example.com/subtitle-1.srt",
      },
      { db: getStorageClient().db, fetchImpl },
    );
    const browserDownload = await validateSubtitleDownload(
      {
        providerId: "xunlei-default",
        resultId: "xunlei:xunlei-default:subtitle-1",
        mode: "browser_download",
      },
      { db: getStorageClient().db, fetchImpl },
    );

    expect(urlCheck).toMatchObject({
      status: "success",
      httpStatus: 200,
      diagnostic: {
        action: "download_validation",
        provider: "xunlei",
        downloadMode: "url_check",
      },
    });
    expect(browserDownload).toMatchObject({
      status: "unsupported",
      httpStatus: null,
      diagnostic: {
        errorCategory: "unsupported",
        downloadMode: "browser_download",
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
