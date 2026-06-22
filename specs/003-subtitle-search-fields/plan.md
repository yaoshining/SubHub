# 实施计划: 字幕搜索接口扩展检索字段

**分支**: `003-subtitle-search-fields` | **日期**: 2026-06-22 | **规格**: `specs/003-subtitle-search-fields/spec.md`

**输入**: 来自 `specs/003-subtitle-search-fields/spec.md` 的功能规格，以及 `src/server/subtitles/subtitle-gateway.ts`、`src/server/providers/opensubtitles-adapter.ts`、`src/app/api/subtitles/search/route.ts`、`docs/api/openapi.yaml`、`src/server/storage/schema.ts`、`tests/contract/subtitles.contract.test.ts`、`.specify/memory/constitution.md`

**说明**: 本计划只扩展字幕搜索接口的检索字段与上游参数映射，不新增前端页面、不新增数据库实体、不做 provider 抽象重构。`001-mvp-admin-console` 继续定义后台页面与统一字幕 API 的整体边界；`003-subtitle-search-fields` 只负责把"已刮削元数据 → 自动找字幕"的命中率拉起来。

## 摘要

本 feature 为 `/api/subtitles/search` 补充结构化 ID 定位能力，使持有 IMDb / TMDb 元数据的媒体库自动化调用方不再依赖 free-text query 模糊匹配。实现重点是：在 route 层扩展 Zod schema、在 gateway 层引入"按定位路径分流"的请求模型、在 adapter 层把 SubHub 稳定字段映射为 OpenSubtitles 上游参数，同时保持老调用方零改动。

技术策略上，SubHub 定义自己的 `SubtitleSearchInput` 稳定字段模型作为对外长期契约，不直接 1:1 透传上游 query params。当调用方传入 `imdb_id` 或 `tmdb_id` 时，gateway 优先走 ID 定位路径；当只传 `query`（即现有 `title`）时，走原有 free-text fallback 路径。新增字段全部可选，响应结构 `SubtitleSearchResponse` 不变。

### 字段改名决策（收敛 spec [NEEDS CLARIFICATION]）

spec 中 `season_number` / `episode_number` / `languages` 的命名问题，本 plan 决策为：**保持现有命名 `season` / `episode` / `language` 不变**。理由：

1. 宪章原则 IV 要求保持 API 一致性且避免 breaking
2. 改名对齐上游的收益不足以抵消 breaking 风险
3. 网关层已有命名映射职责（`season` → 上游 `season_number`），不影响实现

因此 Tier 1 实际落地字段为：`title`（保持）、`year`（保持）、`season`（保持）、`episode`（保持）、`language`（保持）、`imdb_id`（新增）、`tmdb_id`（新增）、`type`（新增）。

## 设计上下文

**全局设计系统**: `DESIGN.md`（本功能不触达）

**相关页面规范**: 无（纯后端接口扩展）

**已评审的设计输入**:
- `specs/003-subtitle-search-fields/spec.md`：本功能规格
- `src/server/subtitles/subtitle-gateway.ts`：当前网关实现，`buildSearchQuery` 把所有字段坍缩成 free-text
- `src/server/providers/opensubtitles-adapter.ts`：当前适配器，`OpenSubtitlesSearchInput` 仅接受 `query` + `language`
- `src/app/api/subtitles/search/route.ts`：当前 route Zod schema
- `docs/api/openapi.yaml`：当前 `/api/subtitles/search` 契约真源
- `src/server/storage/schema.ts`：`subtitleSearchRequests` 审计表结构

## 技术上下文

**语言/版本**: TypeScript；`next@16.2.6`、`react@19.2.6`、`typescript@6.0.3`、`zod`、`drizzle-orm`

**核心依赖**: Next.js Route Handler、Zod、OpenSubtitles REST API、Orval + Scalar（API 契约链路）

**存储**: 不新增数据库实体；`subtitleSearchRequests` 审计表保持现有字段，不扩展（见 §Risk & Compatibility）

**测试**: `vitest`；分层为 `mock/no-db`（纯逻辑单测）、`PGlite`（contract 测试）、`real Postgres`（CI 集成测试，如需）

