# 功能规格: 多字幕 provider 搜索入口模型基础版（含迅雷字幕 provider 接入）

**功能分支**: `004-multi-provider-search`

**创建日期**: 2026-06-27

**状态**: Draft

**输入**: 用户描述: "为 SubHub 启动 `v0.2.2` 的 spec，主题是：多字幕 provider 搜索入口模型基础版（含迅雷字幕 provider 接入）。SubHub 在 v0.2.1 阶段已开始推进字幕搜索字段扩展，目标是增强媒体库自动化场景下的字幕搜索能力。现在需要进一步进入 v0.2.2，建立适合多 provider 的聚合搜索入口模型，并完成第二个字幕 provider 的基础接入，优先以迅雷字幕 provider 作为首个新增 provider 的落地样本。"

## 功能身份与可追溯性 *(mandatory)*

- **Feature ID**: `004`
- **Spec 目录**: `specs/004-multi-provider-search/`
- **主分支**: `004-multi-provider-search`
- **主 Issue**: TBD（spec review 通过后再创建）
- **Task Issue 策略**: spec review 通过后再进入 `/speckit.plan` 与 `/speckit.tasks`，task issues 延后到 tasks 阶段统一创建（与 `specs/003-subtitle-search-fields/` 同策略，避免在 spec 阶段过早拆分 issue）
- **对应 milestone**: `v0.2.2`（参考 `docs/releases/versioning.md`）
- **scope 标签倾向**: `scope:mvp`（`v0.2.2` 在 versioning.md 中已明确为该 milestone 的核心交付范围）

## 设计上下文 *(mandatory)*

### 设计来源

- **全局设计系统**: `DESIGN.md`（本功能不触达）
- **页面规范**: 本功能为后端 API 与 provider 适配层扩展，不直接触达 `docs/pages/*.md`；前端字幕检索页面不在本次范围
- **功能特定设计工件**: 无新增 mockup；契约变更以 `docs/api/openapi.yaml` 为真源；provider 适配设计以 `src/server/providers/` 现有分层为入口

### 设计范围

- **受影响页面**: 无（纯后端接口扩展与 provider 适配层扩展）
- **新增页面**: None
- **对设计系统的影响**: 无；不触达视觉语言、设计令牌或组件规则

### 设计约束

- 本功能不引入新的前端页面或组件，不触发 `DESIGN.md` 更新。
- API 契约变更 MUST 以 `docs/api/openapi.yaml` 为真源，并同步 `src/lib/api/generated/`。
- SubHub MUST 定义自己的稳定聚合搜索请求模型，不直接把 OpenSubtitles 或迅雷字幕的上游 query params 1:1 裸暴露为长期对外契约。
- provider 适配层 MUST 按自身能力选择性消费请求字段；"字段可传"不等于"provider 一定消费"。
- 本功能 MUST NOT 引入 breaking API 变更：老调用方不传新增字段时行为 MUST 与 `v0.2.1` 现状一致。
- 现有 `src/server/subtitles/subtitle-gateway.ts`、`src/server/providers/opensubtitles-adapter.ts`、`src/app/api/subtitles/search/route.ts` MUST 兼容本次重构；`v0.2.1` 已落地的字段模型与路由契约保持向后兼容。
- 仓库级全局约定细节（包管理器、数据库测试分层、运行时环境映射、版本约定、API 契约链路）以 `.github/copilot-instructions.md` 为真源，本 spec 不重复展开。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 媒体库按 IMDb ID 走 OpenSubtitles 结构化检索 (Priority: P1)

自建影视管理服务用户已完成媒体刮削，手里持有结构化 IMDb ID。他们希望 SubHub 在聚合搜索接口下，优先把 IMDb ID 路由到支持结构化检索的 provider（OpenSubtitles）走 ID 定位路径，避免依赖模糊标题匹配导致命中率下降或错配续集/同名作品。

**优先级原因**: 这是 `v0.2.1` 已收口能力的延续。`v0.2.2` 不削弱这条主路径，且需保证多 provider 抽象不破坏既有 ID 定位能力。

**独立测试**: 传入 `imdb_id` 与 `languages` 调用聚合搜索接口，验证至少 OpenSubtitles provider 走 ID 定位路径，并返回与该 IMDb 作品匹配的字幕列表。

**验收场景**:

1. **Given** OpenSubtitles provider 已配置且凭据可用, **When** 调用方仅传 `imdb_id` 与 `languages`, **Then** 聚合接口至少能通过 OpenSubtitles 走 ID 定位路径并返回该作品的字幕
2. **Given** 调用方同时传 `imdb_id` 与 `query`, **When** 后端处理请求, **Then** OpenSubtitles provider 优先以 `imdb_id` 定位，`query` 作为辅助/兜底字段
3. **Given** 调用方传入格式不合法的 `imdb_id`, **When** 请求进入网关, **Then** 返回 400 校验错误，不向上游发起请求

---

### 用户故事 2 - 用中文 / 自由文本标题走迅雷 provider 名称检索 (Priority: P1)

