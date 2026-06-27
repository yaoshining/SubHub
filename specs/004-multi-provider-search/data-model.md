# Data Model: 多字幕 provider 搜索入口模型基础版（含迅雷字幕 provider 接入）

**日期**: 2026-06-27
**对应 plan**: `specs/004-multi-provider-search/plan.md`
**对应 spec**: `specs/004-multi-provider-search/spec.md`

> 第 1 阶段产物。本文档定义 `v0.2.2` 多 provider 聚合搜索入口的数据模型。

---

## 1. 模型总览

`v0.2.2` 引入的数据模型分为三个层级：

1. **聚合请求层**：`SubtitleSearchInput`（SubHub 对外契约）
2. **provider 适配层**：`SubtitleProviderAdapter` 接口与 `ProviderSearchOutcome`（provider 内部契约）
3. **聚合响应层**：`AggregatedSubtitleResult` + `SubtitleSearchData`（SubHub 对外契约）

数据库 schema 层（`v0.2.2` 不变更）：

- 本次 `v0.2.2` **不**做任何数据库 schema 变更：不扩展 `providerTypes` enum、不新增 migration、不变更 `providers` / `provider_credentials` / `subtitle_search_requests` 表结构。
- 迅雷 provider 在 `v0.2.2` 走「不依赖数据库 schema 的最小接入路径」：provider key → adapter 映射由 `provider-registry.ts` 代码层硬编码。
- 详见 `plan.md` §9.1 / `spec.md`「提供商元数据接入方式」。

---

## 2. 聚合请求层（`SubtitleSearchInput`）

### 2.1 字段清单

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `title` | string | ✅ | — | free-text 兜底；`v0.2.1` 已有必填字段 |
| `year` | integer | 否 | `undefined` | 范围 1800-3000；`v0.2.1` 已有字段 |
| `season` | integer | 否 | `undefined` | 非负整数；保持命名（不升级为 `season_number`） |
| `episode` | integer | 否 | `undefined` | 非负整数；保持命名 |
| `language` | string | 否 | `undefined` | 字符串；保持命名（不升级为 `languages`） |
| `imdbId` | string | 否 | `undefined` | 格式 `^tt\d+$`；`v0.2.1` 已有字段 |
| `tmdbId` | integer | 否 | `undefined` | 正整数；`v0.2.1` 已有字段 |
| `type` | enum `movie` / `episode` | 否 | `undefined` | `v0.2.1` 已有字段 |
| `query` | string | 否 | `undefined` | 自由文本；`v0.2.2` 新增；与 `title` 关系见 §2.3 |

### 2.2 字段优先级（gateway 内派生 provider 输入）

1. **ID 优先**：`imdbId` / `tmdbId` 优先于 `query` / `title`
2. **`imdbId` 优先于 `tmdbId`**：与 `v0.2.1` 一致
3. **`type=movie` 与季集字段冲突** MUST 返回 400：与 `v0.2.1` 一致
4. **`type=episode` 缺季集且缺 ID** MUST 返回 400：与 `v0.2.1` 一致
5. **`query` / `title` 兜底**：仅在无 ID 字段时走 free-text

### 2.3 `query` 与 `title` 的关系

| 调用方传入 | gateway 行为 |
|------------|--------------|
| 仅 `title` | OpenSubtitles：走 `buildSearchQuery`；迅雷：因缺 `query` 跳过 |
| 仅 `query` | OpenSubtitles：以 `query` 视为 `title`；迅雷：走 `name` 路径 |
| `query` + `title` | OpenSubtitles：以 `title` 为优先；迅雷：以 `query` 为 `name` 路径 |
| 两者皆无 | OpenSubtitles：必填校验失败（400）；迅雷：因缺 `query` 跳过 |

---

## 3. provider 适配层

### 3.1 `SubtitleProviderAdapter` 接口