**目标平台**: Vercel + Neon Postgres（生产）/ 本地开发

**项目类型**: web-service（Next.js API）

**性能目标**: ID 定位路径 p95 延迟不高于现有 query fallback 路径；ID 定位应减少上游模糊匹配开销，不引入额外往返

**约束条件**: 不引入 breaking API 变更；不直接透传上游所有 query params；`filename` 仅为辅助字段（本次不落地）

**规模/范围**: 单接口扩展，涉及 route / gateway / adapter / OpenAPI / generated / tests 六层同步

## 宪章检查

*门禁：必须在第 0 阶段研究前通过，并在第 1 阶段设计后复检。*

- ✅ 已定义代码质量门禁：`pnpm lint` + `pnpm typecheck` + `pnpm format:write`，CI 强制执行
- ✅ 已定义必需测试策略：unit（校验逻辑）+ contract（API 行为）+ integration（ID 定位路径与 fallback 路径）
- ✅ 已定义对外行为的 UX/API 一致性约束：统一错误结构 `ErrorResponse`，新增 400 校验错误复用现有 schema
- ✅ 已定义可度量性能预算：ID 定位路径 p95 ≤ 现有 fallback 路径
- ✅ 已记录面向长期可维护性的简洁化方案：SubHub 稳定字段模型 + 网关层命名映射，不透传上游 params
- ✅ 已识别设计来源：本功能不触达 `DESIGN.md` 与 `docs/pages/*.md`
- ✅ 计划已声明是否需要对 `DESIGN.md` 增补系统级规则：No
- ✅ 已明确 worktree 隔离：`003-subtitle-search-fields` 分支，单 active feature
- ✅ 已明确可追溯关系：feature id `003` → `specs/003-subtitle-search-fields/` → 分支 `003-subtitle-search-fields` → 主 issue TBD
- ✅ 已明确 issue 同步范围：仅面向 `specs/003-subtitle-search-fields/`，不跨 spec 混批

## 设计映射

### 适用规则

- **全局规则**: 无（本功能不触达视觉设计系统）
- **页面规则**: 无（本功能不触达页面规范）

### 计划中的文档变更

- **更新 `DESIGN.md`**: No（纯后端接口扩展）
- **更新既有页面规范**: None
- **新建页面规范**: None

## 项目结构

### 文档（本功能）

```text
specs/003-subtitle-search-fields/
├── plan.md              # 本文件
├── research.md          # 第 0 阶段产物
├── data-model.md        # 第 1 阶段产物
├── quickstart.md        # 第 1 阶段产物
├── contracts/           # 第 1 阶段产物
│   └── subtitle-search-request.md
└── checklists/
    └── requirements.md
```

### 源码（仓库根目录）

```text
src/
├── app/api/subtitles/search/route.ts          # Zod schema 扩展
├── server/subtitles/subtitle-gateway.ts       # SubtitleSearchInput + 定位路径分流
├── server/providers/opensubtitles-adapter.ts  # OpenSubtitlesSearchInput + 参数映射
└── lib/api/generated/                         # Orval 重新生成

docs/api/openapi.yaml                          # 契约真源

tests/
├── contract/subtitles.contract.test.ts        # API 契约测试
├── unit/                                      # 校验逻辑单测
└── integration/                               # ID 定位路径与 fallback 路径集成测试
```

**结构决策**: 单体 Next.js 项目，沿用现有 `src/app/api/` + `src/server/` 分层，不引入新目录。

## 设计保真实施策略

- 本功能不触达视觉设计系统，无需对照 `DESIGN.md` 或页面规范校验。
- 实现过程中代码校验聚焦于 API 契约一致性：route schema ↔ OpenAPI ↔ generated client ↔ gateway input ↔ adapter input。

## 复杂度追踪