部分中文媒体用户希望用剧名直接搜索字幕（例如 `权力的游戏`），而 OpenSubtitles 对中文名称检索的命中率有限。用户希望 SubHub 聚合搜索能在不削弱 OpenSubtitles 结构化能力的前提下，把中文 / free-text 检索交给支持名称检索的迅雷 provider 走 `name + languages` 路径。

**优先级原因**: 迅雷 provider 是 `v0.2.2` 的首个新增 provider，是验证"多 provider 能力差异 + 错误隔离 + 结果归一化"模型的落地样本。中文场景是真实用户高频痛点，且迅雷接口 `name + languages` 路径已具备可用形态。

**独立测试**: 传入 `query`（中文剧名）与 `languages` 调用聚合搜索接口，验证迅雷 provider 至少能基于 `query -> name` 与 `languages` 返回结果，并标注 provider 来源。

**验收场景**:

1. **Given** 迅雷 provider 已配置, **When** 调用方传 `query=权力的游戏` 与 `languages=简体`, **Then** 聚合接口至少能通过迅雷 provider 返回结果，且每个结果都标注 provider 来源为 `xunlei`
2. **Given** 调用方仅传 `query` 与 `languages`, **When** 后端处理请求, **Then** 迅雷 provider 把 `query` 映射为上游 `name`，并至少消费 `languages`
3. **Given** 调用方传 `imdb_id` + `query`, **When** 后端处理请求, **Then** 迅雷 provider 不消费 `imdb_id`，仅消费 `query` 与 `languages`，不因此报错

---

### 用户故事 3 - 多 provider 结果来源可区分 (Priority: P1)

聚合搜索接口的返回结果中，下游媒体客户端必须能区分每个结果来自哪个 provider，从而在客户端按来源做排序、过滤、二次选择（例如优先 OpenSubtitles，迅雷结果作为补充）。

**优先级原因**: 多 provider 聚合的首要价值就是"扩大结果池 + 保留来源透明"。如果不标注 provider 来源，多 provider 接入会退化为"不可解释的合并"，不可接受。

**独立测试**: 同时启用 OpenSubtitles 与迅雷 provider，传入同一请求，验证返回结果的 `provider` 字段能正确标注来源。

**验收场景**:

1. **Given** OpenSubtitles 与迅雷 provider 均已配置, **When** 调用聚合搜索接口, **Then** 每个返回结果 MUST 包含 `provider` 字段，可选值为 `opensubtitles` / `xunlei`
2. **Given** 迅雷 provider 返回原始 `cid` / `gcid` 等内部字段, **When** 后端归一化结果, **Then** 这些原始字段保留在 `raw` 或对应归一化字段中，不被强制丢到主结果对象上
3. **Given** 调用方未指定 provider 偏好, **When** 后端处理请求, **Then** 至少 OpenSubtitles 与迅雷同时被调用，聚合后返回带来源的结果集

---

### 用户故事 4 - 单 provider 失败不拖垮整体搜索 (Priority: P1)

聚合搜索过程中，单个 provider 出现网络故障、上游 5xx、超时或凭据失效时，不应导致整个搜索接口返回错误。其他 provider 的结果应继续返回给调用方，失败信息以最小化形式暴露（例如 `degraded` 标记）。

**优先级原因**: 多 provider 聚合的鲁棒性是基本要求。一个 provider 不可用不能把整个功能拉垮，否则用户体验不如单 provider。

**独立测试**: 模拟迅雷 provider 上游返回 5xx 或超时，验证聚合接口仍能返回 OpenSubtitles 的结果，且响应结构体现降级状态。

**验收场景**:

1. **Given** OpenSubtitles 与迅雷 provider 均启用, **When** 迅雷 provider 上游返回 5xx 或超时, **Then** 聚合接口仍返回 OpenSubtitles 的结果，且响应中包含 provider 级别的失败信息
2. **Given** 迅雷 provider 凭据缺失或被禁用, **When** 调用聚合搜索接口, **Then** 聚合接口跳过该 provider 而不报错，正常返回其他 provider 结果
3. **Given** 所有 provider 均失败, **When** 调用聚合搜索接口, **Then** 接口返回明确错误（例如 502 / 504），且不静默返回空结果

---

### 用户故事 5 - 老调用方零改动继续工作 (Priority: P1)

已有 `v0.2.1` 时期的调用方使用 `title + year + season + episode + language`（或带 `imdb_id` / `tmdb_id`）调用搜索接口。本次多 provider 抽象 MUST 不破坏这些调用方的请求 / 响应行为。

**优先级原因**: 兼容性是 `v0.2.x` 阶段硬约束，与 `v0.2.1` spec 一致。任何 breaking 变更 MUST 被拒绝或显式获得确认。

**独立测试**: 用 `v0.2.1` 风格的请求调用聚合搜索接口，验证响应结构与 `v0.2.1` 一致；OpenSubtitles provider 仍按原逻辑消费字段。

**验收场景**:

1. **Given** 调用方仅传 `title` 与 `language`, **When** 请求进入网关, **Then** 至少 OpenSubtitles provider 走原有 fallback 路径，响应结构与 `v0.2.1` 一致
2. **Given** 调用方传 `imdb_id` + `tmdb_id` + 季集字段, **When** 请求进入网关, **Then** OpenSubtitles provider 的字段消费行为与 `v0.2.1` 一致（`imdb_id` 优先）
3. **Given** OpenAPI 与 generated client 已同步更新, **When** 老版本 client 仍按 `v0.2.1` schema 调用, **Then** 请求成功且行为不变（`v0.2.2` 不引入新必填字段）

---

### 边界场景

- **provider 全失败**：所有 provider 均失败时聚合接口返回明确错误，不静默返回空数组。
- **迅雷 provider 凭据缺失**：跳过该 provider 而不报错；OpenSubtitles 结果照常返回。
- **迅雷 provider `name` 为空**：当调用方未传 `query` 时，迅雷 provider 因缺少必要字段而跳过，不应抛 500。
- **迅雷 provider `languages` 缺失**：迅雷接口当前至少需要 `languages`；若调用方未传，迅雷 provider 应跳过，不影响 OpenSubtitles 结果。
- **OpenSubtitles 凭据池降级**：现有 `v0.2.1` 已收口的凭据池行为（`markCredentialFailure` / `markCredentialUsed`）在多 provider 抽象下 MUST 保持独立，不被迅雷 provider 行为污染。
- **`type=movie` 与季集字段冲突**：复用 `v0.2.1` 的 400 校验，不因多 provider 抽象而放松。
- **provider 来源字段冲突**：归一化结果中 `provider` 字段 MUST 由 SubHub 显式注入，不允许直接复用 provider 原始数据中的同名字段。
- **迅雷返回的 `score` / `fingerprintf_score` / `mt` / `source` 等**：作为原始字段保留在归一化结果中，不做主观合并或重排序（避免引入排序编排假设）。
- **新老 provider 并存**：本次不引入 third provider；架构上保持可扩展，但不预先为未知 provider 设计 schema。

## 需求 *(mandatory)*

### 功能需求

- **FR-1**: SubHub MUST 定义一个稳定的聚合搜索请求模型（`SubtitleSearchInput`），作为对外长期契约；该模型 MUST 保留 `v0.2.1` 已有字段并按需扩展，不直接把 OpenSubtitles 或迅雷的上游 query params 1:1 暴露。
- **FR-2**: 聚合请求模型 MUST 支持 richer request fields，至少包含：`query`、`languages`、`type`、`imdb_id`、`tmdb_id`、`season_number`、`episode_number`、`year`、`filename`、`moviehash`、`hearing_impaired`、`foreign_parts_only`；其中前 8 个为 `v0.2.2` 评估范围内的可选字段，`filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only` 的首批暴露与否见 FR-12。
- **FR-3**: provider 适配层 MUST 按自身能力选择性消费请求字段；"字段可传"不等于"provider 一定消费"；不支持的字段 MUST 被静默忽略，不应导致 provider 调用失败。
- **FR-4**: 聚合请求模型 MUST 明确字段优先级：`imdb_id` / `tmdb_id` 优先于 `query`；`season_number` / `episode_number` 与 `type` 协同；`filename` / `moviehash` 仅作辅助。
- **FR-5**: OpenSubtitles provider MUST 继续支持结构化字段（`imdb_id` / `tmdb_id` / `season_number` / `episode_number` / `type` / `languages` / `year` / `query`），且行为与 `v0.2.1` 一致；不因本次重构削弱。
- **FR-6**: 迅雷字幕 provider MUST 至少消费 `query`（映射为上游 `name`）与 `languages`；不支持的字段（`imdb_id` / `tmdb_id` / `season_number` / `episode_number` / `type` / `year` / `filename` / `moviehash` 等）被忽略而非报错。
- **FR-7**: 迅雷字幕 provider MUST 在缺少必要字段（至少 `query` 与 `languages` 之一，且 `query` 在当前可用入口下 MUST 存在）时跳过调用，而非抛出未处理错误。
- **FR-8**: 聚合搜索结果 MUST 携带 `provider` 字段，可选值为 `opensubtitles` / `xunlei`；provider 原始字段（如迅雷的 `cid` / `gcid` / `url` / `ext` / `name` / `duration` / `languages` / `source` / `score` / `fingerprintf_score` / `extra_name` / `mt`）保留在归一化结果的 `raw` 或对应归一化字段中，不被强制丢到主结果对象上。
- **FR-9**: 单 provider 失败 MUST 不拖垮整体搜索；其他 provider 结果继续返回；provider 级失败信息以最小化形式暴露（详见 §8 Error Isolation & Fallback）。
- **FR-10**: 本次 MUST NOT 引入 breaking API 变更；`v0.2.2` 新增能力（多 provider、provider 来源字段）通过响应结构增量扩展而非破坏性重设计。
- **FR-11**: 当请求 / 响应模型变更时 MUST 同步更新 `docs/api/openapi.yaml`、`src/lib/api/generated/`、route Zod schema、gateway / adapter 输入模型与相关测试。
- **FR-12**: 首批 provider 内可消费字段映射如下（详细分层见 §5 / §6）：
  - OpenSubtitles 首批可消费：`query` / `imdb_id` / `tmdb_id` / `season_number` / `episode_number` / `languages` / `type` / `year`
  - 迅雷 provider 首批可消费：`query`（映射 `name`）/ `languages`
  - 首批不在聚合模型中暴露（待评估）：`filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only`，理由见 §5；如需首批纳入，必须在 plan 阶段获得显式确认。
