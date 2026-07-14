# 功能规格: 字幕搜索接口扩展检索字段

**功能分支**: `003-subtitle-search-fields`

**创建日期**: 2026-06-22

**状态**: Draft

**输入**: 用户描述: "字幕搜索接口扩展检索字段"

## 功能身份与可追溯性 _(mandatory)_

- **Feature ID**: `003`
- **Spec 目录**: `specs/003-subtitle-search-fields/`
- **主分支**: `003-subtitle-search-fields`
- **主 Issue**: TBD
- **Task Issue 策略**: spec review 通过后再进入 `/speckit.plan` 与 `/speckit.tasks`，task issues 延后到 tasks 阶段统一创建

## 设计上下文 _(mandatory)_

### 设计来源

- **全局设计系统**: `DESIGN.md`
- **页面规范**: 本功能为后端接口扩展，不直接触达 `docs/pages/*.md`；前端字幕检索页面不在本次范围
- **功能特定设计工件**: 无新增 mockup；契约变更以 `docs/api/openapi.yaml` 为真源

### 设计范围

- **受影响页面**: 无（纯 API 契约与网关层扩展）
- **新增页面**: None
- **对设计系统的影响**: 无；不触达视觉语言、设计令牌或组件规则

### 设计约束

- 本功能不引入新的前端页面或组件，不触发 `DESIGN.md` 更新。
- API 契约变更 MUST 以 `docs/api/openapi.yaml` 为真源，并同步 `src/lib/api/generated/`。
- 不得直接把 OpenSubtitles 上游 query params 原样裸透传成长期对外契约；SubHub MUST 定义自己的稳定搜索请求模型。
- 不得引入 breaking API 变更：老调用方不传新增字段时，旧行为 MUST 保持不变。

## 用户场景与测试 _(mandatory)_

### 用户故事 1 - 媒体库自动化按 IMDb ID 找字幕 (Priority: P1)

自建影视管理服务用户已完成媒体刮削，手里持有结构化 IMDb ID。他们希望字幕搜索接口接受 IMDb ID 作为定位字段，由后端优先走 ID 定位路径，避免依赖模糊标题匹配导致命中率下降或错配续集/同名作品。

**优先级原因**: 这是本次扩展的核心价值：把"已刮削元数据 → 自动找字幕"的命中率拉起来，直接对应 SubHub 目标用户的主调用路径。

**独立测试**: 通过传入 `imdb_id` 调用 `/api/subtitles/search`，验证后端优先走 ID 定位路径并返回与该 IMDb 作品匹配的字幕列表。

**验收场景**:

1. **Given** Provider 已就绪且凭据可用, **When** 调用方传入有效 `imdb_id` 而不传 `query`, **Then** 接口返回与该 IMDb 作品匹配的字幕列表，且不因缺少 `query` 报错
2. **Given** 调用方同时传入 `imdb_id` 与 `query`, **When** 后端处理请求, **Then** 后端优先以 `imdb_id` 定位，`query` 作为辅助/兜底字段
3. **Given** 调用方传入格式不合法的 `imdb_id`（例如非 `tt` 前缀或非数字）, **When** 请求进入网关, **Then** 返回 400 校验错误，不向上游发起请求

---

### 用户故事 2 - 剧集按 TMDb ID + 季集定位 (Priority: P1)

剧集管理用户持有 TMDb ID 与季集编号，希望用 `tmdb_id + season_number + episode_number` 精确定位单集字幕，而不是把"剧名 + SxxExx"拼成 free-text query 让上游做模糊匹配。

**优先级原因**: 剧集是媒体库字幕需求的高频场景，季集结构化定位能显著降低错配率，与 IMDb ID 定位同属首批必须暴露能力。

**独立测试**: 通过传入 `tmdb_id + season_number + episode_number` 调用搜索接口，验证返回针对该单集的字幕。

**验收场景**:

1. **Given** Provider 已就绪, **When** 调用方传入 `tmdb_id` + `season_number` + `episode_number`, **Then** 接口返回针对该单集的字幕列表
2. **Given** 调用方只传 `tmdb_id` 而缺 `season_number`/`episode_number`, **When** 请求进入网关, **Then** 后端按剧集整体定位（整季/整剧字幕），不报错
3. **Given** 调用方传入 `tmdb_id` 但同时传了 `type=movie`, **When** 请求进入网关, **Then** 返回 400 校验错误，说明 `tmdb_id` 与 `type=movie` + `season_number` 之间存在语义冲突

---

