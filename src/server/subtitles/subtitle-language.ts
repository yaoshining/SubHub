/**
 * 字幕语言归一化与过滤工具。
 *
 * 迅雷上游返回的 `language` 字段不规范（空串 / `默认` / `CHSEN_权游` 等），
 * 但 `releaseName` 里基本带语言信号（`_zh_`、`简体`、`中文`、`_en_`、`CHS` 等）。
 * 这里用 `releaseName`（优先）+ 原始 `language`（兜底）判定真实语言，产出规范语言码，
 * 供聚合层在 SubHub 侧按请求的 `language` 统一过滤。
 */

const CJK_HAN = /[\u4e00-\u9fff]/;

// 显式中文标记（含「中英/双语」这类双语标记，由 BILINGUAL_MARKER 优先命中）
const CHINESE_MARKER =
  /_zh[_.]|简体|繁体|简中|繁中|中文|中英|双语|chs|cht|chi|chinese|\.gb|big5/i;

// 显式英文标记
const ENGLISH_MARKER = /_en[_.]|english|eng|\.en\./i;

// 显式中英双语标记（CHSEN = 简体中文 + English；CHTEN = 繁体中文 + English）
const BILINGUAL_MARKER = /chsen|chten|中英|双语/i;

// 繁体信号：命中则产出 zh-TW 而非 zh-CN
const TRADITIONAL_MARKER = /繁体|繁中|cht|zh[-_]tw|zh[-_]hant|big5/i;

// 原始 language 兜底：中文语言码
const CHINESE_CODE = /zh|zho|chi|chs|cht|chn|cn|简|繁|中文/i;

// 原始 language 兜底：英文语言码
const ENGLISH_CODE = /en|eng|english/i;

/**
 * 用 releaseName（优先）+ 原始 language（兜底）归一化出规范语言码。
 *
 * 返回 `zh-CN` / `zh-TW` / `en` / `zh-CN,en` / `zh-TW,en`，无法判定时返回 `null`。
 */
export function resolveSubtitleLanguage(
  releaseName: string | null | undefined,
  rawLanguage: string | null | undefined,
): string | null {
  const name = (releaseName ?? "").trim();
  const raw = (rawLanguage ?? "").trim();

  const bilingual = BILINGUAL_MARKER.test(name) || BILINGUAL_MARKER.test(raw);
  const chineseMarker = CHINESE_MARKER.test(name) || CHINESE_MARKER.test(raw);
  const englishMarker = ENGLISH_MARKER.test(name) || ENGLISH_MARKER.test(raw);
  const hasCjk = CJK_HAN.test(name);
  const rawChinese = CHINESE_CODE.test(raw);
  const rawEnglish = ENGLISH_CODE.test(raw);
  const traditional =
    TRADITIONAL_MARKER.test(name) || TRADITIONAL_MARKER.test(raw);

  let isChinese: boolean;
  let isEnglish: boolean;

  if (bilingual) {
    isChinese = true;
    isEnglish = true;
  } else if (chineseMarker) {
    isChinese = true;
    isEnglish = false;
  } else if (englishMarker) {
    // 显式英文标记优先于 CJK 汉字：`一枕山河踏月来_en_16_...` 是「中文标题 + 英文字幕」。
    isChinese = false;
    isEnglish = true;
  } else if (hasCjk) {
    isChinese = true;
    isEnglish = false;
  } else if (rawChinese) {
    isChinese = true;
    isEnglish = false;
  } else if (rawEnglish) {
    isChinese = false;
    isEnglish = true;
  } else {
    isChinese = false;
    isEnglish = false;
  }

  if (isChinese && isEnglish) {
    return traditional ? "zh-TW,en" : "zh-CN,en";
  }
  if (isChinese) {
    return traditional ? "zh-TW" : "zh-CN";
  }
  if (isEnglish) {
    return "en";
  }
  return null;
}

const familyOf = (tag: string): "zh" | "en" | null => {
  if (/^(zh|zho|chi|chs|cht|chn|cn)([-_].*)?$/.test(tag)) return "zh";
  if (/^(en|eng|english)$/.test(tag)) return "en";
  return null;
};

const tagMatches = (candidate: string, requested: string): boolean => {
  if (candidate === requested) return true;
  const candidateFamily = familyOf(candidate);
  const requestedFamily = familyOf(requested);
  return candidateFamily !== null && candidateFamily === requestedFamily;
};

/**
 * 判断归一化后的语言是否命中请求的语言过滤。
 *
 * - 忽略大小写精确匹配；
 * - 中文族 / 英文族 family 匹配（兼容 opensubtitles 的 `zh`/`en` 与归一化的 `zh-CN`/`zh-TW`）；
 * - 结果语言按 `,` 或 `/` 拆分（覆盖双语 `zh-CN,en`）。
 */
export function matchesLanguageFilter(
  language: string | null | undefined,
  requested: string | null | undefined,
): boolean {
  if (!language || !requested) return false;
  const req = requested.trim().toLowerCase();
  if (!req) return false;

  return language
    .toLowerCase()
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => tagMatches(part, req));
}