- **FR-13**: 迅雷字幕 provider 的配置管理 MUST 复用现有 `Provider` / `ProviderCredential` 数据模型与凭据池（`credential-pool.ts`）抽象；不引入新的 provider 注册表或 schema。
- **FR-14**: provider 适配层 MUST 通过统一接口暴露 `search` 能力，使聚合 gateway 能以 provider key（`opensubtitles` / `xunlei`）调度；gateway MUST 负责 provider 选择、错误隔离与结果聚合，adapter MUST 仅负责与上游交互。

### 非功能需求 *(mandatory)*

- **NFR-001 (代码质量)**: Feature MUST 通过 `pnpm lint` 与 `pnpm typecheck` 门禁；改动完成后 MUST 先执行 `pnpm format:write`。
- **NFR-002 (测试)**: Feature MUST 包含 unit tests（字段映射、错误隔离、归一化逻辑）+ contract tests（聚合 API 行为、provider 来源字段）+ integration tests（多 provider 并存路径与单 provider 失败隔离）。测试分层遵循 `.github/copilot-instructions.md` 的 PGlite / Postgres 约定。
- **NFR-003 (UX 一致性)**: Feature MUST 保持统一错误结构；新增 4xx / 5xx 错误 MUST 复用现有 `ErrorResponse` schema；provider 失败信息以结构化形式暴露在响应中（不直接堆栈泄漏）。
- **NFR-004 (性能)**: 单 provider 搜索 p95 延迟 MUST 不高于 `v0.2.1` 同路径；多 provider 并存路径的端到端 p95 SHOULD 不高于单 provider 最慢者 + 1s（首批实现允许采用串行调用，后续迭代再优化并行）。
- **NFR-005 (设计保真)**: 本功能不触达 `DESIGN.md` 与页面规范。
- **NFR-006 (并行隔离)**: Feature MUST 在 `004-multi-provider-search` 分支 / worktree 内独立推进；不与其他 active feature 混批。
- **NFR-007 (Issue 同步范围)**: Issue 同步 MUST 仅面向 `specs/004-multi-provider-search/`，且 MUST NOT 跨多个 spec 混批任务。
- **NFR-008 (可维护性)**: provider 适配 MUST 隔离在稳定接口之后（宪章原则 VI），防止来源特定行为泄漏到核心 API；`subtitle-gateway.ts` 不直接感知任何 provider 的上游字段命名。

### 关键实体 *(如功能涉及数据请填写)*

本功能不新增数据库 schema。

核心数据结构（接口契约，非持久化实体）：

- `SubtitleSearchInput`（聚合请求模型）：SubHub 对外契约，MUST 不与任何 provider 上游字段命名耦合。
- `ProviderSearchInput`（provider 内适配输入）：由 gateway 从 `SubtitleSearchInput` 派生，MUST 仅包含该 provider 实际消费的字段。
- `ProviderSearchResult`（provider 内原始结果）：adapter 返回的 provider 特定结果形态。
- `AggregatedSubtitleResult`（聚合结果模型）：归一化后的对外结果，`provider` 字段 MUST 显式注入；原始 provider 字段保留在 `raw` 或对应归一化字段中。
- `ProviderFailureInfo`（provider 失败信息）：在响应中暴露结构化失败上下文，不泄漏堆栈。

## Provider 能力差异分析 *(mandatory)*

### OpenSubtitles

- **检索路径**：结构化检索为主。
- **可消费字段**：`query` / `imdb_id` / `tmdb_id` / `season_number` / `episode_number` / `languages` / `type` / `year`。
- **已有验证**：`v0.2.1` 已在 gateway / adapter 中落地，按 ID 优先策略工作。
- **首版约束**：`query` 至少 3 字符（过短上游 400），`imdb_id` 格式 `tt\d+`，`tmdb_id` 正整数；`type=movie` 与季集字段冲突报 400。

### 迅雷字幕 provider

- **入口基线**：`https://api-shoulei-ssl.xunlei.com/oracle/subtitle`。
- **已知可用请求形式**：`?name=<剧名>&languages=<语言码>`，至少能命中中文 / free-text 检索场景。
- **检索路径**：名称检索型。
- **首版可消费字段**：`query`（映射为上游 `name`）、`languages`。
- **首版明确不消费 / 待验证**：`imdb_id` / `tmdb_id` / `season_number` / `episode_number` / `type` / `year` / `filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only`。这些字段即使可传，也不代表迅雷 provider 会消费或稳定支持。
- **必要输入**：当前入口下 `query` MUST 存在，否则 provider MUST 跳过；`languages` 视接口契约建议保留（MUST 缺失时跳过，避免调用一次必然失败的请求）。
- **原始响应字段（已知）**：`cid` / `gcid` / `url` / `ext` / `name` / `duration` / `languages` / `source` / `score` / `fingerprintf_score` / `extra_name` / `mt` 等。本批仅纳入归一化映射（见 §7），不做评分编排。
- **凭据模型**：复用现有 `Provider` / `ProviderCredential` / `credential-pool.ts`；迅雷 provider 当前可能无需凭据（视接口实测），凭据缺失 MUST 不影响 gateway 跳过行为。