```ts
// src/server/providers/provider-adapter.ts
import type { SelectedProviderCredential } from "@/server/providers/credential-pool";
import type { SubtitleSearchInput } from "@/server/subtitles/subtitle-gateway";

export type SubtitleProviderKey = "opensubtitles" | "xunlei";

export type ProviderSearchResult = {
  id: string;                                    // provider 内字幕 ID（由 adapter 内部生成）
  language: string | null;
  releaseName: string | null;
  format: string;                                // 字幕格式（如 srt / ass / sub）
  providerDownloadUrl: string | null;            // 【adapter 内部字段】provider 原始下载地址；仅供 adapter / download 路由内部使用，绝不作为公共 API 的 `downloadUrl` 透传
                                                  // OpenSubtitles 通常为 null（走 SubHub 网关）；迅雷为原始 `url`
                                                  // 公共响应的 `downloadUrl` 一律由 SubHub gateway 生成为 `/api/subtitles/download?subtitleId=...`
  raw?: Record<string, unknown>;                 // provider 原始字段（仅 adapter 内部使用）
  score?: number | null;                         // provider 原始评分（迅雷透传 score）
};

export type SkippedReason =
  | "missing_required_field"
  | "disabled"
  | "credential_missing";

export type ProviderSearchError = {
  reason: "upstream_failed" | "timeout" | "rate_limited" | "authentication_failed";
  message: string;                               // 不含堆栈
};

export type ProviderSearchOutcome =
  | { ok: true; skipped: false; results: ProviderSearchResult[] }
  | { ok: false; skipped: false; error: ProviderSearchError }
  | { ok: true; skipped: true; reason: SkippedReason; results: [] };

export interface SubtitleProviderAdapter {
  readonly key: SubtitleProviderKey;
  search(
    credential: SelectedProviderCredential | null,
    input: SubtitleSearchInput,
    options?: { fetchImpl?: typeof fetch; timeoutMs?: number }
  ): Promise<ProviderSearchOutcome>;
}
```

### 3.2 `provider-registry.ts` 轻量注册表

```ts
// src/server/providers/provider-registry.ts
import type {
  SubtitleProviderAdapter,
  SubtitleProviderKey,
} from "@/server/providers/provider-adapter";
import { OpenSubtitlesAdapter } from "@/server/providers/opensubtitles-adapter";
import { XunleiAdapter } from "@/server/providers/xunlei-adapter";

const adapters: Record<SubtitleProviderKey, SubtitleProviderAdapter> = {
  opensubtitles: new OpenSubtitlesAdapter(),
  xunlei: new XunleiAdapter(),
};

export function getAdapter(key: SubtitleProviderKey): SubtitleProviderAdapter {
  return adapters[key];
}

export function listProviderKeys(): SubtitleProviderKey[] {
  return Object.keys(adapters) as SubtitleProviderKey[];
}
```

### 3.3 各 provider 内派生输入（adapter 内部）

#### 3.3.1 OpenSubtitles 派生输入（沿用 `v0.2.1`）

```ts
type OpenSubtitlesInternalInput = {
  query?: string;
  imdbId?: string;
  tmdbId?: number;
  season?: number;
  episode?: number;
  language?: string;
  type?: "movie" | "episode";
};
```

- 沿用 `v0.2.1` 已落地的 `buildAdapterInput` 逻辑
- `query` 优先于 `title`（gateway 内合并）
- `imdbId` 优先于 `tmdbId`
- `query` ≥ 3 字符才透传

#### 3.3.2 迅雷 provider 派生输入（最小）

```ts
type XunleiInternalInput = {
  name?: string;        // 来自 SubtitleSearchInput.query（trim 后非空）
  languages?: string;   // 来自 SubtitleSearchInput.language（trim 后非空）
};
```

- 仅消费 `query` 与 `language`
- 其他字段（`imdbId` / `tmdbId` / `season` / `episode` / `type` / `year` / `title`） MUST 忽略，不传入上游
- `name` 缺失 MUST 返回 `{ ok: true, skipped: true, reason: 'missing_required_field' }`
- `languages` 缺失 MUST 返回 `{ ok: true, skipped: true, reason: 'missing_required_field' }`

---

## 4. 聚合响应层（`AggregatedSubtitleResult` + `SubtitleSearchData`）

### 4.1 `AggregatedSubtitleResult`