| 例外项 | 必要原因 | 为何拒绝更简单方案 |
|-----------|------------|-------------------------------------|
| 网关层定位路径分流 | ID 定位与 query fallback 的上游参数构造完全不同，不能共用 `buildSearchQuery` | 直接拼进 free-text query 会丢失 ID 定位能力，回到现状 |
| `type` 与季集字段冲突校验 | `type=movie` + `season`/`episode` 语义矛盾，需在 route 层拦截 | 放任冲突向上游发送会导致错配或上游 400，错误信息不可控 |

---

## 1. Scope Summary

### 范围内

| 字段 | 来源 | 说明 |
|------|------|------|
| `title` | 现有 | 保持，作为 free-text 兜底（映射到上游 `query`） |
| `year` | 现有 | 保持，辅助区分同名作品 |
| `season` | 现有 | 保持命名，映射到上游 `season_number` |
| `episode` | 现有 | 保持命名，映射到上游 `episode_number` |
| `language` | 现有 | 保持命名，映射到上游 `languages` |
| `imdb_id` | 新增 | Tier 1；IMDb ID 定位，格式 `tt` + 数字 |
| `tmdb_id` | 新增 | Tier 1；TMDb ID 定位，正整数 |
| `type` | 新增 | Tier 1；`movie` / `episode` 枚举 |

### 范围外

| 字段 | 原因 |
|------|------|
| `filename` | Tier 2；辅助字段，价值有限，本次不落地 |
| `hearing_impaired` | Tier 2；偏好过滤，非定位字段，本次不落地 |
| `moviehash` | Tier 3；需调用方客户端预计算哈希，SubHub 不提供哈希计算能力 |
| `foreign_parts_only` | Tier 3；上游支持不稳定 |
| 字段改名（`season` → `season_number` 等） | breaking 风险，本次不做 |
| 数据库 schema 变更 | spec 明确不做新数据库 schema 设计 |
| 前端检索页面 | spec 明确不做 |
| provider 抽象重构 | spec 明确不做 |

### 分批理由

首批只落地"结构化 ID 定位 + 类型过滤"，因为这是媒体库自动化主调用路径的核心价值。`filename` / `hearing_impaired` 属于辅助与偏好过滤，优先级低于 ID 定位；`moviehash` / `foreign_parts_only` 涉及调用方负担或上游稳定性，暂不暴露。

## 2. Contract Changes

### 请求模型新增字段

```
GET /api/subtitles/search

现有字段（保持不变）:
  title    string   required   free-text 兜底
  year     integer  optional   1800-3000
  season   integer  optional   ≥0
  episode  integer  optional   ≥0
  language string   optional   语言码

新增字段:
  imdb_id  string   optional   格式 ^tt\d+$，IMDb ID 定位
  tmdb_id  integer  optional   ≥1，TMDb ID 定位
  type     enum     optional   movie | episode
```

### 可选性

- 所有新增字段（`imdb_id` / `tmdb_id` / `type`）MUST 可选
- `title` 保持 required（见 §Risk & Compatibility 中"ID-only 场景"处理）

### `type` 字段

- 新增 `type` 枚举：`movie` / `episode`
- `type=movie` + `season`/`episode` 同时出现时 → 400
- `type=episode` + 缺 `season`/`episode` 且无 ID 字段时 → 400（避免歧义）

### 向后兼容

- 老调用方不传新增字段时，行为与响应结构 100% 不变
- 响应结构 `SubtitleSearchResponse` 不变
- 新增字段全部可选，老版本 generated client 无需升级即可继续工作

### OpenAPI / generated client 同步

1. 更新 `docs/api/openapi.yaml` 中 `/api/subtitles/search` 的 `parameters` 区块，新增 `imdb_id` / `tmdb_id` / `type` 三个 query parameter
2. 运行 `pnpm api:client` 重新生成 `src/lib/api/generated/`
3. 运行 `pnpm api:check` 校验契约一致性
4. 运行 `pnpm api:docs` 更新 Scalar 文档展示

## 3. Backend Changes

### Route 层 (`src/app/api/subtitles/search/route.ts`)

