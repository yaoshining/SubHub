import { describe, expect, it } from "vitest";

import { searchParamsSchema } from "@/app/api/subtitles/search/route";

const parse = (input: Record<string, string>) =>
  searchParamsSchema.parse(input);

describe("字幕搜索 request validation", () => {
  describe("imdb_id", () => {
    it("合法 tt + 数字通过", () => {
      expect(parse({ title: "Inception", imdb_id: "tt1375666" })).toMatchObject(
        {
          imdb_id: "tt1375666",
        },
      );
    });

    it("缺少 tt 前缀返回 VALIDATION_FAILED", () => {
      expect(() => parse({ title: "Inception", imdb_id: "1375666" })).toThrow();
    });

    it("tt 后非数字返回 VALIDATION_FAILED", () => {
      expect(() => parse({ title: "Inception", imdb_id: "ttabc" })).toThrow();
    });
  });

  describe("tmdb_id", () => {
    it("合法正整数通过", () => {
      expect(parse({ title: "Breaking Bad", tmdb_id: "1396" })).toMatchObject({
        tmdb_id: 1396,
      });
    });

    it("0 返回 VALIDATION_FAILED", () => {
      expect(() => parse({ title: "Breaking Bad", tmdb_id: "0" })).toThrow();
    });

    it("负数返回 VALIDATION_FAILED", () => {
      expect(() => parse({ title: "Breaking Bad", tmdb_id: "-1" })).toThrow();
    });
  });

  describe("type 跨字段冲突校验", () => {
    it("type=movie + season 返回 VALIDATION_FAILED", () => {
      expect(() =>
        parse({ title: "Inception", type: "movie", season: "1" }),
      ).toThrow();
    });

    it("type=movie + episode 返回 VALIDATION_FAILED", () => {
      expect(() =>
        parse({ title: "Inception", type: "movie", episode: "1" }),
      ).toThrow();
    });

    it("type=movie 无 season/episode 通过", () => {
      expect(parse({ title: "Inception", type: "movie" })).toMatchObject({
        type: "movie",
      });
    });

    it("type=episode + season + episode 通过", () => {
      expect(
        parse({
          title: "Breaking Bad",
          type: "episode",
          season: "1",
          episode: "1",
        }),
      ).toMatchObject({ type: "episode", season: 1, episode: 1 });
    });

    it("type=episode + imdb_id 通过（ID 定位路径）", () => {
      expect(
        parse({
          title: "Breaking Bad",
          type: "episode",
          imdb_id: "tt0903747",
        }),
      ).toMatchObject({ type: "episode", imdb_id: "tt0903747" });
    });

    it("type=episode + tmdb_id 通过（ID 定位路径）", () => {
      expect(
        parse({
          title: "Breaking Bad",
          type: "episode",
          tmdb_id: "1396",
        }),
      ).toMatchObject({ type: "episode", tmdb_id: 1396 });
    });

    it("type=episode 缺 season/episode 且缺 ID 返回 VALIDATION_FAILED", () => {
      expect(() => parse({ title: "Breaking Bad", type: "episode" })).toThrow();
    });
  });

  describe("老调用方兼容", () => {
    it("仅传 title 通过", () => {
      expect(parse({ title: "Inception" })).toMatchObject({
        title: "Inception",
      });
    });

    it("传完整现有字段通过", () => {
      expect(
        parse({
          title: "Breaking Bad",
          year: "2008",
          season: "1",
          episode: "1",
          language: "en",
        }),
      ).toMatchObject({
        title: "Breaking Bad",
        year: 2008,
        season: 1,
        episode: 1,
        language: "en",
      });
    });
  });
});
