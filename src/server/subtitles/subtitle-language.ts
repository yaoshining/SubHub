/**
 * 字幕语言归一化与过滤工具。
 *
 * 迅雷上游返回的 `language` 字段不规范（空串 / `默认` / `CHSEN_权游` 等），
 * 但 `releaseName` 里基本带语言信号（`_zh_`、`简体`、`中文`、`_en_`、`CHS` 等）。
 * 这里用 `releaseName`（优先）+ 原始 `language`（兜底）判定真实语言，产出规范语言码，
 * 供聚合层在 SubHub 侧按请求的 `language` 统一过滤。
 */

const CJK_HAN = /[\u4e00-\u9fff]/;

// 显式中英双语标记（CHSEN = 简体中文 + English；CHTEN = 繁体中文 + English）
const BILINGUAL_MARKER = /chsen|chten|中英|双语/i;

// 显式中文标记。裸语言码（chs/cht/chi/chinese）加词边界，避免命中 Children/Chicago 等英文单词。
const CHINESE_MARKER =
  /_zh[_.]|_chs[_.]|_cht[_.]|_chi[_.]|\bchs\b|\bcht\b|\bchi\b|\bchinese\b|zh[-_](cn|tw|hans|hant|hk|sg|mo)|简体|繁体|简中|繁中|中文|\.gb|big5/i;

// 显式英文标记。eng 加词边界，避免命中 Avengers/strength 等英文单词。
const ENGLISH_MARKER = /_en[_.]|\benglish\b|\beng\b|\.en\./i;

// 繁体信号：命中则产出 zh-TW 而非 zh-CN
const TRADITIONAL_MARKER = /繁体|繁中|cht|zh[-_]tw|zh[-_]hant|big5/i;

// 原始 language 兜底：中文语言码（锚定整串，raw 值通常是短码）
const RAW_CHINESE =
  /^(zh|zho|chi|chs|cht|chn|cn|zh[-_]cn|zh[-_]tw|zh[-_]hans|zh[-_]hant|简体|繁体|中文)$/i;

// 原始 language 兜底：英文语言码
const RAW_ENGLISH = /^(en|eng|english)$/i;

const resolveFromName = (name: string): string | null => {
  if (!name) return null;
  const traditional = TRADITIONAL_MARKER.test(name);

  if (BILINGUAL_MARKER.test(name)) {
    return traditional ? "zh-TW,en" : "zh-CN,en";
  }
  if (CHINESE_MARKER.test(name)) {
    return traditional ? "zh-TW" : "zh-CN";
  }
  // 显式英文标记优先于 CJK 汉字：`一枕山河踏月来_en_16_...` 是「中文标题 + 英文字幕」。
  if (ENGLISH_MARKER.test(name)) {
    return "en";
  }
  if (CJK_HAN.test(name)) {
    return traditional ? "zh-TW" : "zh-CN";
  }
  return null;
};

const resolveFromRaw = (raw: string): string | null => {
  if (!raw) return null;
  const traditional = TRADITIONAL_MARKER.test(raw);

  if (RAW_CHINESE.test(raw)) {
    return traditional ? "zh-TW" : "zh-CN";
  }
  if (RAW_ENGLISH.test(raw)) {
    return "en";
  }
  return null;
};

/**
 * 用 releaseName（优先）+ 原始 language（兜底）归一化出规范语言码。
 *
 * 返回 `zh-CN` / `zh-TW` / `en` / `zh-CN,en` / `zh-TW,en`，无法判定时返回 `null`。
 * releaseName 一旦给出确定结果就不再参考原始 language，保证 releaseName 的优先级。
 */
export function resolveSubtitleLanguage(
  releaseName: string | null | undefined,
  rawLanguage: string | null | undefined,
): string | null {
  const name = (releaseName ?? "").trim();
  const raw = (rawLanguage ?? "").trim();

  return resolveFromName(name) ?? resolveFromRaw(raw);
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
