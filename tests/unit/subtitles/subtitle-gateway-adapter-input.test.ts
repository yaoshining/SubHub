import { describe, expect, it } from "vitest";

import { buildAdapterInput } from "@/server/subtitles/subtitle-gateway";

describe("buildAdapterInput 定位路径分流", () => {
  describe("ID 定位路径", () => {
    it("有 imdbId 时走 ID 定位路径，query 为 title 辅助", () => {
      expect(
        buildAdapterInput({
          title: "Inception",
          year: 2010,
          imdbId: "tt1375666",
          language: "en",
        }),
      ).toEqual({
        query: "Inception",
        imdbId: "tt1375666",
        tmdbId: undefined,
        season: undefined,
        episode: undefined,
        language: "en",
        type: undefined,
      });
    });

    it("有 tmdbId 时走 ID 定位路径", () => {
      expect(
        buildAdapterInput({
          title: "Breaking Bad",
          tmdbId: 1396,
          season: 1,
          episode: 1,
          type: "episode",
        }),
      ).toEqual({
        query: "Breaking Bad",
        imdbId: undefined,
        tmdbId: 1396,
        season: 1,
        episode: 1,
        language: undefined,
        type: "episode",
      });
    });

    it("imdbId 与 tmdbId 同时存在时 imdbId 优先，tmdbId 不传", () => {
      expect(
        buildAdapterInput({
          title: "Inception",
          imdbId: "tt1375666",
          tmdbId: 27205,
        }),
      ).toEqual({
        query: "Inception",
        imdbId: "tt1375666",
        tmdbId: undefined,
        season: undefined,
        episode: undefined,
        language: undefined,
        type: undefined,
      });
    });

    it("ID 路径下 year 不参与 query 构造", () => {
      const result = buildAdapterInput({
        title: "Inception",
        year: 2010,
        imdbId: "tt1375666",
      });
      expect(result.query).toBe("Inception");
    });
  });

  describe("query fallback 路径", () => {
    it("无 ID 字段时走 buildSearchQuery 逻辑，构造 title + year + SxxExx", () => {
      expect(
        buildAdapterInput({
          title: "Breaking Bad",
          year: 2008,
          season: 1,
          episode: 2,
          language: "en",
        }),
      ).toEqual({
        query: "Breaking Bad 2008 S01E02",
        imdbId: undefined,
        tmdbId: undefined,
        season: 1,
        episode: 2,
        language: "en",
        type: undefined,
      });
    });

    it("仅传 title 时 query 为 title", () => {
      expect(buildAdapterInput({ title: "Inception" })).toEqual({
        query: "Inception",
        imdbId: undefined,
        tmdbId: undefined,
        season: undefined,
        episode: undefined,
        language: undefined,
        type: undefined,
      });
    });

    it("fallback 路径下 type 仍透传", () => {
      const result = buildAdapterInput({
        title: "Inception",
        type: "movie",
      });
      expect(result.type).toBe("movie");
      expect(result.query).toBe("Inception");
    });
  });
});