### "字段可传 != provider 一定消费" 的契约边界

- 聚合请求模型是 SubHub 自己的契约，不为 provider 兼容性背书。
- provider 内部 MUST 仅消费其支持的字段；不支持字段 MUST 静默忽略，不影响 provider 调用。
- 当 provider 缺少"必须"字段（例如迅雷缺少 `query` 或 `languages`）时，gateway MUST 跳过该 provider 而非报错。
- 文档与响应结构 MUST 显式呈现 provider 的可消费字段集合（避免用户对"传了就该生效"产生误解）。

## 提议的聚合请求模型方向 *(mandatory)*

### 字段清单与首批纳入建议

| 字段 | 类型 | 必填 | 首批暴露 | 说明 |
|------|------|------|----------|------|
| `query` | string | 否 | ✅ | free-text 标题 / 名称；映射到 OpenSubtitles `query`、迅雷 `name` |
| `languages` | string | 否 | ✅ | 语言码；映射到 OpenSubtitles `languages`、迅雷 `languages` |
| `type` | enum `movie` / `episode` | 否 | ✅ | 与 `season_number` / `episode_number` 冲突时返回 400 |
| `imdb_id` | string `tt\d+` | 否 | ✅ | OpenSubtitles 主路径；迅雷忽略 |
| `tmdb_id` | integer > 0 | 否 | ✅ | OpenSubtitles 主路径；迅雷忽略 |
| `season_number` | integer ≥ 0 | 否 | ✅ | 命名沿用 `v0.2.2` 评估中的"语义对齐名"；与现有 `season` 字段命名兼容性在 plan 阶段评估 [NEEDS CLARIFICATION: 是否在 v0.2.2 将 `season` / `episode` / `language` 升级为 `season_number` / `episode_number` / `languages`，还是保持现状不变？倾向于保持现状以避免 patch 阶段 breaking] |
| `episode_number` | integer ≥ 0 | 否 | ✅ | 同上命名议题 |
| `year` | integer 1800-3000 | 否 | ✅ | 辅助字段；保持现有 `year` 不变 |
| `filename` | string | 否 | ⛔（首批不暴露） | 辅助字段，价值有限；不进入 v0.2.2 聚合模型 |
| `moviehash` | string | 否 | ⛔（首批不暴露） | 需调用方客户端预计算哈希，SubHub 不提供哈希计算能力 |
| `hearing_impaired` | boolean | 否 | ⛔（首批不暴露） | 偏好过滤字段；OpenSubtitles 支持但非定位字段；首批不纳入聚合模型 |
| `foreign_parts_only` | boolean | 否 | ⛔（首批不暴露） | 语义较窄且上游支持不稳定；首批不纳入 |

> **命名沿用说明**：`v0.2.1` 阶段已确认保持 `season` / `episode` / `language` 现有命名不变以避免 breaking。`v0.2.2` 在此基础上继续保持现状命名，把"是否升级到 `season_number` / `episode_number` / `languages`"作为 post-mvp 议题；若 plan 阶段决定升级，必须显式声明 breaking 并配套兼容层。

### 字段优先级（gateway 内派生 provider 输入时）

1. **ID 优先**：`imdb_id` / `tmdb_id` 优先于 `query`。
2. **季集与类型协同**：`season_number` / `episode_number` 仅在 `type=episode` 或已有 ID 定位下作为精修字段；`type=movie` + `season_number` / `episode_number` MUST 400。
3. **query 兜底**：仅在无 ID 字段时走 `query`（拼 `title` + `year` + `SxxExx`）。
4. **辅助字段**：`filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only` 首批不纳入聚合请求模型。

### provider 派生输入方向

gateway MUST 为每个 provider 派生独立的 provider input；该 input 仅包含该 provider 实际可消费的字段：

- **OpenSubtitles provider input**：来自 `SubtitleSearchInput`，完整沿用 `v0.2.1` 的 `OpenSubtitlesSearchInput` 字段集合（`query` / `imdb_id` / `tmdb_id` / `season_number` / `episode_number` / `language` / `type`）。
- **迅雷 provider input**：仅包含 `query`（映射为 `name`）与 `languages`；其他字段被忽略，不传入上游。

## Provider 映射方向 *(mandatory)*

### OpenSubtitles provider

- 沿用 `v0.2.1` 已落地的字段映射（`query` → 上游 `query` / `imdb_id` → `imdb_id` / `tmdb_id` → `tmdb_id` / `season` → `season_number` / `episode` → `episode_number` / `language` → `languages` / `type` → `type`）。
- 凭据池行为（`markCredentialFailure` / `markCredentialUsed` / `selectProviderCredential`）保持独立，不被迅雷 provider 行为污染。
- 短 query（< 3 字符）沿用 `v0.2.1` 的"不透传"行为，避免上游 400 触发凭据池误降级。

