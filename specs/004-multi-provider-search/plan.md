# 实施计划: 多字幕 provider 搜索入口模型基础版（含迅雷字幕 provider 接入）

**分支**: `004-multi-provider-search` | **日期**: 2026-06-27 | **规格**: `specs/004-multi-provider-search/spec.md`

**输入**: 来自 `specs/004-multi-provider-search/spec.md` 的功能规格，以及 `src/server/subtitles/subtitle-gateway.ts`、`src/server/providers/opensubtitles-adapter.ts`、`src/server/providers/credential-pool.ts`、`src/server/providers/provider-repository.ts`、`src/server/storage/schema.ts`、`src/app/api/subtitles/search/route.ts`、`docs/api/openapi.yaml`、`tests/contract/subtitles.contract.test.ts`、`.specify/memory/constitution.md`、`docs/releases/versioning.md`、`.github/copilot-instructions.md`

**说明**: 本计划实现 `v0.2.2`「多字幕 provider 搜索入口模型基础版」，目标是建立 SubHub 聚合搜索请求模型，接入迅雷字幕 provider 作为第二个 provider 落地样本，并完成 provider 能力差异建模、结果归一化、最小错误隔离与 OpenAPI / generated client / tests / 文档同步。`v0.2.1` 已收口的字段扩展（`imdb_id` / `tmdb_id` / `type`）保持不变；本计划不削弱其能力。

## 摘要

本 feature 在 `/api/subtitles/search` 基础上引入"多 provider 聚合搜索入口模型"。核心实现路径：

1. 在 `subtitle-gateway.ts` 引入稳定的 `SubtitleSearchInput` 聚合模型，承载 `v0.2.2` 提议字段集合；保留 `v0.2.1` 字段命名不变以避免 breaking。
2. 引入 provider 适配层抽象：定义统一的 `SubtitleProviderAdapter` 接口，`OpenSubtitlesAdapter` 与新接入的 `XunleiAdapter` 均实现该接口；gateway 通过 provider key（`opensubtitles` / `xunlei`）调度，adapter 仅负责与上游交互。
3. 接入迅雷字幕 provider：以 `https://api-shoulei-ssl.xunlei.com/oracle/subtitle` 为入口，至少消费 `query`（映射 `name`）与 `languages`；不支持字段静默忽略；缺必要字段时跳过。
4. 引入结果归一化模型 `AggregatedSubtitleResult`：`provider` 字段由 SubHub 显式注入；provider 原始字段保留在 `raw` 中；老调用方消费路径保持向后兼容。
5. 引入最小错误隔离：单 provider 失败不拖垮整体搜索；其他 provider 结果继续返回；所有 provider 失败时返回明确错误（502）。
6. 同步更新 OpenAPI / generated client / route Zod schema / contract tests / unit tests / integration tests。

### 与 `v0.2.1` / `v0.3.0` 的边界

- `v0.2.1` 负责"已发布 API 的非 breaking 字段扩展"，本计划不重做其工作；`v0.2.1` 的字段消费路径 MUST 保持不变。
- `v0.2.2` 负责"多 provider 搜索入口模型 + 第二 provider 接入"；本计划不进入 provider 平台重构、不引入字段改名 breaking、不引入并行 / 熔断 / 评分编排。
- `v0.3.0` 负责"字幕资产管理基础版"；本计划不涉及手动上传、缓存管理、自有资产管理；这些明确排除。
- `v0.4.0` 负责"字幕内容治理与 AI 处理"；本计划不涉及。

## 设计上下文

**全局设计系统**: `DESIGN.md`（本功能不触达）

**相关页面规范**: 无（纯后端接口扩展与 provider 适配层扩展）

**已评审的设计输入**:
- `specs/004-multi-provider-search/spec.md`：本功能规格
- `src/server/subtitles/subtitle-gateway.ts`：当前网关实现，单 provider（OpenSubtitles）调度
- `src/server/providers/opensubtitles-adapter.ts`：当前 OpenSubtitles 适配器，`OpenSubtitlesSearchInput` 与 `OpenSubtitlesSubtitle` 模型
- `src/server/providers/credential-pool.ts`：凭据池抽象（`selectProviderCredential` / `markCredentialUsed` / `markCredentialFailure`）
- `src/server/providers/provider-repository.ts`：Provider 仓库，含 `listProviders` / `requireProvider` / `setProviderStatus` 等
- `src/server/storage/schema.ts`：`providerTypes = ["opensubtitles"]` enum（`v0.2.2` **不**扩展）、`providerStatuses`、`subtitleSearchStatuses`、`providers` / `providerCredentials` 表
- `src/app/api/subtitles/search/route.ts`：当前 route Zod schema
- `docs/api/openapi.yaml`：当前 `/api/subtitles/search` 契约真源；`SubtitleSearchResult` 的 `provider` enum 当前为 `opensubtitles` 单值
- `tests/contract/subtitles.contract.test.ts`：当前契约测试
- `tests/runtime/`、`tests/helpers/env-scenarios.ts`：测试运行时配置
- `.specify/memory/constitution.md`：宪章原则 I-VI
- `docs/releases/versioning.md`：`v0.2.2` 范围定义
- `.github/copilot-instructions.md`：仓库级全局约定（包管理器 `pnpm`、数据库测试分层、运行时环境映射、API 契约链路）

## 技术上下文

**语言/版本**: TypeScript；`next@16.2.6`、`react@19.2.6`、`typescript@6.0.3`、`zod`、`drizzle-orm`

**核心依赖**:
- Next.js Route Handler（route Zod schema 与请求处理）
- `subtitle-gateway.ts`（聚合搜索编排）
- `credential-pool.ts`（OpenSubtitles 凭据池，迅雷 provider 暂不接入）
- `provider-repository.ts`（Provider 元数据）
- OpenSubtitles REST API（结构化检索）
- 迅雷字幕 API `https://api-shoulei-ssl.xunlei.com/oracle/subtitle`（名称检索）
- Orval + Scalar（API 契约链路）

**存储**: `v0.2.2` **不**做任何数据库 schema 变更（与 `versioning.md` v0.2.2 范围一致）；不扩展 `providerTypes` enum、不新增 migration、不变更 `providers` / `provider_credentials` / `subtitle_search_requests` 表结构。详见 §9.1。

**测试**: `vitest`；分层为 `mock/no-db`（纯逻辑单测）、`PGlite`（contract / unit）、`real Postgres`（integration）。遵循 `.github/copilot-instructions.md` 数据库测试分层约定