### 用户故事 3 - 老调用方保持原有 fallback 行为 (Priority: P1)

已有调用方使用 `title + year + season + episode + language` 调用搜索接口。本次扩展不得破坏这些调用方：不传新增字段时，接口行为与响应结构 MUST 与现状一致。

**优先级原因**: 兼容性是本次扩展的硬约束，任何 breaking 变更都必须被拒绝或显式获得确认。

**独立测试**: 用仅含 `title` 的请求调用接口，验证响应与扩展前一致；用 `title + year + season + episode + language` 调用，验证走原有 query fallback 路径。

**验收场景**:

1. **Given** 调用方仅传入 `title`（不传任何新增字段）, **When** 请求进入网关, **Then** 接口走原有 free-text query fallback 路径，响应结构与现状一致
2. **Given** 调用方传入 `title + year + season + episode + language` 但不传任何 ID 字段, **When** 请求进入网关, **Then** 接口走原有 query fallback 路径，不因新增字段存在而改变行为
3. **Given** OpenAPI 与 generated client 已同步更新, **When** 老版本 client 仍按旧 schema 调用, **Then** 请求成功且行为不变（新增字段全部可选）

---

### 用户故事 4 - 按文件名辅助搜索 (Priority: P2)

部分用户在媒体元数据缺失时，希望用本地文件名作为辅助检索线索。但文件名质量参差不齐（例如 `1.mp4`、`movie.mkv`），不应被当作主路径。

**优先级原因**: 文件名只是辅助字段，价值有限且语义不稳定，不应进入首批必须暴露集合，但应在第二批补上以满足长尾场景。

**独立测试**: 传入 `filename` 作为辅助字段，验证后端将其作为补充线索传给上游，但不覆盖结构化 ID 字段的定位优先级。

**验收场景**:

1. **Given** 调用方传入 `filename` 但无任何 ID 字段, **When** 请求进入网关, **Then** 后端将 `filename` 作为辅助线索传给上游，返回结果
2. **Given** 调用方同时传入 `imdb_id` 与 `filename`, **When** 请求进入网关, **Then** 后端优先以 `imdb_id` 定位，`filename` 不覆盖 ID 定位优先级
3. **Given** 调用方传入 `filename=1.mp4` 这类无信息量文件名, **When** 请求进入网关, **Then** 后端不报错，但文档与响应中应体现该字段价值有限，不应被当作主路径

### 边界场景

- 当 `imdb_id` 与 `tmdb_id` 同时存在时：后端需明确优先级（建议 imdb 优先或任一即可，plan 阶段确定），不应同时向上游发送冲突定位
- 当 `type=movie` 与 `season_number`/`episode_number` 同时出现时：返回 400 校验错误
- 当 `type=episode` 但缺 `season_number`/`episode_number` 且无 ID 字段时：返回 400 或走 query fallback（以前者为准，避免歧义）
- 当 `imdb_id` 格式不合法（非 `tt` + 数字）时：返回 400，不向上游发起请求
- 当 `filename` 为 `1.mp4` 这类无信息量文件名时：不报错，但文档标注价值有限
- 当所有结构化字段都缺失、仅传 `query` 时：走原有 fallback 路径

## 需求 _(mandatory)_

### 功能需求

- **FR-1**: SubHub MUST 定义自己的稳定搜索请求模型，作为对外长期契约；不得直接把 OpenSubtitles 上游 query params 原样裸透传成长期对外契约
- **FR-2**: 后端 MUST 支持按 `imdb_id` 与 `tmdb_id` 进行结构化定位；当调用方传入这些 ID 字段时，后端 MUST 优先走 ID 定位路径，而不是把所有字段坍缩成 free-text query
- **FR-3**: 后端 MUST 支持 `season_number` 与 `episode_number` 作为结构化字段，而不是把它们拼进 free-text query 字符串；当只传 `season_number` 而缺 `episode_number` 时按整季定位
- **FR-4**: 后端 SHOULD 支持 `type` 字段（`movie` / `episode`）；当 `type=movie` 与 `season_number`/`episode_number` 同时出现时 MUST 返回 400
- **FR-5**: 本次扩展 MUST NOT 引入 breaking API 变更；所有新增字段 MUST 可选；老调用方不传新增字段时行为与响应结构 MUST 与现状一致
- **FR-6**: 当请求模型变更时 MUST 同步更新 `docs/api/openapi.yaml`、`src/lib/api/generated/`、route Zod schema、gateway `SubtitleSearchInput`、adapter `OpenSubtitlesSearchInput` 与相关测试
- **FR-7**: 新增字段 MUST 在网关层校验：`imdb_id` 匹配 `tt` + 数字、`tmdb_id` 为正整数、`season_number`/`episode_number` 为非负整数、`type` 为 `movie` 或 `episode`、`year` 保持 1800-3000
- **FR-8**: `filename` 若进入 Tier 2，文档 MUST 标注其价值有限，不应被当作主路径；当 `filename` 与 ID 字段同时存在时 ID 字段优先