### 迅雷 provider

- 入口：`https://api-shoulei-ssl.xunlei.com/oracle/subtitle`。
- 字段映射：
  - `query` → 上游 `name`（trim 后非空才传）。
  - `languages` → 上游 `languages`（trim 后非空才传）。
  - 其他字段（`imdb_id` / `tmdb_id` / `season_number` / `episode_number` / `type` / `year` / `filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only`） MUST 忽略，不传入上游。
- 必要条件：当 `query` 缺失或经 trim 后为空时，provider MUST 跳过调用；当 `languages` 缺失时，provider MUST 跳过调用（避免必然失败的请求占用额度与延迟）。
- 响应解析：adapter MUST 把迅雷响应解析为 provider 内 `ProviderSearchResult` 形态，再交给 gateway 归一化。
- 凭据处理：复用 `Provider` / `ProviderCredential` / `credential-pool.ts`；当前接口可能无需凭据；凭据缺失 MUST 不影响 gateway 跳过行为（provider 自行决定是否需要凭据；网关层只看 provider 是否启用与必要字段是否齐全）。

### 字段忽略的契约边界

- "忽略"必须是真正的静默忽略：不传上游、不打印 warn、不计入错误、不破坏 provider 调用。
- 唯一例外：当"必要条件字段"（迅雷的 `query` 与 `languages`）缺失时，provider 跳过调用，并被记录为"未参与本次搜索"，不是错误。

## 结果归一化方向 *(mandatory)*

### 统一结果模型（方向，非最终）

```ts
AggregatedSubtitleResult {
  id: string;                  // provider 内结果 ID（SubHub 归一化生成，必要时拼接 provider key）
  provider: 'opensubtitles' | 'xunlei';  // MUST 显式注入
  language: string | null;
  releaseName: string | null;
  format: string;
  downloadUrl: string;         // 迅雷需解析 `url`；OpenSubtitles 走 download 流程
  raw?: Record<string, unknown>; // 迅雷原始字段保留
  score?: number | null;       // 迅雷 `score` 透传；OpenSubtitles 暂无
}
```

### provider 来源标识

- `provider` 字段 MUST 由 SubHub 显式注入，不复用 provider 原始数据中的同名字段。
- 老调用方若按 `v0.2.1` 行为消费结果（只看 `id` / `language` / `releaseName` / `format` / `downloadUrl`），结果结构 MUST 保持向后兼容。

### provider 原始评分 / 信息的处理

- 迅雷 `score` / `fingerprintf_score` 透传到 `raw` 或顶层 `score`（顶层优先级）；不进行跨 provider 评分编排。
- 迅雷 `cid` / `gcid` / `url` / `ext` / `name` / `duration` / `languages` / `source` / `extra_name` / `mt` 保留在 `raw` 中；`url` 同时映射到 `downloadUrl`（前提是接口返回的 `url` 可直接用于下载；细节由 plan 阶段与 `downloadUrl` 实际语义对齐）。
- OpenSubtitles 原始字段（`download_count` 等）保留在 `raw` 中。

### 归一化边界

- 本 spec 不要求一次性敲定所有结果字段；plan 阶段 MUST 给出 `AggregatedSubtitleResult` 的最终类型定义。
- 本 spec 明确"需要归一化"的最小边界：每个结果 MUST 标注 `provider`；原始 provider 字段 MUST 保留可追溯；老调用方消费路径 MUST 保持向后兼容。

## 错误隔离与降级 *(mandatory)*

### 最小可行策略（首批）

- provider 选择：gateway 按"已启用 + 必要字段齐全"过滤出本次实际调用的 provider 集合。
- 调用方式：首批采用 **串行调用** provider；理由是首版优先追求实现简单、错误隔离清晰；性能优化（并行、超时预算）放入后续 post-mvp 议题。
- 错误隔离：
  - 单 provider 失败（网络、上游 5xx、超时、解析失败） MUST 被捕获并记录为 `ProviderFailureInfo`。
  - 其他 provider 的结果继续返回。
  - 所有 provider 失败 MUST 返回明确错误（502 / 504），不静默返回空数组。
- 失败信息暴露：在响应结构中以最小化形式暴露 provider 级失败（不泄漏堆栈），具体字段在 plan 阶段敲定。
- 凭据池隔离：现有 `credential-pool.ts` 行为保持独立；迅雷 provider 暂不参与凭据池（如需后续接入凭据池，需独立 spec）。

### 明确不做的事

- 不做复杂熔断、评分、排序编排系统。
- 不做大规模 provider 架构重写。
- 不做并行 / 超时预算 / 自适应降级；这些放入 post-mvp 议题。

## 验收标准 *(mandatory)*

后续实现可验证的最小验收集：