**目标平台**: Vercel + Neon Postgres（生产）/ 本地开发

**项目类型**: web-service（Next.js API）

**性能目标**:
- 单 provider 搜索 p95 延迟 MUST 不高于 `v0.2.1` 同路径
- 多 provider 串行调用端到端 p95 SHOULD 不高于"单 provider 最慢者 + 1s"（首批允许）
- provider 失败隔离 MUST 不引入额外串行阻塞（失败快速失败）

**约束条件**:
- 不引入 breaking API 变更
- 不直接透传 OpenSubtitles 或迅雷上游 query params 作为长期对外契约
- 不引入并行调用 / 熔断 / 评分编排 / 跨 provider 去重
- 不引入字段改名（保持 `season` / `episode` / `language` 命名不变）
- 不引入新数据库 schema

**规模/范围**: 单接口扩展 + 一个新 provider adapter + 适配层抽象；涉及 route / gateway / adapter 注册表 / adapter 实现 / OpenAPI / generated / tests 六层同步

## 宪章检查

*门禁：必须在第 0 阶段研究前通过，并在第 1 阶段设计后复检。*

- ✅ 已定义代码质量门禁：`pnpm lint` + `pnpm typecheck` + `pnpm format:write`，CI 强制执行
- ✅ 已定义必需测试策略：unit（provider 选择、字段映射、结果归一化、错误隔离）+ contract（聚合 API 行为、provider 来源字段）+ integration（多 provider 并存路径与单 provider 失败隔离）
- ✅ 已定义对外行为的 UX/API 一致性约束：统一错误结构 `ErrorResponse`；provider 失败信息以结构化形式暴露（不堆栈泄漏）；老调用方消费路径 100% 向后兼容
- ✅ 已定义可度量性能预算：单 provider p95 ≤ `v0.2.1` 同路径；多 provider 串行 p95 ≤ 最慢者 + 1s
- ✅ 已记录面向长期可维护性的简洁化方案：provider 适配 MUST 隔离在 `SubtitleProviderAdapter` 接口之后（宪章原则 VI）；`subtitle-gateway.ts` 不直接感知 provider 上游字段命名
- ✅ 已识别设计来源：本功能不触达 `DESIGN.md` 与 `docs/pages/*.md`
- ✅ 计划已声明是否需要对 `DESIGN.md` 增补系统级规则：No
- ✅ 已明确 worktree 隔离：`004-multi-provider-search` 分支，单 active feature
- ✅ 已明确可追溯关系：feature id `004` → `specs/004-multi-provider-search/` → 分支 `004-multi-provider-search` → 主 issue TBD
- ✅ 已明确 issue 同步范围：仅面向 `specs/004-multi-provider-search/`，不跨 spec 混批

## 设计映射

### 适用规则

- **全局规则**: 无（本功能不触达视觉设计系统）
- **页面规则**: 无（本功能不触达页面规范）

### 计划中的文档变更

- **更新 `DESIGN.md`**: No（纯后端接口扩展与 provider 适配层扩展）
- **更新既有页面规范**: None
- **新建页面规范**: None

## 项目结构

### 文档（本功能）

```text
specs/004-multi-provider-search/
├── plan.md              # 本文件
├── research.md          # 第 0 阶段产物
├── data-model.md        # 第 1 阶段产物
├── quickstart.md        # 第 1 阶段产物
├── contracts/           # 第 1 阶段产物
│   ├── subtitle-search-request.md
│   ├── subtitle-search-response.md
│   ├── provider-adapter-contract.md
│   └── xunlei-provider-quirks.md
└── checklists/
    └── requirements.md
```

### 源码（仓库根目录）

```text
src/
├── app/api/subtitles/search/route.ts          # Zod schema 扩展（保持 v0.2.1 兼容）
├── server/subtitles/
│   ├── subtitle-gateway.ts                    # 聚合编排 + provider 选择 + 错误隔离
│   └── subtitle-result-normalizer.ts          # 结果归一化（新增）
├── server/providers/
│   ├── provider-adapter.ts                    # SubtitleProviderAdapter 接口（新增）
│   ├── provider-registry.ts                   # provider key -> adapter 映射（新增）
│   ├── opensubtitles-adapter.ts               # 收敛为实现 SubtitleProviderAdapter 接口
│   ├── xunlei-adapter.ts                      # 迅雷 provider adapter（新增）
│   ├── credential-pool.ts                     # 现有实现，OpenSubtitles 凭据池隔离保持
│   └── provider-repository.ts                 # 现有实现，支持多 provider 列表
└── server/storage/schema.ts                   # `v0.2.2` 不改动（详见 §9.1）

docs/api/openapi.yaml                          # 契约真源（SubtitleSearchResult.provider 扩展 + 新增 provider 失败信息）

tests/
├── contract/subtitles.contract.test.ts        # 聚合 API 行为 + provider 来源字段
├── contract/xunlei-adapter.contract.test.ts   # 迅雷 adapter 单元 + 契约测试（新增）
├── runtime/                                   # 多 provider 运行时场景
├── unit/                                      # provider 选择、归一化、错误隔离
└── integration/                               # 多 provider 并存路径与单 provider 失败隔离
```

**结构决策**: 单体 Next.js 项目，沿用现有 `src/app/api/` + `src/server/` 分层；新增 `provider-adapter.ts` 接口与 `provider-registry.ts` 轻量注册表（不引入插件化框架）；新增 `subtitle-result-normalizer.ts` 归一化模块。

## 设计保真实施策略

- 本功能不触达视觉设计系统，无需对照 `DESIGN.md` 或页面规范校验。
- 实现过程中代码校验聚焦于 API 契约一致性：route schema ↔ OpenAPI ↔ generated client ↔ gateway input ↔ adapter input ↔ 结果归一化。
- provider 适配 MUST 隔离在 `SubtitleProviderAdapter` 接口之后；`subtitle-gateway.ts` 不感知任何 provider 的上游字段命名。

## 复杂度追踪