### 非功能需求 _(mandatory)_

- **NFR-001 (代码质量)**: Feature MUST 通过 `pnpm lint` 与 `pnpm typecheck` 门禁
- **NFR-002 (测试)**: Feature MUST 包含 contract tests（覆盖新字段）、unit tests（覆盖校验逻辑）、integration tests（覆盖 ID 定位路径与 query fallback 路径）
- **NFR-003 (UX 一致性)**: Feature MUST 保持统一错误结构；新增 400 校验错误 MUST 复用现有 `ErrorResponse` schema
- **NFR-004 (性能)**: 新增结构化 ID 定位路径的响应延迟 SHOULD 不高于现有 query fallback 路径
- **NFR-005 (设计保真)**: 本功能不触达 `DESIGN.md` 与页面规范
- **NFR-006 (并行隔离)**: Feature MUST 在 `003-subtitle-search-fields` 分支/worktree 内独立推进
- **NFR-007 (Issue 同步范围)**: Issue 同步 MUST 仅面向 `specs/003-subtitle-search-fields/`，且 MUST NOT 跨多个 spec 混批任务

### 关键实体 _(如功能涉及数据请填写)_

本功能不新增数据库实体。`SubtitleSearchInput`（网关层请求模型）与 `OpenSubtitlesSearchInput`（适配器层请求模型）为本次扩展的核心数据结构，但属于接口契约而非持久化实体。

## 候选字段评估 _(mandatory)_

### `query`

- **解决问题**：当调用方没有任何结构化 ID 时，提供 free-text 标题匹配能力
- **适用场景**：电影 / 剧集 / 本地文件均可作为兜底
- **是否首批暴露**：是（保持现有字段，不改名）
- **语义歧义/兼容性**：无；保持现状即可

### `imdb_id`

- **解决问题**：用 IMDb 唯一标识精确定位电影或剧集，避免同名/续集错配
- **适用场景**：电影（主路径）、剧集整体定位
- **是否首批暴露**：是（Tier 1）
- **语义歧义/兼容性**：需校验 `tt` + 数字格式；与 `tmdb_id` 同时存在时需明确优先级

### `tmdb_id`

- **解决问题**：用 TMDb 唯一标识定位作品，配合季集可定位单集
- **适用场景**：电影、剧集（特别是单集定位的主路径）
- **是否首批暴露**：是（Tier 1）
- **语义歧义/兼容性**：需校验正整数；与 `imdb_id` 同时存在时的优先级需明确；`type=movie` + `season_number` 冲突需校验

### `season_number`

- **解决问题**：结构化定位剧集季编号，避免拼进 free-text query
- **适用场景**：剧集
- **是否首批暴露**：是（Tier 1，从现有 `season` 升级命名以对齐上游语义）
- **语义歧义/兼容性**：现有字段名为 `season`，本次是否改名需在 plan 阶段评估 breaking 风险 [NEEDS CLARIFICATION: 是否允许将 `season`/`episode` 改名为 `season_number`/`episode_number` 以对齐上游语义，还是保持现有命名以避免任何 breaking 风险？]

### `episode_number`

- **解决问题**：结构化定位剧集集编号
- **适用场景**：剧集
- **是否首批暴露**：是（Tier 1，命名问题同 `season_number`）
- **语义歧义/兼容性**：同 `season_number`

### `languages`

- **解决问题**：按语言码过滤字幕
- **适用场景**：电影 / 剧集 / 本地文件
- **是否首批暴露**：是（保持现有 `language` 字段；是否改名为 `languages` 以对齐上游见 [NEEDS CLARIFICATION]）
- **语义歧义/兼容性**：现有字段名为 `language`（单数），上游为 `languages`（复数）；改名涉及 breaking，需确认

### `type`

- **解决问题**：明确媒体类型为电影或剧集，减少上游错配
- **适用场景**：电影 / 剧集
- **是否首批暴露**：是（Tier 1）
- **语义歧义/兼容性**：与 `season_number`/`episode_number` 存在冲突校验需求；`type=movie` + 季集字段 MUST 报 400