- **AC-1**：聚合接口 MUST 接收 `v0.2.2` 提议的聚合请求模型（含 `query` / `languages` / `type` / `imdb_id` / `tmdb_id` / `season_number` / `episode_number` / `year`），全部可选；老调用方零改动。
- **AC-2**：OpenSubtitles provider 在收到含 `imdb_id` / `tmdb_id` / 季集 / `type` / `year` / `query` 的请求时，行为 MUST 与 `v0.2.1` 一致；ID 优先策略 MUST 保持。
- **AC-3**：迅雷 provider 在收到 `query` + `languages` 的请求时 MUST 能返回结果；在收到 `imdb_id` 等不支持字段时 MUST 静默忽略而不报错。
- **AC-4**：单 provider 失败 MUST 不影响其他 provider 的结果；响应 MUST 携带结构化的 provider 级失败信息。
- **AC-5**：所有返回结果 MUST 包含 `provider` 字段，取值 `opensubtitles` / `xunlei`。
- **AC-6**：迅雷 provider 在缺少 `query` 或 `languages` 时 MUST 跳过，不抛错。
- **AC-7**：OpenAPI（`docs/api/openapi.yaml`）/ generated client（`src/lib/api/generated/`）/ route Zod schema / gateway & adapter 输入 / contract tests / unit tests MUST 100% 同步覆盖。
- **AC-8**：老调用方不传 `provider` 偏好时，聚合接口 MUST 同时调用所有已启用 provider（首批为 OpenSubtitles + 迅雷），并返回带来源的结果集。
- **AC-9**：provider 来源字段 MUST 由 SubHub 显式注入；provider 原始字段保留在 `raw` 或对应归一化字段中。
- **AC-10**：所有 provider 全部失败时 MUST 返回明确错误（不静默返回空数组）。

## 成功标准 *(mandatory)*

### 可度量结果

- **SC-001**：持有结构化 ID 的调用方字幕命中率与 `v0.2.1` 一致或更高；多 provider 接入不削弱 OpenSubtitles 主路径表现。
- **SC-002**：单 provider 搜索 p95 延迟 MUST 不高于 `v0.2.1` 同路径；多 provider 串行调用的端到端 p95 SHOULD 不高于 `单 provider 最慢者 + 1s`（首批允许）。
- **SC-003**：老调用方（`v0.2.1` 风格请求） MUST 零改动继续工作；响应结构 100% 向后兼容。
- **SC-004**：OpenAPI / generated client / contract tests / unit tests / integration tests MUST 100% 同步覆盖聚合请求模型与 provider 来源字段。
- **SC-005**：单 provider 失败场景下，其他 provider 结果 MUST 全部返回；响应 MUST 包含结构化失败信息。

## 假设

- 调用方以现有 `v0.2.1` 风格为主，少量调用方愿意在 `v0.2.2` 之后消费 provider 来源字段做差异化处理。
- OpenSubtitles provider 的现有 `v0.2.1` 实现稳定，`v0.2.2` 不重写 OpenSubtitles adapter，仅按需做接口形态调整以兼容多 provider gateway。
- 迅雷字幕 provider 接口 `https://api-shoulei-ssl.xunlei.com/oracle/subtitle` 的 `name + languages` 形态是当前可用基线；其他字段（`imdb_id` 等）即使后续接口扩展，也不在 `v0.2.2` 范围内。
- `v0.2.2` 不引入新数据库 schema，provider 元数据复用现有 `Provider` / `ProviderCredential` 表。
- 现有 `v0.2.1` 路由契约保持向后兼容；聚合请求模型以增量方式暴露新能力，不重设计 URL 或主响应形态。
- 仓库级全局约定（包管理器 `pnpm`、数据库测试分层 `mock / PGlite / Postgres / Neon`、运行时环境映射、版本约定 `v0.2.2`、API 契约链路 `docs/api/openapi.yaml` + Orval + Scalar）以 `.github/copilot-instructions.md` 为真源。

## 范围外后续工作 *(mandatory)*

以下内容明确不在 `v0.2.2` 范围内，留作后续版本或独立 feature：

- 更多 provider 接入（subhd、字幕库、第三方字幕聚合 API 等）。
- provider 高级排序 / 评分编排 / 跨 provider 去重。
- provider 健康状态、熔断、限流、自适应降级、并行调用与超时预算。
- 手动上传字幕 / 缓存字幕查看 / 编辑 / 转正（属于 `v0.3.0`）。
- SubHub 自有字幕资产管理（属于 `v0.3.0`）。
- AI 审核 / 清洗 / 改写字幕（属于 `v0.4.0`）。
- 字段改名（`season` → `season_number` / `language` → `languages` 等）的 breaking 升级：需要独立 spec 与兼容层评估，不在 patch 阶段执行。
- 复杂的 provider 调度平台 / provider 注册中心 / 插件化架构。

## 首批实现范围建议 *(mandatory)*

### 范围内（`v0.2.2` 首批落地）

