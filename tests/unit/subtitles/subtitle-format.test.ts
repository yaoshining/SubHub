import { describe, expect, it } from "vitest";

import { resolveSubtitleFormat } from "@/server/subtitles/subtitle-format";

describe("resolveSubtitleFormat", () => {
  it("null / undefined 回退 srt", () => {
    expect(resolveSubtitleFormat(null)).toBe("srt");
    expect(resolveSubtitleFormat(undefined)).toBe("srt");
  });

  it("无扩展名分隔符时回退 srt", () => {
    expect(resolveSubtitleFormat("Inception")).toBe("srt");
  });

  it("末段为已知字幕格式时返回该格式（小写）", () => {
    expect(resolveSubtitleFormat("Example.zh-CN.srt")).toBe("srt");
    expect(resolveSubtitleFormat("Movie.2010.BluRay.ass")).toBe("ass");
    expect(resolveSubtitleFormat("Movie.SUB")).toBe("sub");
    expect(resolveSubtitleFormat("Episode.01.en.vtt")).toBe("vtt");
  });

  it("末段为非字幕格式（发布名/语言标签/codec）时回退 srt", () => {
    expect(resolveSubtitleFormat("wmt-matrix-revisid.eng")).toBe("srt");
    expect(resolveSubtitleFormat("Inception.2010.1080p.bluray.mora.25r")).toBe(
      "srt",
    );
    expect(
      resolveSubtitleFormat(
        "The.Science.of.Interstellar.1080p.BluRay.x264.AAC.MVGroup.Forum",
      ),
    ).toBe("srt");
    expect(
      resolveSubtitleFormat(
        "El.Camino.A.Breaking.Bad.Movie.2019.1080p.NF.WEB-DL.H.264_[OFFiCiAL]",
      ),
    ).toBe("srt");
  });

  it("文件名以点结尾时回退 srt", () => {
    expect(resolveSubtitleFormat("Example.zh-CN.")).toBe("srt");
  });
});