| 例外项 | 必要原因 | 为何拒绝更简单方案 |
|-----------|------------|-------------------------------------|
| `SubtitleProviderAdapter` 抽象层 | gateway 需要按 provider key 调度，且不同 provider 字段消费能力差异显著（OpenSubtitles 结构化 vs 迅雷名称检索） | 直接把 provider 分支写进 gateway 会导致 gateway 膨胀，违反宪章原则 VI（provider 集成 MUST 隔离在稳定接口之后） |
| 结果归一化模块 | 多 provider 返回字段不一致（OpenSubtitles `file_id` vs 迅雷 `cid` / `gcid` / `url` 等），需要统一出口 | 在 gateway 内联归一化会导致 gateway 承担 provider 特定知识 |
| provider 错误隔离与失败信息结构化 | 多 provider 聚合的首要价值是鲁棒性，单 provider 失败必须隔离 | 简单 fail-fast 会让一个 provider 不可用拖垮整个搜索 |
| 串行调用 provider | 首批优先追求实现简单、错误隔离清晰、性能边界明确 | 并行调用需要超时预算与去重策略，超出 v0.2.2 范围 |
| `provider-registry` 代码层硬编码 provider key | 迅雷 provider 在 `v0.2.2` 不依赖数据库 schema；provider key → adapter 映射由代码层决定 | 直接把 provider 分支写进 gateway 会让 gateway 膨胀，违反宪章原则 VI；引入插件化框架超出 `v0.2.2` 范围 |

---

## 1. Scope Summary

### 1.1 范围内（本 plan 实现）

| 模块 | 内容 |
|------|------|
| 聚合请求模型 | `SubtitleSearchInput` 承载 `v0.2.2` 提议字段集合；保持 `v0.2.1` 字段命名不变 |
| provider 适配层 | `SubtitleProviderAdapter` 接口 + `provider-registry.ts` 轻量注册表 |
| 迅雷 provider 接入 | `XunleiAdapter` 接入 `https://api-shoulei-ssl.xunlei.com/oracle/subtitle` |
| OpenSubtitles provider 适配形态收敛 | 沿用现有实现，按多 provider gateway 期望暴露 `search` 接口 |
| 结果归一化 | `AggregatedSubtitleResult` 含 `provider` 字段（SubHub 显式注入）+ `raw` 保留原始字段 |
| provider 错误隔离 | 单 provider 失败隔离；串行调用；所有 provider 失败返回 502 |
| OpenAPI 同步 | `SubtitleSearchResult.provider` enum 扩展 + `provider_failures` 失败信息结构 |
| generated client 同步 | 由 Orval 重新生成 |
| 测试 | unit + contract + integration |
| 文档 | 本 plan + research + data-model + quickstart + contracts |

### 1.2 范围外（本 plan 不实现）

| 排除项 | 归属 |
|--------|------|
| `filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only` 首批暴露 | 待评估 |
| 字段改名（`season` → `season_number` 等） | post-mvp |
| 并行调用 / 超时预算 / 熔断 / 自适应降级 | post-mvp |
| 第三方 provider 注册中心 / 插件化框架 | post-mvp |
| 跨 provider 评分编排 / 去重 / 排序 | post-mvp |
| 手动上传字幕 / 缓存字幕管理 / 自有字幕资产管理 | `v0.3.0` |
| AI 审核 / 清洗 / 改写 | `v0.4.0` |

### 1.3 为什么把"字段扩展"和"多 provider 入口模型"分到 `v0.2.1` / `v0.2.2`

- `v0.2.1` 解决"已发布 API 的非 breaking 字段扩展"，让持有结构化 ID 的调用方获得更高命中率；范围严格限定在 OpenSubtitles 单 provider 视角下的字段扩展。
- `v0.2.2` 解决"多 provider 入口模型"，目标是在不削弱 OpenSubtitles 主路径的前提下接入第二个 provider，建立 provider 能力差异建模、结果归一化与最小错误隔离。两者的核心问题域、provider 抽象层级、测试分层不同，应作为两个独立 feature 推进。

## 2. Contract Plan

### 2.1 聚合请求模型保留字段（`SubtitleSearchInput`）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | free-text 兜底；与 `v0.2.1` 一致 |
| `year` | integer 1800-3000 | 否 | 与 `v0.2.1` 一致 |
| `season` | integer ≥ 0 | 否 | 保持命名（不升级为 `season_number`） |
| `episode` | integer ≥ 0 | 否 | 保持命名（不升级为 `episode_number`） |
| `language` | string | 否 | 保持命名（不升级为 `languages`） |
| `imdbId` | string `tt\d+` | 否 | `v0.2.1` 已落地 |
| `tmdbId` | integer ≥ 1 | 否 | `v0.2.1` 已落地 |
| `type` | enum `movie` / `episode` | 否 | `v0.2.1` 已落地 |
| `query` | string | 否 | 自由文本；与 `title` 的关系由 gateway 决定（详见 §3） |

> **命名沿用说明**：`v0.2.1` 已确认保持 `season` / `episode` / `language` 命名不变以避免 breaking。`v0.2.2` 继续保持现状命名；`season_number` / `episode_number` / `languages` 等上游语义对齐名在 post-mvp 字段改名阶段统一处理，首批不暴露。

### 2.2 旧调用方兼容性

- 所有 `v0.2.1` 风格的请求（`title` + 可选 `year` / `season` / `episode` / `language` / `imdb_id` / `tmdb_id` / `type`） MUST 行为不变。
- 响应结构 `SubtitleSearchResponse` MUST 向后兼容：每个 `results[].provider` 当前值 `opensubtitles` MUST 保持有效；新增 `xunlei` 值；其他字段不变。
- 老调用方若仅消费 `id` / `language` / `releaseName` / `format` / `downloadUrl`，行为 MUST 与 `v0.2.1` 完全一致。

### 2.3 "字段可传 != 所有 provider 都消费" 的契约表达

- `SubtitleSearchInput` 是 SubHub 自己的契约，不为 provider 兼容性背书。
- provider 内部 MUST 仅消费其支持的字段；不支持字段 MUST 静默忽略（不传上游、不 warn、不计入错误）。
- 当 provider 缺少"必须"字段（迅雷的 `query` 与 `languages`）时，gateway MUST 跳过该 provider 而非报错。
- OpenAPI 文档 MUST 在聚合请求模型描述中显式说明：每个字段是 SubHub 通用请求字段，不代表所有 provider 都同等支持；provider 实际可消费字段由 provider adapter 决定。

### 2.4 响应模型扩展：provider 来源标识

`SubtitleSearchResult` 增量扩展：

```yaml
SubtitleSearchResult:
  required: [id, provider, language, releaseName, format, downloadUrl]
  properties:
    id: string                           # 网关生成的字幕引用；OpenSubtitles: opensubtitles:{providerId}:{file_id}；迅雷: xunlei:{providerId}:{cid|gcid}
    provider:
      type: string
      enum: [opensubtitles, xunlei]      # 从 [opensubtitles] 扩展
    language: string | null
    releaseName: string | null
    format: string
    downloadUrl: string                  # OpenSubtitles: /api/subtitles/download?subtitleId=...；迅雷: 同上
    raw:
      type: object
      additionalProperties: true
      description: provider 原始字段；OpenSubtitles 含 download_count 等；迅雷含 cid / gcid / score / duration 等
    score:
      type: number
      nullable: true
      description: provider 原始评分（迅雷透传 score；OpenSubtitles 暂无）
```