```ts
// src/server/subtitles/subtitle-result-normalizer.ts
export type AggregatedSubtitleResult = {
  id: string;                              // 网关生成的字幕引用；详见 §4.3
  provider: "opensubtitles" | "xunlei";    // SubHub 显式注入
  language: string | null;
  releaseName: string | null;
  format: string;
  downloadUrl: string;                     // 统一 /api/subtitles/download?subtitleId=...
  raw?: Record<string, unknown>;           // provider 原始字段；老调用方可忽略
  score?: number | null;                   // 迅雷 score 透传；OpenSubtitles 暂无
};
```

### 4.2 `SubtitleSearchData`（响应顶层）

```ts
export type ProviderFailureReason =
  | "upstream_failed"
  | "timeout"
  | "rate_limited"
  | "skipped_missing_fields"
  | "skipped_disabled"
  | "authentication_failed";

export type ProviderFailureInfo = {
  provider: "opensubtitles" | "xunlei";
  reason: ProviderFailureReason;
  message: string;                         // 不含堆栈
};

export type SubtitleSearchDataStatus = "success" | "partial";

export type SubtitleSearchData = {
  status: SubtitleSearchDataStatus;
  results: AggregatedSubtitleResult[];
  provider_failures?: ProviderFailureInfo[];
};

export type SubtitleSearchResponse = {
  data: SubtitleSearchData;
};
```

### 4.3 `id` 生成规则

| provider | id 格式 | 示例 |
|----------|---------|------|
| opensubtitles | `opensubtitles:{providerId}:{file_id}` | `opensubtitles:provider_abc:12345` |
| xunlei | `xunlei:{providerId}:{gcid}` 或 `xunlei:{providerId}:{cid}` | `xunlei:provider_xyz:abcdef0123456789` |

- `xunlei` 优先用 `gcid`（更长，更稳定）；缺失时回退 `cid`
- `providerId` 来自 `providers.id` 字段（即 Provider 表的主键）
- 网关生成的 id MUST 唯一；同一 provider 同一上游字幕在同一搜索请求中只出现一次

### 4.4 `downloadUrl` 生成规则

所有 provider MUST 走统一的 SubHub 网关下载入口：

```
/api/subtitles/download?subtitleId={id}
```

- `{id}` 即 `AggregatedSubtitleResult.id`
- download 路由根据 `id` 前缀（`opensubtitles:` / `xunlei:`）判断 provider，再走各自 adapter 的下载流程
- 迅雷原始 `url` 保留在 `raw.url` 用于调试 / 审计 / 后续直接访问场景

### 4.5 `raw` 字段保留策略

`raw` MUST 保留 provider 原始响应中的关键字段，便于后续做质量分析、provider 能力扩展、调试：

#### OpenSubtitles `raw` 字段

| 字段 | 来源 |
|------|------|
| `download_count` | OpenSubtitles attributes.download_count |
| `upload_date` | OpenSubtitles attributes.upload_date（如有） |
| `feature_id` | OpenSubtitles feature_id（如有） |
| `file_id` | OpenSubtitles files[0].file_id（如有） |
| `original_payload` | OpenSubtitles 原始条目（用于审计） |

#### 迅雷 `raw` 字段

| 字段 | 来源 |
|------|------|
| `cid` | 迅雷 cid |
| `gcid` | 迅雷 gcid |
| `url` | 迅雷 url（原始下载 URL，不暴露给 client） |
| `ext` | 迅雷 ext |
| `duration` | 迅雷 duration（视频时长） |
| `languages` | 迅雷 languages（原始语言列表） |
| `source` | 迅雷 source |
| `score` | 迅雷 score（原始评分） |
| `fingerprintf_score` | 迅雷 fingerprintf_score |
| `extra_name` | 迅雷 extra_name |
| `mt` | 迅雷 mt |
| `original_payload` | 迅雷原始条目（用于审计） |

---

## 5. 数据库 schema（`v0.2.2` 不变更）

> ⚠️ **范围声明**：本次 `v0.2.2` 不做任何数据库 schema 变更。不扩展 enum、不新增 migration、不修改表结构。

