import { describe, expect, it, vi } from "vitest";

import { XunleiAdapter } from "@/server/providers/xunlei-adapter";
import type { SubtitleSearchInput } from "@/server/subtitles/subtitle-gateway";

const createAdapterWithMock = () => {
  const fetchImpl = vi.fn(async (): Promise<Response> => Response.json([]));
  const adapter = new XunleiAdapter({
    baseUrl: "https://xunlei.test/oracle/subtitle",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    timeoutMs: 1000,
  });
  return { fetchImpl, adapter };
};

const getParams = (fetchImpl: ReturnType<typeof vi.fn>): URLSearchParams => {
  const call = fetchImpl.mock.calls[0];
  if (!call) throw new Error("fetchImpl was not called");
  const url = typeof call[0] === "string" ? call[0] : (call[0] as Request).url;
  return new URLSearchParams(url.split("?")[1] ?? "");
};

const makeInput = (
  overrides: Partial<SubtitleSearchInput> = {},
): SubtitleSearchInput => ({
  title: "test",
  query: "权力的游戏",
  language: "简体",
  ...overrides,
});

const mockResponse = (data: unknown) =>
  vi.fn(async (): Promise<Response> => Response.json(data));

describe("XunleiAdapter 字段映射", () => {
  it("query 映射到上游 name，language 映射到上游 languages", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search(
      null,
      makeInput({ query: "权力的游戏", language: "简体" }),
    );
    const params = getParams(fetchImpl);
    expect(params.get("name")).toBe("权力的游戏");
    expect(params.get("languages")).toBe("简体");
  });

  it("不支持字段不传上游（imdb_id / tmdb_id / season / episode / type / year / title）", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search(
      null,
      makeInput({
        imdbId: "tt0944947",
        tmdbId: 1399,
        season: 1,
        episode: 1,
        type: "episode",
        year: 2011,
        title: "Game of Thrones",
      }),
    );
    const params = getParams(fetchImpl);
    expect(params.get("imdb_id")).toBeNull();
    expect(params.get("tmdb_id")).toBeNull();
    expect(params.get("season")).toBeNull();
    expect(params.get("episode")).toBeNull();
    expect(params.get("type")).toBeNull();
    expect(params.get("year")).toBeNull();
    expect(params.get("title")).toBeNull();
    expect(params.get("name")).toBe("权力的游戏");
  });
});

describe("XunleiAdapter 必要条件缺失", () => {
  it("query 为空时返回 skipped: true, reason: missing_required_field", async () => {
    const { adapter } = createAdapterWithMock();
    const outcome = await adapter.search(
      null,
      makeInput({ query: "", language: "简体" }),
    );
    expect(outcome).toEqual({
      ok: true,
      skipped: true,
      reason: "missing_required_field",
      results: [],
    });
  });

  it("language 为空时返回 skipped: true, reason: missing_required_field", async () => {
    const { adapter } = createAdapterWithMock();
    const outcome = await adapter.search(
      null,
      makeInput({ query: "权力的游戏", language: "" }),
    );
    expect(outcome).toEqual({
      ok: true,
      skipped: true,
      reason: "missing_required_field",
      results: [],
    });
  });

  it("query 和 language 均缺失时返回 skipped", async () => {
    const { adapter } = createAdapterWithMock();
    const outcome = await adapter.search(
      null,
      makeInput({ query: "", language: "" }),
    );
    expect(outcome).toEqual({
      ok: true,
      skipped: true,
      reason: "missing_required_field",
      results: [],
    });
  });
});

describe("XunleiAdapter 错误处理", () => {
  it("上游 5xx 返回 upstream_failed", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: vi.fn(
        async () => new Response("server error", { status: 502 }),
      ) as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome).toMatchObject({
      ok: false,
      skipped: false,
      error: { reason: "upstream_failed" },
    });
  });

  it("上游 401 返回 authentication_failed", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: vi.fn(
        async () => new Response("unauthorized", { status: 401 }),
      ) as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome).toMatchObject({
      ok: false,
      skipped: false,
      error: { reason: "authentication_failed" },
    });
  });

  it("上游 429 返回 rate_limited", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: vi.fn(
        async () => new Response("rate limited", { status: 429 }),
      ) as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome).toMatchObject({
      ok: false,
      skipped: false,
      error: { reason: "rate_limited" },
    });
  });

  it("上游超时返回 timeout", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve(Response.json([])), 3000);
            init?.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ) as unknown as typeof fetch,
      timeoutMs: 50,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome).toMatchObject({
      ok: false,
      skipped: false,
      error: { reason: "timeout" },
    });
  });

  it("自定义 fetchImpl 抛出非 DOMException 的 AbortError 仍归类为 timeout", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      ) as unknown as typeof fetch,
      timeoutMs: 50,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome).toMatchObject({
      ok: false,
      skipped: false,
      error: { reason: "timeout" },
    });
  });

  it("响应解析失败（非 JSON）返回 upstream_failed", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: vi.fn(
        async () => new Response("not json", { status: 200 }),
      ) as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome).toMatchObject({
      ok: false,
      skipped: false,
      error: { reason: "upstream_failed" },
    });
  });
});

describe("XunleiAdapter 响应解析", () => {
  it("正常响应解析为 ProviderSearchResult，优先使用 gcid", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: mockResponse([
        {
          cid: "abcdef1234567890",
          gcid: "abcdef0123456789abcdef0123456789",
          url: "https://example.test/subtitle.srt",
          ext: "srt",
          name: "肖申克的救赎.srt",
          duration: 8520,
          languages: ["zh", "zh-CN"],
          source: "shoulei",
          score: 0.95,
          fingerprintf_score: 0.0,
          extra_name: "简体&英文",
          mt: 0,
        },
      ]) as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.results).toHaveLength(1);
    const result = outcome.results[0]!;
    expect(result.id).toBe("abcdef0123456789abcdef0123456789");
    expect(result.language).toBe("zh");
    expect(result.releaseName).toBe("肖申克的救赎.srt");
    expect(result.format).toBe("srt");
    expect(result.providerDownloadUrl).toBe(
      "https://example.test/subtitle.srt",
    );
    expect(result.score).toBe(0.95);
    expect(result.raw).toMatchObject({
      cid: "abcdef1234567890",
      gcid: "abcdef0123456789abcdef0123456789",
      url: "https://example.test/subtitle.srt",
    });
  });

  it("gcid 缺失时回退 cid", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: mockResponse([
        { cid: "abcdef1234567890", ext: "ass", name: "test.ass" },
      ]) as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.results[0]!.id).toBe("abcdef1234567890");
    expect(outcome.results[0]!.format).toBe("ass");
  });

  it("ext 缺失时 format 默认 srt", async () => {
    const adapter = new XunleiAdapter({
      baseUrl: "https://xunlei.test",
      fetchImpl: mockResponse([
        { gcid: "abc123", name: "test.srt" },
      ]) as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    const outcome = await adapter.search(null, makeInput());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.results[0]!.format).toBe("srt");
  });
});