- 扩展 `searchParamsSchema`：新增 `imdb_id`（`z.string().regex(/^tt\d+$/)`）、`tmdb_id`（`z.coerce.number().int().min(1)`）、`type`（`z.enum(["movie", "episode"])`）
- 新增跨字段校验：`type=movie` + `season`/`episode` → 抛出 `VALIDATION_FAILED`；`type=episode` + 缺 `season`/`episode` 且无 `imdb_id`/`tmdb_id` → 抛出 `VALIDATION_FAILED`
- 校验失败复用现有 `apiErrorFromUnknown` → `ErrorResponse` 路径

### Request Validation Schema

- Zod schema 为唯一校验入口
- `imdb_id` 格式校验：`/^tt\d+$/`
- `tmdb_id` 范围校验：`≥1`
- `type` 枚举校验：`movie` / `episode`
- 跨字段冲突校验在 schema 层用 `.refine()` 实现

### Service / Gateway 层 (`src/server/subtitles/subtitle-gateway.ts`)

- 扩展 `SubtitleSearchInput`：新增 `imdbId?` / `tmdbId?` / `type?`
- 重构 `buildSearchQuery` 为 `buildAdapterInput(input)`，按定位路径分流：
  - **ID 定位路径**：当 `imdbId` 或 `tmdbId` 存在时，构造 `OpenSubtitlesSearchInput` 时优先传 ID 参数，`query` 仅在 `title` 存在时作为辅助
  - **query fallback 路径**：当无 ID 字段时，走现有 `buildSearchQuery` 逻辑（拼 `title` + `year` + `SxxExx`）
- `type` 字段透传到 adapter input
- 审计记录 `record()` 调用保持现有字段，不扩展 schema（见 §Risk & Compatibility）

### OpenSubtitles Adapter 层 (`src/server/providers/opensubtitles-adapter.ts`)

- 扩展 `OpenSubtitlesSearchInput`：
  ```
  {
    query?: string;
    imdbId?: string;      // 映射到上游 imdb_id
    tmdbId?: number;      // 映射到上游 tmdb_id
    season?: number;      // 映射到上游 season_number
    episode?: number;     // 映射到上游 episode_number
    language?: string;    // 映射到上游 languages
    type?: "movie" | "episode";  // 映射到上游 type
  }
  ```
- `search` 实现修改 `URLSearchParams` 构造：
  - `imdbId` → `params.set("imdb_id", ...)`
  - `tmdbId` → `params.set("tmdb_id", String(...))`
  - `season` → `params.set("season_number", String(...))`
  - `episode` → `params.set("episode_number", String(...))`
  - `language` → `params.set("languages", ...)`
  - `type` → `params.set("type", ...)`
  - `query` → `params.set("query", ...)`（仅当存在时）
- **不直接 1:1 透传上游所有 query params**：SubHub `SubtitleSearchInput` 是稳定字段模型，adapter 层负责命名映射与字段筛选

### 兼容 Fallback 逻辑

- 当 `input` 无 ID 字段时，`buildAdapterInput` 走原有 `buildSearchQuery` 逻辑，构造 `query` 字符串
- 当 `input` 有 ID 字段时，`query` 仅在 `title` 存在时作为辅助；ID 参数优先
- `imdbId` 与 `tmdbId` 同时存在时：优先 `imdbId`，`tmdbId` 作为辅助（plan 阶段决策，理由：IMDb 覆盖度更广且格式校验更严格）

### 不做的事

- 不直接把上游 OpenSubtitles 所有 query params 原样透传
- 不依赖本地目录结构做服务端推断
- `filename` 仅为辅助条件，本次不落地
- 不做 provider 抽象重构

## 4. Testing Plan

### Request Validation 测试（unit）

- `imdb_id` 格式合法（`tt1234567`）→ 通过
- `imdb_id` 格式非法（`1234567`、`ttabc`）→ `VALIDATION_FAILED`
- `tmdb_id` 合法（`1`、`12345`）→ 通过
- `tmdb_id` 非法（`0`、`-1`）→ `VALIDATION_FAILED`
- `type=movie` + `season=1` → `VALIDATION_FAILED`
- `type=episode` + 无 `season`/`episode` + 无 ID → `VALIDATION_FAILED`
- `type=movie` + 无 `season`/`episode` → 通过
- `type=episode` + `season=1` + `episode=1` → 通过
- 老调用方仅传 `title` → 通过