### `moviehash`

- **解决问题**：用文件哈希精确匹配字幕（OpenSubtitles 原生支持）
- **适用场景**：本地文件场景
- **是否首批暴露**：否（Tier 3）
- **语义歧义/兼容性**：哈希计算需要调用方在客户端预先计算，且 SubHub 当前不提供哈希计算能力；首批暴露价值有限且增加调用方负担

### `filename`

- **解决问题**：用本地文件名作为辅助检索线索
- **适用场景**：本地文件场景（辅助）
- **是否首批暴露**：否（Tier 2）
- **语义歧义/兼容性**：文件名质量参差不齐（`1.mp4`、`movie.mkv` 无信息量），只能作为辅助字段，不应被当作主路径；文档 MUST 标注其价值有限

### `year`

- **解决问题**：用年份辅助区分同名作品
- **适用场景**：电影 / 剧集
- **是否首批暴露**：是（保持现有字段）
- **语义歧义/兼容性**：无；保持现状

### `hearing_impaired`

- **解决问题**：过滤听障字幕
- **适用场景**：电影 / 剧集
- **是否首批暴露**：否（Tier 2）
- **语义歧义/兼容性**：布尔值语义清晰，但属于偏好过滤而非定位字段，优先级低于结构化 ID

### `foreign_parts_only`

- **解决问题**：过滤外邦部分字幕
- **适用场景**：电影 / 剧集
- **是否首批暴露**：否（Tier 3）
- **语义歧义/兼容性**：语义较窄且上游支持不稳定，待上游能力与需求明确后再评估

## 推荐字段分层 _(mandatory)_

### Tier 1: 首批必须暴露

| 字段             | 说明                                             |
| ---------------- | ------------------------------------------------ |
| `query`          | 保持现有 free-text 兜底字段                      |
| `imdb_id`        | 新增；电影/剧集 ID 定位主路径                    |
| `tmdb_id`        | 新增；剧集单集定位主路径                         |
| `season_number`  | 结构化季编号（命名见 [NEEDS CLARIFICATION]）     |
| `episode_number` | 结构化集编号（命名见 [NEEDS CLARIFICATION]）     |
| `languages`      | 保持现有语言过滤（命名见 [NEEDS CLARIFICATION]） |
| `type`           | 新增；`movie` / `episode` 类型过滤               |
| `year`           | 保持现有年份辅助字段                             |

**最小但正确的集合**：结构化 ID（`imdb_id` / `tmdb_id`）+ 季集（`season_number` / `episode_number`）+ 类型（`type`）+ 语言与年份（保持现有）+ `query` 兜底。这个集合覆盖了"已刮削元数据 → 自动找字幕"的主调用路径，且不引入 breaking 变更（除可能的字段改名需确认外）。

### Tier 2: 很快应补充

| 字段               | 说明                                             |
| ------------------ | ------------------------------------------------ |
| `filename`         | 辅助字段；文档 MUST 标注价值有限，不应当作主路径 |
| `hearing_impaired` | 偏好过滤字段；布尔值                             |

### Tier 3: 暂不暴露 / 谨慎暴露

| 字段                 | 不暴露原因                                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| `moviehash`          | 需调用方客户端预计算哈希，SubHub 当前不提供哈希计算能力；首批价值有限且增加调用方负担 |
| `foreign_parts_only` | 语义较窄且上游支持不稳定；待需求与上游能力明确后再评估                                |

## API 契约方向 _(mandatory)_

### 请求模型方向

SubHub 定义自己的稳定搜索请求模型，建议方向（非最终实现）：

```
SubtitleSearchRequest:
  query?: string          # free-text 兜底
  imdb_id?: string        # tt + 数字
  tmdb_id?: integer       # 正整数
  season_number?: integer # 非负整数
  episode_number?: integer # 非负整数
  languages?: string      # 语言码（保持现有语义）
  type?: enum [movie, episode]
  year?: integer          # 1800-3000
```

### 兼容原则

- 所有新增字段（`imdb_id` / `tmdb_id` / `type`）MUST 可选
- 老调用方不传新增字段时，行为 MUST 与现状一致
- `season` / `episode` / `language` 是否改名为 `season_number` / `episode_number` / `languages` 需在 plan 阶段评估 breaking 风险并获得确认（见 [NEEDS CLARIFICATION]）
- 若改名，MUST 提供兼容别名或明确 breaking 说明；否则保持现有命名
- 响应结构 `SubtitleSearchResponse` 不变