新增顶层 `provider_failures` 字段（在 `SubtitleSearchData` 中，可选）：

```yaml
SubtitleSearchData:
  required: [status, results]
  properties:
    status: enum [success, partial]
    results: array<SubtitleSearchResult>
    provider_failures:
      type: array
      items:
        type: object
        required: [provider, reason]
        properties:
          provider: enum [opensubtitles, xunlei]
          reason: enum [upstream_failed, timeout, rate_limited, skipped_missing_fields, skipped_disabled, authentication_failed]
          message: string
      description: 单 provider 失败信息；与 results 并存但不阻塞主流程
```

> `status` 扩展为 `success | partial`：`success` 表示所有 provider 成功或无 provider；`partial` 表示至少一个 provider 失败但其他 provider 返回了结果。`partial` 不阻塞 200 响应。

### 2.5 OpenAPI 与 generated client 同步

- OpenAPI 真源：`docs/api/openapi.yaml`，本 plan 明确列出 MUST 同步的字段（见 §5.4）。
- Orval 重新生成：`pnpm api:client`。
- 手写封装层（如需）：`src/lib/api/`。
- API 文档展示：`/docs/api`（Scalar） MUST 与 OpenAPI 同步更新。
- 同步验证：`pnpm api:check`（契约链路的真伪校验）。

## 3. Search Request Model Plan

### 3.1 字段处理方向

| 字段 | 首批支持 | 在请求模型中的位置 | provider 消费情况 |
|------|----------|--------------------|------------------|
| `title` | ✅ | `SubtitleSearchInput.title` | OpenSubtitles：参与 `buildSearchQuery`；迅雷：忽略（迅雷需要 `query`，不消费 `title`） |
| `query` | ✅ | `SubtitleSearchInput.query` | OpenSubtitles：参与 `buildSearchQuery`（与 `title` 等价）；迅雷：映射为 `name`（trim 后非空才传） |
| `language` | ✅ | `SubtitleSearchInput.language` | OpenSubtitles：映射 `languages`；迅雷：映射 `languages` |
| `imdbId` | ✅ | `SubtitleSearchInput.imdbId` | OpenSubtitles：消费；迅雷：忽略 |
| `tmdbId` | ✅ | `SubtitleSearchInput.tmdbId` | OpenSubtitles：消费；迅雷：忽略 |
| `season` | ✅ | `SubtitleSearchInput.season` | OpenSubtitles：消费；迅雷：忽略 |
| `episode` | ✅ | `SubtitleSearchInput.episode` | OpenSubtitles：消费；迅雷：忽略 |
| `type` | ✅ | `SubtitleSearchInput.type` | OpenSubtitles：消费；迅雷：忽略 |
| `year` | ✅ | `SubtitleSearchInput.year` | OpenSubtitles：消费；迅雷：忽略 |
| `season_number` | ⛔ | 不暴露 | 字段改名阶段处理 |
| `episode_number` | ⛔ | 不暴露 | 字段改名阶段处理 |
| `languages`（复数） | ⛔ | 不暴露 | 与 `language` 命名冲突；字段改名阶段处理 |
| `filename` | ⛔ | 不暴露 | 价值有限，待评估 |
| `moviehash` | ⛔ | 不暴露 | 需调用方预计算 |
| `hearing_impaired` | ⛔ | 不暴露 | 偏好过滤，非定位字段 |
| `foreign_parts_only` | ⛔ | 不暴露 | 语义较窄，上游支持不稳定 |

### 3.2 字段优先级（gateway 内派生 provider 输入时）

1. **ID 优先**：`imdbId` / `tmdbId` 优先于 `query` / `title`。与 `v0.2.1` 一致：`imdbId` 优先于 `tmdbId`。
2. **季集与类型协同**：`season` / `episode` 仅在 `type=episode` 或已有 ID 定位下作为精修字段；`type=movie` + `season`/`episode` MUST 400（沿用 `v0.2.1`）。
3. **`query` / `title` 兜底**：仅在无 ID 字段时走 `query` 或 `title`（拼 `title` + `year` + `SxxExx`）。
4. **辅助字段**：`filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only` 首批不纳入聚合请求模型。

### 3.3 `query` 与 `title` 的关系

- `title` 是 `v0.2.1` 已有必填字段，`query` 是 `v0.2.2` 新增的可选字段。
- 关系：
  - 调用方仅传 `title`：与 `v0.2.1` 行为一致；OpenSubtitles 走 `buildSearchQuery`；迅雷因缺 `query` 跳过。
  - 调用方传 `query` 而非 `title`：OpenSubtitles 走 `buildSearchQuery`（以 `query` 作为 `title`）；迅雷走 `name` 路径。
  - 调用方同时传 `query` 与 `title`：OpenSubtitles 以 `title` 为优先拼入 `query`；迅雷以 `query` 为 `name` 路径。
- 简化策略：gateway 内部将 `title` 与 `query` 合并视为"free-text 查询"；OpenSubtitles 沿用 `buildSearchQuery`；迅雷仅看 `query`（缺则跳过）。

## 4. Provider Architecture Plan

### 4.1 适配层抽象

引入 `SubtitleProviderAdapter` 接口：

```ts
type SubtitleProviderKey = 'opensubtitles' | 'xunlei';

interface SubtitleProviderAdapter {
  readonly key: SubtitleProviderKey;
  search(
    credential: SelectedProviderCredential | null,
    input: SubtitleSearchInput,
    options: { fetchImpl?: typeof fetch; timeoutMs?: number }
  ): Promise<ProviderSearchOutcome>;
}

type ProviderSearchOutcome =
  | { ok: true; results: ProviderSearchResult[]; skipped?: false }
  | { ok: false; error: ProviderSearchError; skipped?: false }
  | { ok: true; results: []; skipped: true; reason: SkippedReason };
```

- `credential` 为 `null` 表示 provider 当前无需凭据（迅雷场景）。
- `skipped` 表示 provider 因必要条件缺失而跳过，不计入错误。
- `error` 表示 provider 调用失败。

### 4.2 provider-registry 轻量注册表

