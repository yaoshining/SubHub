# Contract: 聚合字幕搜索请求模型

**日期**: 2026-06-27
**对应 plan**: `specs/004-multi-provider-search/plan.md`
**对应 spec**: `specs/004-multi-provider-search/spec.md`

> 第 1 阶段产物。本文档定义 `v0.2.2` 聚合字幕搜索请求模型的对外契约。

---

## 1. 概述

`v0.2.2` 引入稳定的 `SubtitleSearchInput` 聚合请求模型，作为 SubHub 对外长期契约。该模型：

- 不直接 1:1 暴露 OpenSubtitles 或迅雷字幕的上游 query params
- 保留 `v0.2.1` 已有字段与命名以避免 breaking
- 允许 provider 按自身能力选择性消费字段
- "字段可传"不等于"provider 一定消费"

---

## 2. 字段清单

### 2.1 必填字段

| 字段    | 类型   | 必填 | 说明                             |
| ------- | ------ | ---- | -------------------------------- |
| `title` | string | ✅   | free-text 兜底；与 `v0.2.1` 一致 |

### 2.2 可选字段（首批纳入）

| 字段       | 类型                     | 必填 | 校验           | provider 消费                             |
| ---------- | ------------------------ | ---- | -------------- | ----------------------------------------- |
| `year`     | integer                  | 否   | 范围 1800-3000 | OpenSubtitles；迅雷忽略                   |
| `season`   | integer                  | 否   | 非负整数       | OpenSubtitles；迅雷忽略                   |
| `episode`  | integer                  | 否   | 非负整数       | OpenSubtitles；迅雷忽略                   |
| `language` | string                   | 否   | minLength 1    | OpenSubtitles + 迅雷                      |
| `imdb_id`  | string                   | 否   | `^tt\d+$`      | OpenSubtitles；迅雷忽略                   |
| `tmdb_id`  | integer                  | 否   | ≥ 1            | OpenSubtitles；迅雷忽略                   |
| `type`     | enum `movie` / `episode` | 否   | —              | OpenSubtitles；迅雷忽略                   |
| `query`    | string                   | 否   | minLength 1    | OpenSubtitles + 迅雷（迅雷映射为 `name`） |

### 2.3 不暴露字段（首批不在请求模型中）

| 字段                 | 不暴露原因                                    |
| -------------------- | --------------------------------------------- |
| `season_number`      | 字段改名阶段处理；保持 `season` 避免 breaking |
| `episode_number`     | 字段改名阶段处理；保持 `episode`              |
| `languages`（复数）  | 与 `language` 命名冲突；字段改名阶段处理      |
| `filename`           | 价值有限；待评估                              |
| `moviehash`          | 需调用方客户端预计算哈希                      |
| `hearing_impaired`   | 偏好过滤，非定位字段                          |
| `foreign_parts_only` | 语义较窄，上游支持不稳定                      |

---

## 3. 校验规则

### 3.1 基础校验（route Zod schema）

- `title` 必填，trim 后非空
- `year` 范围 1800-3000
- `season` / `episode` 非负整数
- `language` trim 后非空
- `imdb_id` 格式 `^tt\d+$`
- `tmdb_id` 正整数
- `type` enum `movie` / `episode`

### 3.2 冲突校验（继承自 `v0.2.1`）

- `type=movie` 与 `season` / `episode` 同时出现 MUST 返回 400
- `type=episode` 缺 `season` / `episode` 且缺 `imdb_id` / `tmdb_id` MUST 返回 400

### 3.3 provider 消费差异（非校验）

- "字段可传"不等于"provider 一定消费"是契约明示边界
- provider 内部 MUST 仅消费其支持的字段；不支持字段 MUST 静默忽略
- 当 provider 缺少"必须"字段（迅雷的 `query` 与 `languages`）时，gateway MUST 跳过该 provider 而非报错

---

## 4. 字段优先级（gateway 内派生 provider 输入时）