### 不做的事

- 不直接 1:1 暴露 OpenSubtitles 所有原始 query params
- 不把上游命名（如 `moviehash_match`、`foreign_parts_only`、`hearing_impaired_def`）原样裸透传成长期对外契约
- 不做新的数据库 schema 设计
- 不做前端复杂检索页面设计
- 不做与字幕下载无关的媒体管理功能

## 成功标准 _(mandatory)_

### 可度量结果

- **SC-001**: 持有结构化 ID 的调用方字幕命中率显著高于仅使用 `query` 的 fallback 路径（具体量化指标在 plan 阶段基于上游能力确定）
- **SC-002**: 新增结构化 ID 定位路径的响应延迟不高于现有 query fallback 路径
- **SC-003**: 老调用方零改动即可继续使用，行为与响应结构 100% 一致
- **SC-004**: 所有新增字段在 OpenAPI、generated client、contract tests、unit tests、integration tests 中 100% 同步覆盖

## 假设

- OpenSubtitles 上游支持 `imdb_id`、`tmdb_id`、`season_number`、`episode_number`、`type` 等参数（基于 OpenSubtitles REST API 公开文档）
- 调用方通常已通过媒体刮削工具（如 TinyMediaManager、Emby、Jellyfin）获得结构化元数据
- 本次扩展不涉及上游适配器的深度重构，仅在 `OpenSubtitlesSearchInput` 与 `search` 实现中增加参数透传
- `season` / `episode` / `language` 改名问题在 plan 阶段解决；本 spec 默认倾向保持现有命名以避免 breaking，但保留对齐上游命名的选项

## 依赖

- OpenSubtitles 上游 API 对结构化 ID 检索的支持能力
- 现有 `OpenSubtitlesAdapter.search` 的参数透传能力
- 现有 `SubtitleSearchRequestRecord` 审计日志结构（可选扩展，不在本次强制范围）

## 页面规范更新

- **需更新的既有页面规范**: None
- **需新建的页面规范**: None
- **是否需要更新 `DESIGN.md`**: No（本功能为纯后端接口扩展，不触达视觉设计系统）

## 实现建议（Implementation Recommendation）

### 建议首批落地字段集合

- `query`（保持现有）
- `imdb_id`（新增）
- `tmdb_id`（新增）
- `season_number` / `episode_number`（新增或从 `season` / `episode` 升级命名，待确认）
- `languages`（保持现有 `language`，是否改名待确认）
- `type`（新增）
- `year`（保持现有）

### 建议保留为后续扩展的字段集合

- Tier 2: `filename`（辅助）、`hearing_impaired`（偏好过滤）
- Tier 3: `moviehash`、`foreign_parts_only`

### 本次实现风险点

1. **字段改名 breaking 风险**：`season` / `episode` / `language` 是否改名为 `season_number` / `episode_number` / `languages` 需在 plan 阶段评估并获得确认
2. **ID 优先级歧义**：`imdb_id` 与 `tmdb_id` 同时存在时的优先级需明确
3. **上游能力假设**：需在 plan 阶段验证 OpenSubtitles 上游对结构化 ID 检索的实际支持情况
4. **审计日志扩展**：`SubtitleSearchRequestRecord` 是否需要新增字段记录定位路径，可能涉及 schema 变更（但本次 spec 明确不做新数据库 schema 设计）
5. **测试分层**：contract tests 需覆盖新字段；unit tests 需覆盖校验逻辑；integration tests 需覆盖 ID 定位路径与 query fallback 路径

### 需要同步更新的层

| 层        | 文件/模块                                                                        | 变更内容                                                            |
| --------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Route     | `src/app/api/subtitles/search/route.ts`                                          | Zod schema 扩展新字段                                               |
| Gateway   | `src/server/subtitles/subtitle-gateway.ts`                                       | `SubtitleSearchInput` 扩展、`buildSearchQuery` 重构为按定位路径分流 |
| Adapter   | `src/server/providers/opensubtitles-adapter.ts`                                  | `OpenSubtitlesSearchInput` 扩展、`search` 实现透传新参数            |
| OpenAPI   | `docs/api/openapi.yaml`                                                          | `/api/subtitles/search` 请求参数扩展                                |
| Generated | `src/lib/api/generated/`                                                         | Orval 重新生成 client/types                                         |
| Tests     | `tests/contract/subtitles.contract.test.ts`、`tests/unit/`、`tests/integration/` | 覆盖新字段、校验、ID 定位路径与 fallback 路径                       |
