/**
 * 字幕语言归一化与过滤工具。
 *
 * 迅雷上游返回的 `language` 字段不规范（空串 / `默认` / `CHSEN_权游` 等），
 * 但 `releaseName` 里基本带语言信号（`_zh_`、`简体`、`中文`、`_en_`、`CHS`、
 * `西语`、`韩文` 等）。这里用 `releaseName`（优先）+ 原始 `language`（兜底）判定真实语言，
 * 产出规范语言码，供聚合层在 SubHub 侧按请求的 `language` 统一过滤。
 */

const CJK_HAN = /[\u4e00-\u9fff]/;

// 显式中英双语标记（CHSEN = 简体中文 + English；CHTEN = 繁体中文 + English）
const BILINGUAL_MARKER = /chsen|chten|中英|双语/i;

// 显式中文标记。裸语言码（chs/cht/chi/chinese）加词边界，避免命中 Children/Chicago 等英文单词。
const CHINESE_MARKER =
  /_zh[_.]|_chs[_.]|_cht[_.]|_chi[_.]|\bchs\b|\bcht\b|\bchi\b|\bchinese\b|zh[-_](cn|tw|hans|hant|hk|sg|mo)|简体|繁体|简中|繁中|中文|\.gb|big5/i;

// 显式英文标记。eng 加词边界，避免命中 Avengers/strength 等英文单词；
// 英文/英语/英語 是中文语境下对 English 的显式标记，也归入英文。
const ENGLISH_MARKER = /_en[_.]|\benglish\b|\beng\b|\.en\.|英文|英语|英語/i;

// 繁体信号：命中则产出 zh-TW 而非 zh-CN
const TRADITIONAL_MARKER = /繁体|繁中|cht|zh[-_]tw|zh[-_]hant|big5/i;

// 其他语言的显式标记：命中即产出对应 ISO 639-1 码。
// 覆盖中文语境常用语言名（西语/韩文/日语…）与拉丁标记（全称 + 短码）。
// 短码用 `_xx_` / `.xx.` 分隔符匹配，避免命中普通英文单词（如 `_es_` 不会命中 process）。
const OTHER_LANGUAGE_MARKERS: ReadonlyArray<{
  code: string;
  marker: RegExp;
}> = [
  {
    code: "es",
    marker: /西语|西班牙语|西班牙文|\bspanish\b|_es[_.]|\.es\./i,
  },
  {
    code: "ko",
    marker: /韩文|韩语|朝鲜语|朝鲜文|\bkorean\b|_ko[_.]|\.ko\./i,
  },
  {
    code: "ja",
    marker: /日语|日文|\bjapanese\b|\bjpn\b|_ja[_.]|\.ja\./i,
  },
  {
    code: "fr",
    marker: /法语|法文|\bfrench\b|_fr[_.]|\.fr\./i,
  },
  {
    code: "de",
    marker: /德语|德文|\bgerman\b|_de[_.]|\.de\./i,
  },
  {
    code: "pt",
    marker: /葡语|葡萄牙语|葡萄牙文|\bportuguese\b|_pt[_.]|\.pt\./i,
  },
  {
    code: "ru",
    marker: /俄语|俄文|\brussian\b|_ru[_.]|\.ru\./i,
  },
  {
    code: "it",
    marker: /意语|意大利语|意大利文|\bitalian\b|_it[_.]|\.it\./i,
  },
  {
    code: "th",
    marker: /泰语|泰文|\bthai\b|_th[_.]|\.th\./i,
  },
  {
    code: "vi",
    marker: /越南语|越语|\bvietnamese\b|_vi[_.]|\.vi\./i,
  },
  {
    code: "ar",
    marker: /阿拉伯语|阿语|\barabic\b|_ar[_.]|\.ar\./i,
  },
];

// 原始 language 兜底：中文语言码（锚定整串，raw 值通常是短码）
const RAW_CHINESE =
  /^(zh|zho|chi|chs|cht|chn|cn|zh[-_]cn|zh[-_]tw|zh[-_]hans|zh[-_]hant|简体|繁体|中文)$/i;

