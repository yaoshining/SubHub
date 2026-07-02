# 契约: 字幕搜索请求模型

**分支**: `003-subtitle-search-fields` | **日期**: 2026-06-22

## 端点

```
GET /api/subtitles/search
```

## 请求参数

### 现有字段（保持不变）

| 参数       | 位置  | 类型    | 必填 | 校验                   | 说明                                    |
| ---------- | ----- | ------- | ---- | ---------------------- | --------------------------------------- |
| `title`    | query | string  | yes  | `minLength: 1`         | free-text 兜底 + 审计用作品名           |
| `year`     | query | integer | no   | `min: 1800, max: 3000` | 辅助区分同名作品                        |
| `season`   | query | integer | no   | `min: 0`               | 剧集季编号，映射到上游 `season_number`  |
| `episode`  | query | integer | no   | `min: 0`               | 剧集集编号，映射到上游 `episode_number` |
| `language` | query | string  | no   | `minLength: 1`         | 语言码，映射到上游 `languages`          |

### 新增字段

| 参数      | 位置  | 类型    | 必填 | 校验                 | 说明                                             |
| --------- | ----- | ------- | ---- | -------------------- | ------------------------------------------------ |
| `imdb_id` | query | string  | no   | `pattern: ^tt\d+$`   | IMDb ID 定位，优先于 `title` 的 query 构造       |
| `tmdb_id` | query | integer | no   | `min: 1`             | TMDb ID 定位，配合 `season`/`episode` 可定位单集 |
| `type`    | query | enum    | no   | `movie` \| `episode` | 媒体类型过滤                                     |

### 跨字段校验

| 条件                                                            | HTTP | 错误码              |
| --------------------------------------------------------------- | ---- | ------------------- |
| `type=movie` + (`season` 或 `episode` 存在)                     | 400  | `VALIDATION_FAILED` |
| `type=episode` + 缺 `season`/`episode` + 缺 `imdb_id`/`tmdb_id` | 400  | `VALIDATION_FAILED` |
| `imdb_id` 格式不合法                                            | 400  | `VALIDATION_FAILED` |
| `tmdb_id` < 1                                                   | 400  | `VALIDATION_FAILED` |

## 响应

响应结构 `SubtitleSearchResponse` 保持不变。

```typescript
type SubtitleSearchResponse = {
  status: "success";
  results: SubtitleSearchResult[];
};
```

## 兼容性

- 所有新增字段可选
- 老调用方不传新增字段时，行为与响应结构 100% 不变
- 老版本 generated client 无需升级即可继续工作

## 定位路径优先级

1. `imdb_id` 存在 → ID 定位路径（`imdb_id` 优先）
2. `tmdb_id` 存在 → ID 定位路径
3. 无 ID 字段 → query fallback 路径（现有 `buildSearchQuery` 逻辑）
4. `imdb_id` 与 `tmdb_id` 同时存在 → `imdb_id` 优先，`tmdb_id` 作为辅助

## OpenAPI 同步

`docs/api/openapi.yaml` 中 `/api/subtitles/search` 的 `parameters` 区块需新增 `imdb_id` / `tmdb_id` / `type` 三个 query parameter，并同步 `src/lib/api/generated/`。