```ts
// src/server/providers/provider-registry.ts
const adapters: Record<SubtitleProviderKey, SubtitleProviderAdapter> = {
  opensubtitles: new OpenSubtitlesAdapter(),
  xunlei: new XunleiAdapter(),
};

export function getAdapter(key: SubtitleProviderKey): SubtitleProviderAdapter;
export function listProviderKeys(): SubtitleProviderKey[];
```

- 不引入插件化框架；首批硬编码两个 provider key。
- 后续若新增 provider，仅需在注册表追加一行 + 实现 `SubtitleProviderAdapter`。

### 4.3 OpenSubtitles provider 对接 richer request fields

- 沿用 `v0.2.1` 已落地的 `OpenSubtitlesSearchInput` 形态：消费 `query` / `imdbId` / `tmdbId` / `season` / `episode` / `language` / `type`。
- 适配 `SubtitleProviderAdapter` 接口：实现 `search(credential, input, options)`；`credential` 非空（OpenSubtitles 必须有凭据）。
- 凭据池行为（`markCredentialUsed` / `markCredentialFailure`） MUST 保持独立，由 `subtitle-gateway.ts` 在调用后处理；adapter 内部不直接操作凭据池。

### 4.4 迅雷 provider 映射 `query -> name` 与 `languages`

- 入口：`https://api-shoulei-ssl.xunlei.com/oracle/subtitle`。
- 字段映射：
  - `query`（trim 后非空）→ 上游 `name`
  - `languages`（trim 后非空）→ 上游 `languages`
  - 其他字段全部忽略，不传入上游。
- 必要条件：当 `query` 经 trim 后为空，adapter MUST 返回 `{ ok: true, results: [], skipped: true, reason: 'missing_required_field' }`；gateway 视为"该 provider 跳过本次搜索"，不计入错误。
- 凭据：当前接口可能无需凭据；`XunleiAdapter.search` 接受 `credential: null`；gateway 不为迅雷 provider 调用凭据池。

### 4.5 provider 内部参数映射边界

- provider adapter MUST 仅处理"本 provider 实际消费"的字段映射。
- provider adapter MUST NOT 感知其他 provider 的存在。
- provider adapter MUST NOT 直接与数据库交互；凭据、审计由 gateway 统一处理。
- provider adapter MUST 把 provider 原始响应解析为统一的 `ProviderSearchResult` 形态（id / language / releaseName / format / providerDownloadUrl / raw），由 gateway 调用归一化模块注入 `provider` 字段。
  - `providerDownloadUrl` 是 adapter 内部字段，承载 provider 原始下载地址，仅供 adapter / download 路由内部使用；**绝不**作为公共 API 的 `downloadUrl` 透传给 client。
  - 公共响应的 `downloadUrl` 一律由 SubHub gateway 统一生成为 `/api/subtitles/download?subtitleId={id}`（详见 §9.3）。

### 4.6 provider 不支持某字段时如何处理

- "忽略" MUST 是真正的静默忽略：不传上游、不 warn、不计入错误、不破坏 provider 调用。
- 唯一例外："必要条件字段"（迅雷的 `query` 与 `languages`）缺失时 adapter MUST 返回 skipped，不抛错。

### 4.7 provider 错误如何隔离

- gateway 在调用每个 provider 时 MUST 用 `try/catch` 包裹 adapter 调用：
  - adapter 返回 `{ ok: true, results, skipped: true }`：跳过，不计入失败。
  - adapter 返回 `{ ok: true, results }`：正常结果，加入聚合。
  - adapter 返回 `{ ok: false, error }` 或抛错：捕获，记录到 `provider_failures`，继续处理其他 provider。
- 凭据池行为：
  - OpenSubtitles 失败时 `markCredentialFailure` + `syncProviderFailureState` 保持现有逻辑。
  - 迅雷 provider 失败时不操作凭据池（当前不接入凭据池）。

### 4.8 并行 / 串行 / fallback 策略

- 首批采用 **串行调用** provider：实现简单、错误隔离清晰、性能边界明确。
- 不引入并行调用（避免超时预算复杂度）。
- 不引入 fallback 链（`providers.fallbackProviderId` 字段已存在但 `v0.2.2` 不启用；待 post-mvp 评估）。
- 性能预算：多 provider 串行 p95 ≤ 单 provider 最慢者 + 1s。

## 5. Result Normalization Plan

### 5.1 provider 来源字段

- `provider` 字段 MUST 由 SubHub 显式注入，取值 `opensubtitles` 或 `xunlei`；不允许直接复用 provider 原始数据中的同名字段。
- 老调用方按 `v0.2.1` 行为消费结果（只看 `id` / `language` / `releaseName` / `format` / `downloadUrl`），响应结构 MUST 保持向后兼容。

### 5.2 统一结果模型（`AggregatedSubtitleResult`）

```ts
type AggregatedSubtitleResult = {
  id: string;                       // 网关生成的字幕引用；OpenSubtitles: opensubtitles:{providerId}:{file_id}；迅雷: xunlei:{providerId}:{cid|gcid}
  provider: 'opensubtitles' | 'xunlei';
  language: string | null;
  releaseName: string | null;
  format: string;
  downloadUrl: string;              // 统一 /api/subtitles/download?subtitleId=...
  raw?: Record<string, unknown>;    // provider 原始字段；老调用方可忽略
  score?: number | null;            // 迅雷 score 透传；OpenSubtitles 暂无
};
```

### 5.3 迅雷返回字段的归一化映射

| 迅雷原始字段 | SubHub 字段 | 说明 |
|--------------|-------------|------|
| `cid` | `id` 的一部分（`xunlei:{providerId}:{cid}` 或 `{gcid}`） | 网关生成的稳定引用；优先用 `gcid`（更长，更稳定），缺失时回退 `cid` |
| `gcid` | 同上 | 优先使用 |
| `url` | `providerDownloadUrl`（adapter 内部）→ `downloadUrl`（公共，间接） | 迅雷的 `url` 进入 adapter 内部字段 `providerDownloadUrl`（仅供 adapter / download 路由内部使用）；公共 `downloadUrl` 由网关生成为 `/api/subtitles/download?subtitleId={xunlei:...}`，**不**直接用迅雷原始 `url`。原始 `url` 保留在 `raw.url` |
| `ext` | `format` | 字幕文件扩展名；缺失时回退 `srt` |
| `name` | `releaseName` | 字幕发布名；缺失时回退 `null` |
| `duration` | `raw.duration` | 视频时长，不进入主结果对象 |
| `languages` | `language` | 迅雷的语言码可能与 OpenSubtitles 不同；保留在 `raw.languages`，主字段 `language` 优先取第一个语言码 |
| `source` | `raw.source` | 字幕来源 |
| `score` | `score` + `raw.score` | 顶层 `score` 字段透传；原始值保留在 `raw.score` |
| `fingerprintf_score` | `raw.fingerprintf_score` | 指纹评分，仅保留在 `raw` |
| `extra_name` | `raw.extra_name` | 扩展名，仅保留在 `raw` |
| `mt` | `raw.mt` | 字幕类型标识，仅保留在 `raw` |

