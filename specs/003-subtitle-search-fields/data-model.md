# 数据模型: 字幕搜索接口扩展检索字段

**分支**: `003-subtitle-search-fields` | **日期**: 2026-06-22

## 概述

本功能不新增数据库实体。核心数据结构为接口契约层的请求模型，属于运行时类型而非持久化实体。

## 接口契约层

### SubtitleSearchInput（网关层请求模型）

SubHub 对外稳定的搜索请求模型，定义在 `src/server/subtitles/subtitle-gateway.ts`。

```typescript
type SubtitleSearchInput = {
  title: string;          // required，free-text 兜底 + 审计用作品名
  year?: number;          // optional，1800-3000
  season?: number;        // optional，≥0，映射到上游 season_number
  episode?: number;       // optional，≥0，映射到上游 episode_number
  language?: string;      // optional，语言码，映射到上游 languages
  imdbId?: string;        // 新增，optional，格式 ^tt\d+$
  tmdbId?: number;        // 新增，optional，≥1
  type?: "movie" | "episode";  // 新增，optional
};
```

**字段映射**:

| SubHub 字段 | 上游字段 | 说明 |
|-------------|----------|------|
| `title` | `query` | 当无 ID 字段时映射；有 ID 时不参与上游 query |
| `year` | `year` | 直接透传 |
| `season` | `season_number` | 命名映射 |
| `episode` | `episode_number` | 命名映射 |
| `language` | `languages` | 命名映射 |
| `imdbId` | `imdb_id` | 命名映射 |
| `tmdbId` | `tmdb_id` | 命名映射 |
| `type` | `type` | 直接透传 |

### OpenSubtitlesSearchInput（适配器层请求模型）

适配器层接受 SubHub 稳定字段，负责映射到上游参数，定义在 `src/server/providers/opensubtitles-adapter.ts`。

```typescript
type OpenSubtitlesSearchInput = {
  query?: string;         // free-text，当无 ID 或 title 存在时构造
  imdbId?: string;        // 映射到上游 imdb_id
  tmdbId?: number;        // 映射到上游 tmdb_id
  season?: number;        // 映射到上游 season_number
  episode?: number;       // 映射到上游 episode_number
  language?: string;      // 映射到上游 languages
  type?: "movie" | "episode";  // 映射到上游 type
};
```

### 定位路径分流

```
buildAdapterInput(input: SubtitleSearchInput): OpenSubtitlesSearchInput

if input.imdbId or input.tmdbId exists:
  → ID 定位路径
    - 传 imdbId / tmdbId / season / episode / language / type
    - query 仅在 title 存在时作为辅助
else:
  → query fallback 路径
    - 走现有 buildSearchQuery 逻辑（拼 title + year + SxxExx）
    - 传 language
```

## 持久化层

### subtitleSearchRequests（审计表，不扩展）

现有字段保持不变：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mediaTitle` | `text NOT NULL` | 来自 `input.title` |
| `mediaYear` | `integer` | 来自 `input.year` |
| `season` | `integer` | 来自 `input.season` |
| `episode` | `integer` | 来自 `input.episode` |
| `language` | `text` | 来自 `input.language` |

**不扩展的字段**: `imdbId` / `tmdbId` / `type` 不新增列。理由：spec 明确不做新数据库 schema 设计；审计扩展属于 NFR-3 的 SHOULD 而非 MUST。

## 校验规则

### 字段级校验

| 字段 | 规则 |
|------|------|
| `title` | `string.min(1)`，required |
| `year` | `integer.min(1800).max(3000)`，optional |
| `season` | `integer.min(0)`，optional |
| `episode` | `integer.min(0)`，optional |
| `language` | `string.min(1)`，optional |
| `imdbId` | `string.regex(/^tt\d+$/)`，optional |
| `tmdbId` | `integer.min(1)`，optional |
| `type` | `enum(["movie", "episode"])`，optional |

### 跨字段校验

| 条件 | 结果 |
|------|------|
| `type=movie` + (`season` 或 `episode` 存在) | `VALIDATION_FAILED` |
| `type=episode` + 缺 `season`/`episode` + 缺 `imdbId`/`tmdbId` | `VALIDATION_FAILED` |

## 状态转换

本功能不涉及状态转换。定位路径分流是运行时决策，不是持久化状态。