// 原始 language 兜底：英文语言码
const RAW_ENGLISH = /^(en|eng|english)$/i;

// 语言码别名表：base（ISO 639-1 / ISO 639-2 / 英文名）→ 规范 ISO 639-1 码。
// 供 raw language 兜底与过滤 family 匹配共用。
const LANGUAGE_CODE_ALIASES: Readonly<Record<string, string>> = {
  // 中文族
  zh: "zh",
  zho: "zh",
  chi: "zh",
  chs: "zh",
  cht: "zh",
  chn: "zh",
  cn: "zh",
  // 英文族
  en: "en",
  eng: "en",
  english: "en",
  // 西班牙语
  es: "es",
  spa: "es",
  spanish: "es",
  // 韩语
  ko: "ko",
  kor: "ko",
  korean: "ko",
  // 日语
  ja: "ja",
  jpn: "ja",
  japanese: "ja",
  // 法语
  fr: "fr",
  fra: "fr",
  fre: "fr",
  french: "fr",
  // 德语
  de: "de",
  deu: "de",
  ger: "de",
  german: "de",
  // 葡萄牙语
  pt: "pt",
  por: "pt",
  portuguese: "pt",
  // 俄语
  ru: "ru",
  rus: "ru",
  russian: "ru",
  // 意大利语
  it: "it",
  ita: "it",
  italian: "it",
  // 泰语
  th: "th",
  tha: "th",
  thai: "th",
  // 越南语
  vi: "vi",
  vie: "vi",
  vietnamese: "vi",
  // 阿拉伯语
  ar: "ar",
  ara: "ar",
  arabic: "ar",
};

// 取语言码的 base 部分（去掉 `-` / `_` 后的区域后缀，如 zh-CN → zh）后查别名表。
const canonicalOf = (tag: string): string | null => {
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return LANGUAGE_CODE_ALIASES[base] ?? null;
};

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
  // 其他语言显式标记（西语/韩文/日语…）优先于 CJK 汉字兜底：
  // `权力的游戏_韩文.srt` 是「中文标题 + 韩文字幕」而非中文。
  for (const { code, marker } of OTHER_LANGUAGE_MARKERS) {
    if (marker.test(name)) return code;
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
  // 其他语言 raw 语言码按别名表映射到 ISO 639-1 码。
  const canonical = canonicalOf(raw);
  return canonical && canonical !== "zh" && canonical !== "en"
    ? canonical
    : null;
};

/**
 * 用 releaseName（优先）+ 原始 language（兜底）归一化出规范语言码。
 *
 * 返回 `zh-CN` / `zh-TW` / `en` / `zh-CN,en` / `zh-TW,en`，以及
 * `es` / `ko` / `ja` / `fr` / `de` / `pt` / `ru` / `it` / `th` / `vi` / `ar`；
 * 无法判定时返回 `null`。releaseName 一旦给出确定结果就不再参考原始 language，
 * 保证 releaseName 的优先级。
 */
export function resolveSubtitleLanguage(
  releaseName: string | null | undefined,
  rawLanguage: string | null | undefined,
): string | null {
  const name = (releaseName ?? "").trim();
  const raw = (rawLanguage ?? "").trim();

  return resolveFromName(name) ?? resolveFromRaw(raw);
}

const tagMatches = (candidate: string, requested: string): boolean => {
  if (candidate === requested) return true;
  const candidateCode = canonicalOf(candidate);
  const requestedCode = canonicalOf(requested);
  return candidateCode !== null && candidateCode === requestedCode;
};

/**
 * 判断归一化后的语言是否命中请求的语言过滤。
 *
 * - 忽略大小写精确匹配；
 * - 语言 family 匹配（`zh-CN`/`zh-TW` → `zh` 族、`en`/`eng` → `en` 族、
 *   `es`/`spa` → `es` 族等），兼容 opensubtitles 与归一化语言码；
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
