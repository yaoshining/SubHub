import { describe, expect, it } from "vitest";

import type { ProviderSearchResult } from "@/server/providers/provider-adapter";
import {
  mapFailure,
  normalize,
} from "@/server/subtitles/subtitle-result-normalizer";

const makeResult = (
  overrides: Partial<ProviderSearchResult> = {},
): ProviderSearchResult => ({
  id: "abc123",
  language: "zh",
  releaseName: "test.srt",
  format: "srt",
  providerDownloadUrl: null,
  score: null,
  ...overrides,
});

describe("归一化 - provider 字段注入", () => {
  it("OpenSubtitles 结果注入 provider = opensubtitles", () => {
    const result = normalize("opensubtitles", makeResult(), "provider_001");
    expect(result.provider).toBe("opensubtitles");
  });

  it("迅雷结果注入 provider = xunlei", () => {
    const result = normalize("xunlei", makeResult(), "xunlei_default");
    expect(result.provider).toBe("xunlei");
  });
});

describe("归一化 - id 格式生成", () => {
  it("OpenSubtitles id 格式为 opensubtitles:{providerId}:{resultId}", () => {
    const result = normalize(
      "opensubtitles",
      makeResult({ id: "file_001" }),
      "provider_abc",
    );
    expect(result.id).toBe("opensubtitles:provider_abc:file_001");
  });

  it("迅雷 id 格式为 xunlei:{providerId}:{gcid}", () => {
    const result = normalize(
      "xunlei",
      makeResult({ id: "gcid_abc" }),
      "xunlei_default",
    );
    expect(result.id).toBe("xunlei:xunlei_default:gcid_abc");
  });
});

describe("归一化 - downloadUrl 生成", () => {
  it("downloadUrl 包含 /api/subtitles/download?subtitleId=", () => {
    const result = normalize(
      "opensubtitles",
      makeResult({ id: "file_001" }),
      "provider_abc",
    );
    expect(result.downloadUrl).toContain("/api/subtitles/download?subtitleId=");
  });

  it("downloadUrl 中的 subtitleId 被 encode", () => {
    const result = normalize(
      "opensubtitles",
      makeResult({ id: "file_001" }),
      "provider_abc",
    );
    expect(result.downloadUrl).toContain(
      encodeURIComponent("opensubtitles:provider_abc:file_001"),
    );
  });
});

describe("归一化 - raw 字段保留", () => {
  it("OpenSubtitles raw 字段保留", () => {
    const result = normalize(
      "opensubtitles",
      makeResult({ raw: { download_count: 42 } }),
      "provider_abc",
    );
    expect(result.raw).toEqual({ download_count: 42 });
  });

  it("迅雷 raw 字段保留", () => {
    const result = normalize(
      "xunlei",
      makeResult({ raw: { cid: "cid_1", gcid: "gcid_1", url: "https://..." } }),
      "xunlei_default",
    );
    expect(result.raw).toMatchObject({
      cid: "cid_1",
      gcid: "gcid_1",
      url: "https://...",
    });
  });
});

describe("归一化 - score 字段透传", () => {
  it("迅雷 score 透传到顶层", () => {
    const result = normalize(
      "xunlei",
      makeResult({ score: 0.95 }),
      "xunlei_default",
    );
    expect(result.score).toBe(0.95);
  });

  it("OpenSubtitles score 为 null", () => {
    const result = normalize(
      "opensubtitles",
      makeResult({ score: null }),
      "provider_abc",
    );
    expect(result.score).toBeNull();
  });
});

describe("归一化 - 老调用方兼容", () => {
  it("id / language / releaseName / format / downloadUrl 字段集 100% 不变", () => {
    const result = normalize(
      "opensubtitles",
      makeResult({
        id: "file_001",
        language: "en",
        releaseName: "test.srt",
        format: "srt",
      }),
      "provider_abc",
    );
    expect(result).toMatchObject({
      id: "opensubtitles:provider_abc:file_001",
      language: "en",
      releaseName: "test.srt",
      format: "srt",
      downloadUrl: expect.stringContaining("/api/subtitles/download"),
    });
  });
});

describe("mapFailure - 错误映射", () => {
  it("upstream_failed 映射不变", () => {
    const failure = mapFailure("xunlei", {
      ok: false,
      skipped: false,
      error: { reason: "upstream_failed", message: "失败" },
    });
    expect(failure).toMatchObject({
      provider: "xunlei",
      reason: "upstream_failed",
    });
  });

  it("timeout 映射不变", () => {
    const failure = mapFailure("xunlei", {
      ok: false,
      skipped: false,
      error: { reason: "timeout", message: "超时" },
    });
    expect(failure.reason).toBe("timeout");
  });

  it("missing_required_field 映射为 skipped_missing_fields", () => {
    const failure = mapFailure("xunlei", {
      ok: true,
      skipped: true,
      reason: "missing_required_field",
      results: [],
    });
    expect(failure.reason).toBe("skipped_missing_fields");
  });

  it("disabled 映射为 skipped_disabled", () => {
    const failure = mapFailure("xunlei", {
      ok: true,
      skipped: true,
      reason: "disabled",
      results: [],
    });
    expect(failure.reason).toBe("skipped_disabled");
  });
});