1. **ID 优先**：`imdb_id` / `tmdb_id` 优先于 `query` / `title`
2. **`imdb_id` 优先于 `tmdb_id`**：与 `v0.2.1` 一致
3. **季集与类型协同**：`season` / `episode` 仅在 `type=episode` 或已有 ID 定位下作为精修字段
4. **`query` / `title` 兜底**：仅在无 ID 字段时走 free-text
5. **辅助字段**：`filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only` 首批不纳入

---

## 5. `query` 与 `title` 的关系

| 调用方传入        | gateway 行为                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| 仅 `title`        | OpenSubtitles：参与 `buildSearchQuery`；迅雷：因缺 `query` 跳过             |
| 仅 `query`        | OpenSubtitles：以 `query` 视为 `title`；迅雷：走 `name` 路径                |
| `query` + `title` | OpenSubtitles：以 `title` 为优先拼入 query；迅雷：以 `query` 为 `name` 路径 |
| 两者皆无          | OpenSubtitles：必填校验失败（400）；迅雷：因缺 `query` 跳过                 |

---

## 6. OpenAPI 真源

### 6.1 `/api/subtitles/search` parameters

```yaml
parameters:
  - name: title
    in: query
    required: true
    schema:
      type: string
      minLength: 1
  - name: year
    in: query
    required: false
    schema:
      type: integer
      minimum: 1800
      maximum: 3000
  - name: season
    in: query
    required: false
    schema:
      type: integer
      minimum: 0
  - name: episode
    in: query
    required: false
    schema:
      type: integer
      minimum: 0
  - name: language
    in: query
    required: false
    schema:
      type: string
      minLength: 1
  - name: imdb_id
    in: query
    required: false
    description: IMDb ID 定位，格式为 `tt` + 数字；存在时优先走 ID 定位路径。
    schema:
      type: string
      pattern: ^tt\d+$
  - name: tmdb_id
    in: query
    required: false
    description: TMDb ID 定位，与 `imdb_id` 同时存在时 `imdb_id` 优先。
    schema:
      type: integer
      minimum: 1
  - name: type
    in: query
    required: false
    schema:
      type: string
      enum: [movie, episode]
  - name: query
    in: query
    required: false
    description: 自由文本检索；与 `title` 共同构成 free-text 兜底；迅雷 provider 映射为上游 `name`。
    schema:
      type: string
      minLength: 1
```

### 6.2 operation 描述补充

```yaml
description: |
  外部调用方使用 active Caller Key 查询字幕；无 Provider、无活跃凭据、无结果与上游失败均使用统一错误结构。

  聚合搜索接口支持多个 provider（opensubtitles、xunlei）；不同 provider 的能力差异由 SubHub 内部处理，调用方无需关心。字段可传不等于所有 provider 都同等支持；provider 实际可消费字段由 provider adapter 决定。
```

---

## 7. 兼容性保证

| 兼容性维度             | 保证                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| 字段命名               | `season` / `episode` / `language` 保持现状命名，不升级                                          |
| 必填字段               | 不引入新必填字段                                                                                |
| 响应结构               | 老调用方消费路径（`id` / `language` / `releaseName` / `format` / `downloadUrl`） MUST 100% 不变 |
| `provider` 字段        | 当前值 `opensubtitles` MUST 保持有效；新增 `xunlei` 值                                          |
| OpenSubtitles 字段消费 | `v0.2.1` 字段消费行为 MUST 100% 等价                                                            |

---

## 8. 契约边界

- **本契约是 SubHub 自己的契约**，不为 provider 兼容性背书。
- **provider 内部 MUST 仅消费其支持的字段**；不支持字段 MUST 静默忽略（不传上游、不 warn、不计入错误）。
- **provider 缺少"必须"字段**（迅雷的 `query` 与 `languages`）时，gateway MUST 跳过该 provider 而非报错。
- **响应侧契约** 见 `subtitle-search-response.md`。

---

## 9. 参考资料

- `specs/004-multi-provider-search/spec.md`
- `specs/004-multi-provider-search/plan.md`
- `specs/004-multi-provider-search/data-model.md`
- `docs/api/openapi.yaml`
- `src/app/api/subtitles/search/route.ts`
- `specs/003-subtitle-search-fields/spec.md`（`v0.2.1` 规格）