1. **聚合请求模型落地**：在 `subtitle-gateway.ts` 引入稳定的 `SubtitleSearchInput` 聚合类型，承载 `v0.2.2` 提议字段集合；保持 `v0.2.1` 字段命名不变。
2. **provider 适配层抽象**：在 `src/server/providers/` 下引入 provider 注册点（`opensubtitles` / `xunlei`）；gateway 通过 provider key 调度；adapter 实现 `search` 接口。
3. **迅雷字幕 provider adapter**：基于 `https://api-shoulei-ssl.xunlei.com/oracle/subtitle` 实现最小可用 adapter；至少消费 `query` + `languages`；不消费字段静默忽略；缺必要字段时跳过。
4. **OpenSubtitles provider 适配形态收敛**：保持现有实现，按多 provider gateway 期望暴露 `search` 形态；不削弱 `v0.2.1` 字段消费能力。
5. **结果归一化**：引入 `AggregatedSubtitleResult`，`provider` 字段显式注入；provider 原始字段保留在 `raw` 中；老调用方消费路径保持兼容。
6. **provider 错误隔离**：串行调用已启用 provider；单 provider 失败被捕获，不影响其他 provider；所有 provider 失败时返回明确错误。
7. **OpenAPI / generated / tests 同步**：聚合请求 / 响应模型变更 MUST 同步到 `docs/api/openapi.yaml`、`src/lib/api/generated/`、route Zod schema 与 contract / unit / integration tests。
8. **配置与凭据管理**：迅雷 provider 复用 `Provider` / `ProviderCredential` 模型与 `credential-pool.ts` 抽象；凭据缺失不破坏 gateway 跳过行为。

### 范围外（`v0.2.2` 不做）

- `filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only` 的首批暴露（首批不纳入聚合模型）。
- 字段改名（`season` → `season_number` 等）的 breaking 升级。
- 第三方 provider 注册中心 / 插件化 provider 框架。
- 并行调用 / 熔断 / 评分 / 跨 provider 去重 / 自适应降级。
- 手动上传字幕 / 缓存字幕管理 / 自有字幕资产管理 / AI 处理。

## 需要改动的模块范围 *(mandatory)*

### 后端核心改动

- `src/server/subtitles/subtitle-gateway.ts`：
  - 引入稳定的 `SubtitleSearchInput` 聚合类型。
  - 引入 provider 选择 / 调度逻辑（按"已启用 + 必要字段齐全"过滤）。
  - 引入串行调用与错误隔离。
  - 引入结果归一化与 `provider` 注入。
  - 保持与 `v0.2.1` `OpenSubtitlesSearchInput` 行为兼容。
- `src/server/providers/opensubtitles-adapter.ts`：
  - 收敛适配形态以适配多 provider gateway；`v0.2.1` 行为 MUST 不变。
- `src/server/providers/xunlei-adapter.ts`（新增）：
  - 实现迅雷字幕 provider 的 `search` 接口。
  - 字段映射：`query` → `name`，`languages` → `languages`。
  - 必要条件缺失时跳过。
- `src/server/providers/`：引入 provider 注册点（轻量注册表或工厂），不引入插件化框架。
- `src/app/api/subtitles/search/route.ts`：
  - 扩展 Zod schema 以承载聚合请求模型。
  - 保持现有 400 校验语义（`type=movie` + 季集字段冲突等）。
  - 响应结构增量扩展 `provider` 字段。

### 配置与凭据

- `src/server/providers/credential-pool.ts`：
  - 保持现有 OpenSubtitles 凭据池行为独立；迅雷 provider 暂不接入凭据池（如需后续接入，独立 spec）。
- `src/server/storage/schema.ts`：
  - 不新增 schema；复用 `Provider` / `ProviderCredential` / `subtitleSearchRequests` 现有结构。

### API 契约链路（仓库级约定）

- `docs/api/openapi.yaml`：聚合请求 / 响应模型 + provider 来源字段。
- `src/lib/api/generated/`：由 Orval 重新生成。
- `src/lib/api/`：手写封装层（如需）。
- API 文档展示：`/docs/api`（Scalar）。

### 测试改动

- `tests/contract/subtitles.contract.test.ts`：
  - 覆盖聚合请求模型。
  - 覆盖 provider 来源字段。
  - 覆盖单 provider 失败隔离。
- `tests/contract/xunlei-adapter.contract.test.ts`（新增）：
  - 覆盖迅雷 provider 字段映射、必要条件跳过、不支持字段忽略。
- `tests/unit/`：
  - 覆盖 provider 选择逻辑。
  - 覆盖结果归一化与 `provider` 注入。
  - 覆盖串行调用与错误隔离。
- `tests/integration/`：
  - 覆盖多 provider 并存路径与单 provider 失败隔离（使用真实 Postgres 或 PGlite，按 `.github/copilot-instructions.md` 数据库测试分层约定选择）。

### 文档改动

- `docs/api/openapi.yaml`：见上。
- `specs/004-multi-provider-search/plan.md`（待 `speckit.plan` 阶段生成）：设计细节与决策记录。
- `specs/004-multi-provider-search/contracts/`（待 `speckit.plan` 阶段生成）：聚合请求 / 响应模型契约文件。

## 页面规范更新

- **需更新的既有页面规范**: None（本功能为后端接口扩展，不触达 `docs/pages/*.md`）
- **需新建的页面规范**: None
- **是否需要更新 `DESIGN.md`**: No（本功能不引入视觉语言、设计令牌或组件规则变更）
