import { describe, expect, it, vi } from "vitest";

import { OpenSubtitlesAdapter } from "@/server/providers/opensubtitles-adapter";

const createAdapterWithMock = () => {
  const fetchImpl = vi.fn(
    async (): Promise<Response> => Response.json({ data: [] }),
  );
  const adapter = new OpenSubtitlesAdapter({
    baseUrl: "https://opensubtitles.test",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    timeoutMs: 1000,
  });
  return { fetchImpl, adapter };
};

const getParams = (fetchImpl: ReturnType<typeof vi.fn>): URLSearchParams => {
  const call = fetchImpl.mock.calls[0];
  if (!call) {
    throw new Error("fetchImpl was not called");
  }
  const input = call[0];
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
  const query = url.split("?")[1] ?? "";
  return new URLSearchParams(query);
};

describe("OpenSubtitlesAdapter.search 参数映射", () => {
  it("imdbId 映射到上游 imdb_id", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search("secret", {
      query: "Inception",
      imdbId: "tt1375666",
    });
    const params = getParams(fetchImpl);
    expect(params.get("imdb_id")).toBe("tt1375666");
    expect(params.get("query")).toBe("Inception");
  });

  it("tmdbId 映射到上游 tmdb_id", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search("secret", {
      query: "Breaking Bad",
      tmdbId: 1396,
    });
    const params = getParams(fetchImpl);
    expect(params.get("tmdb_id")).toBe("1396");
  });

  it("season 映射到上游 season_number", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search("secret", {
      query: "Breaking Bad",
      season: 1,
    });
    const params = getParams(fetchImpl);
    expect(params.get("season_number")).toBe("1");
  });

  it("episode 映射到上游 episode_number", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search("secret", {
      query: "Breaking Bad",
      episode: 2,
    });
    const params = getParams(fetchImpl);
    expect(params.get("episode_number")).toBe("2");
  });

  it("language 映射到上游 languages", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search("secret", {
      query: "Inception",
      language: "en",
    });
    const params = getParams(fetchImpl);
    expect(params.get("languages")).toBe("en");
  });

  it("type 映射到上游 type", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search("secret", {
      query: "Inception",
      type: "movie",
    });
    const params = getParams(fetchImpl);
    expect(params.get("type")).toBe("movie");
  });

  it("无 query 时不设置 query 参数（ID-only 定位）", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search("secret", {
      imdbId: "tt1375666",
    });
    const params = getParams(fetchImpl);
    expect(params.get("query")).toBeNull();
    expect(params.get("imdb_id")).toBe("tt1375666");
  });

  it("老调用方仅传 query + language 时保持现有行为", async () => {
    const { fetchImpl, adapter } = createAdapterWithMock();
    await adapter.search("secret", {
      query: "Inception 2010",
      language: "en",
    });
    const params = getParams(fetchImpl);
    expect(params.get("query")).toBe("Inception 2010");
    expect(params.get("languages")).toBe("en");
    expect(params.get("imdb_id")).toBeNull();
    expect(params.get("tmdb_id")).toBeNull();
    expect(params.get("season_number")).toBeNull();
    expect(params.get("episode_number")).toBeNull();
    expect(params.get("type")).toBeNull();
  });
});
