import { describe, expect, it } from "vitest";

import {
  matchesLanguageFilter,
  resolveSubtitleLanguage,
} from "@/server/subtitles/subtitle-language";

describe("resolveSubtitleLanguage - releaseName 优先归一化", () => {
  it("中英双语标记 CHSEN 归为 zh-CN,en", () => {
    expect(resolveSubtitleLanguage("CHSEN_权游.srt", "CHSEN_权游")).toBe(
      "zh-CN,en",
    );
  });

  it("繁体中英双语 CHTEN 归为 zh-TW,en", () => {
    expect(resolveSubtitleLanguage("CHTEN_xx.srt", "CHTEN_xx")).toBe(
      "zh-TW,en",
    );
  });

  it("无显式标记但含 CJK 汉字归为中文", () => {
    expect(resolveSubtitleLanguage("权力的游戏.第02季第01集...", "")).toBe(
      "zh-CN",
    );
  });

  it("_zh_ 标记归为中文", () => {
    expect(resolveSubtitleLanguage("一枕山河踏月来_zh_3_...ass", "")).toBe(
      "zh-CN",
    );
  });

  it("中文标记归为中文", () => {
    expect(
      resolveSubtitleLanguage("御赐小仵作_29_中文含硬字幕片尾.srt", ""),
    ).toBe("zh-CN");
  });

  it("简体标记归为中文", () => {
    expect(resolveSubtitleLanguage("御赐小仵作_02_中文(简体).ass", "")).toBe(
      "zh-CN",
    );
  });

  it("繁体标记归为 zh-TW", () => {
    expect(resolveSubtitleLanguage("御赐小仵作_02_繁体.ass", "")).toBe("zh-TW");
  });

  it("显式英文标记优先于 CJK 汉字", () => {
    expect(resolveSubtitleLanguage("一枕山河踏月来_en_16_...ass", "")).toBe(
      "en",
    );
  });

  it("无任何信号时返回 null（不猜测英文）", () => {
    expect(resolveSubtitleLanguage("game.of.thrones.srt", "")).toBeNull();
  });

  it("原始 language 兜底命中中文", () => {
    expect(resolveSubtitleLanguage("", "zh")).toBe("zh-CN");
    expect(resolveSubtitleLanguage("", "chi")).toBe("zh-CN");
    expect(resolveSubtitleLanguage("", "cht")).toBe("zh-TW");
  });

  it("原始 language 兜底命中英文", () => {
    expect(resolveSubtitleLanguage("", "en")).toBe("en");
  });

  it("releaseName 与原始 language 均为空返回 null", () => {
    expect(resolveSubtitleLanguage(null, null)).toBeNull();
    expect(resolveSubtitleLanguage("", "默认")).toBeNull();
  });
});

describe("resolveSubtitleLanguage - 回归：词边界与优先级", () => {
  it("英文单词子串 chi 不误判为中文（Children / Chicago）", () => {
    expect(resolveSubtitleLanguage("Children.of.Men.2006.srt", "")).toBeNull();
    expect(resolveSubtitleLanguage("Chicago.2002.srt", "")).toBeNull();
  });

  it("英文单词子串 eng 不误判为英文标记（Avengers）", () => {
    expect(resolveSubtitleLanguage("Avengers.Endgame.2019.srt", "")).toBeNull();
  });

  it("zh-TW / zh-CN 标记被识别为中文", () => {
    expect(resolveSubtitleLanguage("movie.zh-TW.srt", "")).toBe("zh-TW");
    expect(resolveSubtitleLanguage("movie.zh-CN.srt", "")).toBe("zh-CN");
  });

  it("繁体标记单独出现也归为中文 zh-TW", () => {
    expect(resolveSubtitleLanguage("movie.big5.srt", "")).toBe("zh-TW");
  });

  it("releaseName 显式英文优先于原始 language 中文", () => {
    expect(resolveSubtitleLanguage("movie_en_16.srt", "中文")).toBe("en");
  });

  it("releaseName 显式中文优先于原始 language 英文", () => {
    expect(resolveSubtitleLanguage("movie_zh_16.srt", "en")).toBe("zh-CN");
  });
});

describe("matchesLanguageFilter - 语言过滤匹配", () => {
  it("精确匹配（忽略大小写）", () => {
    expect(matchesLanguageFilter("zh-CN", "zh-CN")).toBe(true);
    expect(matchesLanguageFilter("EN", "en")).toBe(true);
    expect(matchesLanguageFilter("pt-BR", "pt-BR")).toBe(true);
  });

  it("中文族匹配", () => {
    expect(matchesLanguageFilter("zh", "zh-CN")).toBe(true);
    expect(matchesLanguageFilter("zh-TW", "zh-CN")).toBe(true);
    expect(matchesLanguageFilter("zh-CN", "zh")).toBe(true);
    expect(matchesLanguageFilter("zh-CN", "chi")).toBe(true);
    expect(matchesLanguageFilter("zh-CN", "chs")).toBe(true);
  });

  it("英文族匹配", () => {
    expect(matchesLanguageFilter("en", "eng")).toBe(true);
    expect(matchesLanguageFilter("english", "en")).toBe(true);
  });

  it("双语结果命中任一语言分量", () => {
    expect(matchesLanguageFilter("zh-CN,en", "zh-CN")).toBe(true);
    expect(matchesLanguageFilter("zh-CN,en", "en")).toBe(true);
    expect(matchesLanguageFilter("zh-CN/en", "en")).toBe(true);
  });

  it("不匹配的语言被排除", () => {
    expect(matchesLanguageFilter("en", "zh-CN")).toBe(false);
    expect(matchesLanguageFilter("pt-BR", "zh-CN")).toBe(false);
    expect(matchesLanguageFilter("fr", "en")).toBe(false);
  });

  it("null / 空语言永不命中过滤", () => {
    expect(matchesLanguageFilter(null, "zh-CN")).toBe(false);
    expect(matchesLanguageFilter("", "zh-CN")).toBe(false);
    expect(matchesLanguageFilter("zh-CN", null)).toBe(false);
    expect(matchesLanguageFilter("zh-CN", "")).toBe(false);
  });
});