> **downloadUrl 语义**：`downloadUrl` 是 SubHub 网关生成的下载路径，不是迅雷原始 URL。所有 provider MUST 走统一的 `/api/subtitles/download?subtitleId=...` 入口；download 路由根据 `subtitleId` 前缀判断 provider，再走各自 adapter 的下载流程。迅雷原始 `url` 保留在 `raw.url` 用于调试与审计。

### 5.4 OpenAPI 同步字段清单

`docs/api/openapi.yaml` MUST 同步：

1. `SubtitleSearchResult.provider` enum：从 `[opensubtitles]` 扩展为 `[opensubtitles, xunlei]`
2. `SubtitleSearchResult.raw`：新增可选对象类型
3. `SubtitleSearchResult.score`：新增可选 number（nullable）
4. `SubtitleSearchResult.id` description：补充迅雷引用格式 `xunlei:{providerId}:{cid|gcid}`
5. `SubtitleSearchResult.downloadUrl` description：明确"统一下载入口，由网关根据 subtitleId 前缀路由"
6. `SubtitleSearchData.status`：从 `[success]` 扩展为 `[success, partial]`
7. `SubtitleSearchData.provider_failures`：新增数组，承载 provider 失败信息

`/api/subtitles/search` 描述 MUST 补充："聚合搜索接口支持多个 provider；不同 provider 的能力差异由 SubHub 内部处理，调用方无需关心。"

## 6. Implementation Layers

### 6.1 改动清单

| 层 | 文件 | 改动 |
|----|------|------|
| Route | `src/app/api/subtitles/search/route.ts` | Zod schema 保持 `v0.2.1` 不变；透传 `query` 字段（gateway 内部合并 `title`/`query`） |
| Gateway | `src/server/subtitles/subtitle-gateway.ts` | 重构为聚合编排：provider 选择 → 串行调用 → 错误隔离 → 结果归一化；引入 `provider_failures` 与 `status: partial` |
| Adapter Interface | `src/server/providers/provider-adapter.ts`（新增） | 定义 `SubtitleProviderAdapter` 接口与 `ProviderSearchOutcome` 类型 |
| Adapter Registry | `src/server/providers/provider-registry.ts`（新增） | provider key → adapter 映射；不引入插件化框架 |
| OpenSubtitles Adapter | `src/server/providers/opensubtitles-adapter.ts` | 收敛为实现 `SubtitleProviderAdapter`；`v0.2.1` 行为不变 |
| Xunlei Adapter | `src/server/providers/xunlei-adapter.ts`（新增） | 迅雷 provider adapter；`query → name` + `languages`；必要条件缺失返回 skipped |
| Normalizer | `src/server/subtitles/subtitle-result-normalizer.ts`（新增） | provider 原始结果 → `AggregatedSubtitleResult`；`provider` 注入 + `raw` 保留 |
| Credential Pool | `src/server/providers/credential-pool.ts` | OpenSubtitles 凭据池隔离保持；不引入新逻辑 |
| Provider Repository | `src/server/providers/provider-repository.ts` | `v0.2.2` 期间迅雷 provider 不走 `providers` 表（详见 §9.1），按需调整筛选逻辑时**仅**针对 OpenSubtitles |
| Storage Schema | `src/server/storage/schema.ts` | **不**做任何改动：`providerTypes` enum 保持 `["opensubtitles"]` 单值；表结构、migration 均不变 |
| OpenAPI | `docs/api/openapi.yaml` | §5.4 字段清单 |
| Generated Client | `src/lib/api/generated/` | Orval 重新生成 |
| Tests | `tests/contract/`、`tests/unit/`、`tests/integration/` | 见 §7 |

### 6.2 不改动的层

- `src/server/api/caller-key-auth.ts`：调用方鉴权与本次无关
- `src/server/storage/schema.ts`：本次**完全不动**（`providerTypes` 不扩展、表结构不变、无新增 migration）
- `src/server/services/runtime-readiness-service.ts`：运行时就绪检查逻辑不变
- 前端代码（本功能不触达）

## 7. Testing Plan

### 7.1 request validation 测试

- **目标**: 验证 route Zod schema 对 `v0.2.1` 风格请求与 `v0.2.2` 新增字段的校验语义
- **范围**:
  - `title` 必填校验
  - `year` 范围 1800-3000
  - `season` / `episode` 非负整数
  - `imdb_id` 格式 `tt\d+`
  - `tmdb_id` 正整数
  - `type` enum `movie` / `episode`
  - `type=movie` + `season`/`episode` 冲突返回 400
  - `type=episode` 缺季集且缺 ID 返回 400
- **层次**: `tests/unit/`（纯逻辑单测）+ `tests/contract/subtitles.contract.test.ts`（端到端 400 行为）

### 7.2 聚合请求模型兼容性测试

- **目标**: 验证 `v0.2.1` 风格请求行为 100% 不变
- **范围**:
  - 仅 `title` 请求走 OpenSubtitles `buildSearchQuery` 路径
  - `title + year + season + episode + language` 走原 fallback 路径
  - `imdb_id` / `tmdb_id` 优先策略与 `v0.2.1` 一致
  - 响应结构 `SubtitleSearchResponse.data.results[]` 字段集合不变；`provider` 仍为 `opensubtitles`
- **层次**: `tests/contract/subtitles.contract.test.ts`

### 7.3 OpenSubtitles 参数映射测试

- **目标**: 验证 `OpenSubtitlesAdapter.search` 在新接口形态下的字段消费
- **范围**:
  - `query` ≥ 3 字符才透传
  - `imdbId` / `tmdbId` / `season` / `episode` / `language` / `type` 完整映射
  - 短 query 不触发凭据池降级
- **层次**: `tests/unit/`（adapter 单元）+ `tests/contract/subtitles.contract.test.ts`（集成）

### 7.4 迅雷 provider 参数映射测试