### Provider 参数映射测试（unit）

- `buildAdapterInput` 在有 `imdbId` 时构造的 `OpenSubtitlesSearchInput` 包含 `imdbId`，`query` 仅在 `title` 存在时存在
- `buildAdapterInput` 在无 ID 字段时走 `buildSearchQuery` 逻辑，构造 `query` 字符串
- `OpenSubtitlesAdapter.search` 把 `imdbId` 映射到 `imdb_id` query param
- `OpenSubtitlesAdapter.search` 把 `tmdbId` 映射到 `tmdb_id` query param
- `OpenSubtitlesAdapter.search` 把 `season` 映射到 `season_number` query param
- `OpenSubtitlesAdapter.search` 把 `type` 映射到 `type` query param
- `imdbId` 与 `tmdbId` 同时存在时，`imdbId` 优先

### API Contract 测试（contract，PGlite 层）

- 传入 `title` + `imdb_id=tt1234567` → 200，响应结构符合 `SubtitleSearchResponse`
- 传入 `imdb_id=tt1234567` 而不传 `title` → 见 §Risk & Compatibility 中"ID-only 场景"决策
- 传入 `title` + `tmdb_id=123` + `season=1` + `episode=1` → 200
- 传入 `type=movie` + `season=1` → 400 `VALIDATION_FAILED`
- 传入 `imdb_id=invalid` → 400 `VALIDATION_FAILED`
- 老调用方仅传 `title` → 200，行为与现状一致
- 老调用方传 `title` + `year` + `season` + `episode` + `language` → 200，走 fallback 路径

### Backward Compatibility 测试（contract + integration）

- 老调用方零改动场景：仅传 `title` → 响应结构与现状一致
- 老调用方传完整现有字段 → 走 query fallback 路径，不因新增字段存在而改变行为
- 新增字段全部可选：不传任何新增字段时，请求与响应与扩展前 100% 一致

### OpenAPI / Generated Client 校验

- `pnpm api:check` 通过
- `pnpm api:client` 重新生成后，generated client 类型包含新字段
- `tests/contract/openapi-generated-client.test.ts` 通过（如存在）

## 5. Risk & Compatibility

### 新字段是否会影响旧调用方

- **不会**。所有新增字段可选；老调用方不传时行为与响应结构 100% 不变。
- OpenAPI 扩展是纯增量，老版本 generated client 无需升级即可继续工作。

### query-only 场景如何保持兼容

- 当请求不含任何 ID 字段时，`buildAdapterInput` 走原有 `buildSearchQuery` 逻辑，构造 `query` 字符串传给上游。
- 上游收到的 `query` 参数与现状一致，响应行为不变。

### ID 字段与 query 同时存在时优先级

- `imdbId` 或 `tmdbId` 存在时，ID 参数优先；`query`（来自 `title`）仅在 `title` 存在时作为辅助传给上游。
- `imdbId` 与 `tmdbId` 同时存在时，`imdbId` 优先，`tmdbId` 作为辅助。
- 上游若同时收到 ID 与 query，由上游决定匹配行为；SubHub 不做结果过滤。

### `filename` / `moviehash` 的使用边界

- 本次不落地 `filename` 与 `moviehash`。
- `filename` 规划为 Tier 2 辅助字段，文档已标注价值有限，不应被当作主路径。
- `moviehash` 规划为 Tier 3，需调用方客户端预计算哈希，SubHub 不提供哈希计算能力。

### 上游 provider 不支持某些字段时如何降级

- **策略**：adapter 层始终把 SubHub 字段映射到上游参数并透传；若上游返回 400 或忽略未知参数，由现有 `UPSTREAM_FAILED` / `NO_RESULTS` 错误路径处理。
- **不做的**：不在 adapter 层做上游能力探测或字段裁剪（避免增加复杂度与上游耦合）。
- **风险**：若上游对 `type` 参数支持不稳定，可能导致 `type=episode` 请求返回非剧集结果。mitigation：contract 测试覆盖 `type` 字段的上游响应行为；若上游不支持，在后续 feature 中评估是否在 adapter 层做结果过滤。