- `src/server/storage/schema.ts` 中 `providerTypes` enum 保持 `["opensubtitles"]` 单值
- `providers` / `provider_credentials` / `subtitle_search_requests` 表结构不变
- 本次 PR 不出现任何新增 migration 文件
- 如后续需将迅雷 provider 元数据持久化，需由 post-`v0.2.2` 独立 spec 推进并先升级 `versioning.md` 中 `v0.2.2` 范围（很可能升 `v0.3.0`）
- 其他表结构不变

### 5.4 种子数据（可选）

若需要在本地开发或测试环境预置迅雷 provider 记录，可考虑在 `scripts/db/seed-dev.ts` 中追加 `xunlei` provider 种子记录；但此为可选，不在本 plan 强制要求范围内。

---

## 6. 关系图

```
                  ┌─────────────────────────┐
                  │ SubtitleSearchInput     │  (gateway input)
                  └────────────┬────────────┘
                               │
                  ┌────────────▼────────────┐
                  │ subtitle-gateway.ts     │  (聚合编排)
                  │  - provider 选择        │
                  │  - 串行调用             │
                  │  - 错误隔离             │
                  │  - 结果归一化           │
                  └────────────┬────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                                 │
   ┌──────────▼──────────┐         ┌─────────────▼────────────┐
   │ OpenSubtitlesAdapter│         │ XunleiAdapter            │
   │ (SubtitleProviderA  │         │ (SubtitleProviderAdapter)│
   │  dapter 实现)       │         │                          │
   └──────────┬──────────┘         └─────────────┬────────────┘
              │                                 │
              │  ProviderSearchResult[]          │  ProviderSearchResult[]
              │                                 │
              └────────────────┬────────────────┘
                               │
                  ┌────────────▼────────────┐
                  │ subtitle-result-normalizer│  (归一化)
                  │  - 注入 provider 字段    │
                  │  - 保留 raw 字段         │
                  └────────────┬────────────┘
                               │
                  ┌────────────▼────────────┐
                  │ SubtitleSearchResponse  │  (gateway output)
                  │  {                      │
                  │    data: {              │
                  │      status,            │
                  │      results,           │
                  │      provider_failures? │
                  │    }                    │
                  │  }                      │
                  └─────────────────────────┘
```

---

## 7. 数据模型不变性保证

| 不变性 | 保证 |
|--------|------|
| 老调用方消费路径向后兼容 | `AggregatedSubtitleResult.id` / `language` / `releaseName` / `format` / `downloadUrl` 字段集不变；`provider` 当前值 `opensubtitles` 保持有效 |
| provider 来源字段 | `provider` MUST 由 SubHub 注入；不允许直接复用 provider 原始数据中的同名字段 |
| 必要条件缺失 | adapter MUST 返回 `skipped: true` 而非抛错 |
| 凭据池隔离 | OpenSubtitles 凭据池行为 MUST 不变；迅雷 provider 不接入凭据池 |
| 路由契约 | route Zod schema MUST 不引入新必填字段；`query` 作为可选字段透传 |

---

## 8. 数据模型版本演进

`v0.2.2` 数据模型与 `v0.2.1` 的差异（增量）：

| 维度 | v0.2.1 | v0.2.2 增量 |
|------|--------|--------------|
| 请求模型 | `SubtitleSearchInput`（OpenSubtitles 单 provider 视角） | 新增 `query` 字段 |
| 响应模型 | `SubtitleSearchResult`（provider enum 单值） | provider enum 扩展为 `[opensubtitles, xunlei]`；新增 `raw` / `score` / `provider_failures` / `status: partial` |
| provider 适配层 | 单 provider（OpenSubtitles） | 引入 `SubtitleProviderAdapter` 接口 + `provider-registry` + `XunleiAdapter` |
| 数据库 schema | `providerTypes = ["opensubtitles"]` | **无变更**（`v0.2.2` 不扩展 enum、不新增 migration） |
| provider 元数据 | OpenSubtitles | 迅雷 provider 走代码层硬编码（`provider-registry`），不依赖 `providers` 表持久化 |
| 凭据池 | 仅 OpenSubtitles | 迅雷 provider 不接入凭据池 |

`v0.2.2` 严格保持 `v0.2.1` 行为不变；新增能力通过增量字段暴露。
