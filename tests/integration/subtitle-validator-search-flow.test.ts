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

import { searchSubtitleValidator } from "@/server/subtitles/admin-subtitle-validator";
import type { SubtitleProviderAdapter } from "@/server/providers/provider-adapter";

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "subhub-validator-search-flow-"));
  await initializePGliteStorageForTesting(join(tempDir, "test.sqlite"));
  await getStorageClient().migrate();
});

afterEach(async () => {
  await closePGliteStorageForTesting();
  await resetPGliteStorageForTesting();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Subtitle Validator 单 provider 搜索闭环", () => {
  it("在 PGlite provider 配置上执行指定实例，并将空结果保持为成功态", async () => {
    const adapter: SubtitleProviderAdapter = {
      key: "xunlei",
      search: vi
        .fn()
        .mockResolvedValue({ ok: true, skipped: false, results: [] }),
    };

    const result = await searchSubtitleValidator(
      {
        providerId: "xunlei-default",
        baseParams: { keyword: "The Matrix" },
        providerParams: { query: "The Matrix", language: "zh-CN" },
      },
      {
        db: getStorageClient().db,
        getAdapter: vi.fn().mockReturnValue(adapter),
      },
    );

    expect(result).toMatchObject({
      status: "empty",
      results: [],
      providerFailures: [],
      diagnostic: {
        provider: "xunlei",
        status: "empty",
        errorCategory: "empty_results",
      },
    });
    expect(adapter.search).toHaveBeenCalledWith(null, {
      title: "The Matrix",
      query: "The Matrix",
      language: "zh-CN",
      year: undefined,
      season: undefined,
      episode: undefined,
      imdbId: undefined,
      tmdbId: undefined,
      type: undefined,
    });
  });
});