### ID-only 场景（`imdb_id` 而不传 `title`）

- **决策**：保持 `title` 为 required 字段，不改为 optional。
- **理由**：spec 用户故事 1 描述"传入 `imdb_id` 而不传 `query`"，但 `title` 在现有契约中是 required 且用于审计记录 `mediaTitle`。将 `title` 改为 optional 涉及审计表 `mediaTitle NOT NULL` 约束与 breaking 风险。
- **处理方式**：调用方传入 `imdb_id` 时仍需传 `title`（可作为作品名用于审计），但后端优先以 `imdb_id` 定位，`title` 不参与上游 query 构造（当 ID 存在时）。
- **spec 偏差说明**：spec 验收标准 1 描述"不传 `query` 不报错"，本 plan 保持 `title` required，但 `title` 不再映射到上游 `query`（当 ID 存在时）。这是 plan 阶段对 spec 的细化，需在 tasks 阶段确认。

### 审计日志扩展

- `subtitleSearchRequests` 表保持现有字段，不扩展 `imdbId` / `tmdbId` / `type` 列。
- **理由**：spec 明确不做新数据库 schema 设计；审计扩展属于 NFR-3 的 SHOULD 而非 MUST。
- **风险**：无法按 ID 定位路径维度做运营分析。mitigation：后续 feature 评估审计表扩展需求。

## 6. Deliverables

### 需要修改的文件/模块

| 层 | 文件 | 变更内容 |
|----|------|----------|
| Route | `src/app/api/subtitles/search/route.ts` | Zod schema 新增 `imdb_id` / `tmdb_id` / `type` + 跨字段冲突校验 |
| Gateway | `src/server/subtitles/subtitle-gateway.ts` | `SubtitleSearchInput` 扩展 + `buildSearchQuery` 重构为 `buildAdapterInput` 按定位路径分流 |
| Adapter | `src/server/providers/opensubtitles-adapter.ts` | `OpenSubtitlesSearchInput` 扩展 + `search` 参数映射 |
| OpenAPI | `docs/api/openapi.yaml` | `/api/subtitles/search` 新增 3 个 query parameter |
| Generated | `src/lib/api/generated/` | `pnpm api:client` 重新生成 |

### 需要更新的测试

| 测试类型 | 文件 | 覆盖内容 |
|----------|------|----------|
| Unit | `tests/unit/`（新增 subtitle-search-validation.test.ts） | request validation + `buildAdapterInput` 分流逻辑 |
| Unit | `tests/unit/`（新增 opensubtitles-adapter-params.test.ts） | adapter 参数映射 |
| Contract | `tests/contract/subtitles.contract.test.ts` | 新字段 API 行为 + 跨字段冲突 + backward compatibility |
| Integration | `tests/integration/`（新增或扩展） | ID 定位路径与 fallback 路径端到端 |
| Contract | `tests/contract/openapi-generated-client.test.ts` | generated client 类型包含新字段 |

### 需要更新的文档

| 文档 | 变更内容 |
|------|----------|
| `docs/api/openapi.yaml` | `/api/subtitles/search` 请求参数扩展 |
| `specs/003-subtitle-search-fields/plan.md` | 本文件 |
| `specs/003-subtitle-search-fields/research.md` | 第 0 阶段研究产物 |
| `specs/003-subtitle-search-fields/data-model.md` | 第 1 阶段数据模型 |
| `specs/003-subtitle-search-fields/contracts/subtitle-search-request.md` | 第 1 阶段契约 |
| `specs/003-subtitle-search-fields/quickstart.md` | 第 1 阶段快速上手 |

### 不需要更新的文档

- `DESIGN.md`（本功能不触达视觉设计系统）
- `docs/pages/*.md`（本功能不触达页面规范）
- `docs/runtime/environment-mapping.md`（本功能不触达运行时环境映射）
- `docs/releases/versioning.md`（本功能不改变版本约定）