- **目标**: 验证 `XunleiAdapter.search` 的字段映射与必要条件处理
- **范围**:
  - `query` 非空 → 映射为上游 `name`
  - `languages` 非空 → 映射为上游 `languages`
  - `imdbId` / `tmdbId` / `season` / `episode` / `type` / `year` 等字段被忽略
  - `query` 空 → 返回 `{ skipped: true, reason: 'missing_required_field' }`
  - `languages` 空 → 返回 skipped
  - 上游 5xx / 超时 / 网络异常 → 返回 `{ ok: false, error }`
- **层次**: `tests/contract/xunlei-adapter.contract.test.ts`（新增）+ `tests/unit/`

### 7.5 provider 错误隔离测试

- **目标**: 验证单 provider 失败不影响其他 provider
- **范围**:
  - OpenSubtitles 成功 + 迅雷失败 → 响应含 OpenSubtitles 结果 + `provider_failures[]` 含迅雷失败信息 + `status: partial`
  - 迅雷成功 + OpenSubtitles 失败 → 响应含迅雷结果 + `provider_failures[]` 含 OpenSubtitles 失败信息
  - 两个 provider 均失败 → 返回 502（`UPSTREAM_FAILED` 或 `NO_PROVIDERS_AVAILABLE`）
  - 单 provider 跳过（必要条件缺失） → 其他 provider 正常返回，`status: success`
- **层次**: `tests/unit/`（gateway 编排）+ `tests/integration/`（端到端）

### 7.6 provider 结果归一化测试

- **目标**: 验证 `AggregatedSubtitleResult` 的归一化逻辑
- **范围**:
  - OpenSubtitles 结果：id 格式 `opensubtitles:{providerId}:{file_id}`、`format` 来自扩展名或 `srt` 默认、`raw` 保留 `download_count` 等
  - 迅雷结果：id 格式 `xunlei:{providerId}:{cid|gcid}`、`format` 来自 `ext` 或 `srt`、`raw` 保留 `cid` / `gcid` / `url` / `score` / `fingerprintf_score` / `extra_name` / `mt` / `duration` / `languages` / `source`
  - `provider` 字段 MUST 由 SubHub 注入
  - 老调用方消费路径（`id` / `language` / `releaseName` / `format` / `downloadUrl`） MUST 向后兼容
- **层次**: `tests/unit/subtitle-result-normalizer.test.ts`（新增）

### 7.7 contract 测试

- **目标**: 验证聚合 API 对外契约
- **范围**:
  - `GET /api/subtitles/search` 完整请求 / 响应 schema 与 OpenAPI 一致
  - `provider_failures` 在响应中以正确结构暴露
  - `status: partial` 与 `status: success` 区分
  - 400 / 401 / 403 / 502 错误响应复用 `ErrorResponse` schema
- **层次**: `tests/contract/subtitles.contract.test.ts`（更新）+ `tests/runtime/`（运行时场景）

### 7.8 OpenAPI / generated 同步校验

- **目标**: 验证 OpenAPI 与 generated client 一致
- **范围**:
  - `pnpm api:check` 通过
  - `src/lib/api/generated/` 中 `SubtitleSearchResult.provider` enum 含 `xunlei`
  - `AggregatedSubtitleResult` 与 generated type 一致
  - 路由 Zod schema 与 OpenAPI schema 字段语义一致
- **层次**: CI 强制 + `tests/contract/openapi-generated-client.test.ts`（现有）

## 8. Risks & Compatibility

### 8.1 旧调用方兼容性

- **风险**: 多 provider 抽象可能引入意外行为变化（如 OpenSubtitles 调度顺序变化、响应顺序变化）
- **缓解**:
  - 现有 `v0.2.1` 行为 MUST 在 contract test 中固定，作为非 breaking 回归门禁
  - 响应结构 MUST 增量扩展而非破坏性重设计
  - 所有 `v0.2.1` 字段保持命名不变
  - OpenSubtitles adapter 在新接口形态下的行为 MUST 100% 等价

### 8.2 迅雷 provider 能力弱于 OpenSubtitles 时的降级

- **风险**: 调用方误以为迅雷 provider 也支持 IMDb ID 等结构化字段，导致体验不符预期
- **缓解**:
  - OpenAPI 文档 MUST 显式说明每个字段是 SubHub 通用请求字段，不代表所有 provider 都支持
  - 迅雷 provider 不消费 IMDb ID 等字段时 MUST 静默忽略，不报错
  - 响应中保留 provider 来源标识，调用方可根据 `provider` 字段做差异化处理
  - 后续 post-mvp 阶段可考虑在文档中补充 provider 能力矩阵

### 8.3 不同 provider 字段支持不一致时如何避免误导

- **缓解**:
  - 聚合请求模型描述 MUST 明确"字段可传 != 所有 provider 都消费"
  - provider 能力差异 MUST 在 adapter 内部显式建模（`SubtitleProviderAdapter` 接口的实现）
  - 文档 MUST 列出每个 provider 的可消费字段
  - 后续可考虑在响应中增加 per-result metadata，但 `v0.2.2` 不做

### 8.4 provider 返回数据质量差异

- **风险**: 不同 provider 的 `releaseName` / `format` / `language` 字段质量不一致，可能影响下游消费
- **缓解**:
  - 归一化逻辑 MUST 处理字段缺失（如 `releaseName` 为 `null`、`format` 默认 `srt`）
  - `raw` 字段 MUST 保留 provider 原始数据，便于后续做质量分析
  - 不引入跨 provider 去重（避免对"哪个结果更优"做主观判断）

### 8.5 首批不引入复杂排序与编排的限制

- **限制**:
  - 不做跨 provider 评分合并 / 排序编排
  - 不做并行调用 / 超时预算
  - 不做 provider 熔断 / 自适应降级
  - 不做跨 provider 去重
  - 不做 fallback 链（`providers.fallbackProviderId` 字段已存在但 `v0.2.2` 不启用）
- **影响**:
  - 多 provider 串行调用的端到端延迟高于并行场景
  - 单 provider 失败时无法快速熔断
  - 同一字幕可能被多个 provider 重复返回（调用方自行去重）
- **后续**: 这些能力放入 post-mvp 议题，由独立 spec 推进

### 8.6 性能风险

- **风险**: 串行调用多 provider 时端到端 p95 可能超过预算
- **缓解**:
  - 单 provider 失败时快速失败（不重试、不阻塞）
  - 必要时可后续引入并行调用（独立 spec）
  - 性能测试覆盖 `单 provider p95 ≤ v0.2.1 同路径` 与 `多 provider 串行 p95 ≤ 最慢者 + 1s` 两个断言

### 8.7 凭据池行为变化风险

- **风险**: 现有 `v0.2.1` 的 OpenSubtitles 凭据池行为（`markCredentialFailure` / `markCredentialUsed`）可能被新 gateway 逻辑破坏
- **缓解**:
  - OpenSubtitles adapter 的凭据处理逻辑 MUST 100% 等价于 `v0.2.1`
  - gateway 调用 OpenSubtitles 时仍走 `selectProviderCredential` + `markCredentialUsed` / `markCredentialFailure`
  - 迅雷 provider 不接入凭据池（独立 adapter）

## 9. 范围收口（已明确，不作为 review 决策点）

> 本节代替原「Conflict Points」章节。三个原本作为 review 决策点的冲突项已在本轮文档修订中**收口**为明确范围，所有 reviewer 可直接以本节为准。

### 9.1 providerTypes / schema 边界（已收口）

- **范围声明**：`v0.2.2` **不**做任何数据库 schema 变更。不扩展 `providerTypes` enum、不新增 migration、不变更 `providers` / `provider_credentials` / `subtitle_search_requests` 表结构。
- **迅雷 provider 接入路径**：走「不依赖数据库 schema 的最小接入路径」—— provider key → adapter 的映射由 `provider-registry.ts` 在代码层硬编码，gateway 通过 `provider-registry` 调度，不依赖 `providers` 表的 `type` 字段（保持 `["opensubtitles"]` 单值）。
- **provider 元数据控制**：`v0.2.2` 期间迅雷 provider 的启用 / 禁用 / 限流 / 冷却等调度控制仅由代码层配置决定（feature flag / 环境变量）。
- **未来路径**：若后续需将迅雷 provider 元数据持久化（启用 / 禁用、priority、weight、concurrency limit、fallbackProviderId 等），必须由 post-`v0.2.2` 独立 spec 推进，且先升级 `versioning.md` 中 `v0.2.2` 范围（很可能升 `v0.3.0`），届时才允许扩展 `providerTypes` enum 与新增 migration。

### 9.2 provider_failures 暴露方式（已收口）

- **范围声明**：provider 失败信息一律通过**响应 body** 暴露：`.data.status` 扩展为 `success | partial`，同时 `.data.provider_failures[]` 为可选数组承载失败详情。`partial` 不阻塞 200 响应。
- **明确不做**为：不采用仅在响应 header 暴露（如 `X-Subhub-Provider-Failures`）的方式。
- **兼容性**：老调用方若不读取 `provider_failures` / 不识别 `status: partial`，原有消费路径不受影响。

### 9.3 downloadUrl 统一入口（已收口）

- **范围声明**：公共 API 响应中的 `results[].downloadUrl` 一律由 SubHub gateway 统一生成为 `/api/subtitles/download?subtitleId={id}`；download 路由根据 `subtitleId` 前缀（`opensubtitles:` / `xunlei:`）判断 provider 后再走 adapter 的下载流程。
- **明确不做**为：不采用 provider 各自暴露不同下载路径的方式（避免 client 端根据 `provider` 切换 URL）。
- **adapter 内部字段命名**：adapter 内部使用独立的 `providerDownloadUrl` 字段承载 provider 原始 URL（如迅雷 `url`），与公共 API 的 `downloadUrl` 严格区分；provider 原始 URL 仅保留在 `AggregatedSubtitleResult.raw.url` 用于调试与审计，**绝不**直接出现在 `downloadUrl`。

## 10. Deliverables

### 10.1 请求模型调整

- `SubtitleSearchInput` 稳定聚合请求模型（`src/server/subtitles/subtitle-gateway.ts`）
- Route Zod schema 保持 `v0.2.1` 不变 + `query` 透传（`src/app/api/subtitles/search/route.ts`）

### 10.2 provider 接入

- `SubtitleProviderAdapter` 接口（`src/server/providers/provider-adapter.ts`）
- `provider-registry` 轻量注册表（`src/server/providers/provider-registry.ts`）
- `XunleiAdapter` 迅雷 provider adapter（`src/server/providers/xunlei-adapter.ts`）
- `OpenSubtitlesAdapter` 收敛为 `SubtitleProviderAdapter` 实现（`src/server/providers/opensubtitles-adapter.ts`）
- 迅雷 provider key 在 `provider-registry.ts` 硬编码；**不**修改 `providerTypes` enum、**不**新增 migration（详见 §9.1）

### 10.3 结果归一化

- `AggregatedSubtitleResult` 统一结果模型（`src/server/subtitles/subtitle-result-normalizer.ts`）
- `provider` 字段注入 + `raw` 字段保留原始 provider 数据
- 迅雷原始字段（`cid` / `gcid` / `url` / `ext` / `name` / `duration` / `languages` / `source` / `score` / `fingerprintf_score` / `extra_name` / `mt`）映射

### 10.4 OpenAPI / generated 更新

- `docs/api/openapi.yaml`：见 §5.4 字段清单
- `src/lib/api/generated/`：Orval 重新生成（`pnpm api:client`）
- `/docs/api`（Scalar）展示与 OpenAPI 同步
- `pnpm api:check` 校验通过

### 10.5 测试

- `tests/unit/subtitle-result-normalizer.test.ts`（新增）
- `tests/unit/provider-registry.test.ts`（新增）
- `tests/contract/xunlei-adapter.contract.test.ts`（新增）
- `tests/contract/subtitles.contract.test.ts`（扩展 provider 来源字段 + 错误隔离）
- `tests/integration/multi-provider-isolation.test.ts`（新增）
- `tests/runtime/`：新增多 provider 运行时场景

### 10.6 文档

- 本 plan（`specs/004-multi-provider-search/plan.md`）
- `research.md`：研究产物
- `data-model.md`：数据模型
- `quickstart.md`：端到端验证指南
- `contracts/`：4 个契约文件

---

## 11. Done When

- [ ] 所有交付物完成（§10.1-§10.6）
- [ ] `pnpm lint` + `pnpm typecheck` + `pnpm format:write` 通过
- [ ] `pnpm test` 全量测试通过（unit + contract + integration）
- [ ] `pnpm api:check` 通过（OpenAPI / generated 同步）
- [ ] 老调用方兼容性 contract test 100% 覆盖
- [ ] §9 范围收口三个项目已在文档中明示并与 `versioning.md` / `spec.md` / `contracts/*.md` 一致（**不再作为 review 决策点**）
- [ ] Issue 同步范围限定在 `specs/004-multi-provider-search/`
