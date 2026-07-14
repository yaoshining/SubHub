---
description: "多字幕 provider 搜索入口模型基础版（含迅雷字幕 provider 接入） 任务清单"
---

# 任务清单: 多字幕 provider 搜索入口模型基础版（含迅雷字幕 provider 接入）

**输入**: 来自 `/specs/004-multi-provider-search/` 的设计文档

**前置条件**: `plan.md`（required）、`spec.md`（用户故事 required）、`research.md`、`data-model.md`、`contracts/`、`quickstart.md`

**可追溯前置条件**: feature id `004` → `specs/004-multi-provider-search/` → 分支 `004-multi-provider-search` → milestone `v0.2.2`（TBD 主 issue）

**Issue 同步**: spec review 通过后再进入 `/speckit.taskstoissues`；task issues 延后到 tasks 阶段统一创建。Task ID → Issue 编号映射见文末 §Issue 映射表。

**测试**: 测试默认 REQUIRED，覆盖 unit + contract + integration 场景。

**组织方式**: 任务按用户故事与实现层分组；本功能以聚合搜索架构演进为主线，配合 OpenSubtitles / 迅雷 provider 双 provider 实现。

## 格式: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无依赖）
- **[Story]**: 任务所属用户故事（US1 ~ US5）
- 描述中必须包含精确文件路径

## 路径约定

- **单体 Next.js 项目**: 仓库根目录使用 `src/`、`tests/`
- **API 契约真源**: `docs/api/openapi.yaml`
- **Generated client**: `src/lib/api/generated/`
- **设计文档**: `DESIGN.md`（本功能不触达）、`docs/pages/*.md`（本功能不触达）
- **数据库 schema**: `src/server/storage/schema.ts`（**本次 `v0.2.2` 不做任何 schema 变更**：不扩展 enum、不新增 migration、不变更表结构；详见 `plan.md` §9.1 / `spec.md`「提供商元数据接入方式」）

---

## Execution Order

**前置阅读**: `plan.md` → `spec.md` → `data-model.md` → `contracts/*` → `research.md` → `quickstart.md`

### 必须先做（顺序执行）

1. **阶段 1（Setup）**: 仓库级初始化与 lint / format 门禁基线
2. **阶段 2（Foundational）**: 确认 `v0.2.2` 不依赖 schema 变更 + 聚合请求模型 + provider 适配层接口 + provider-registry + OpenAPI 请求 schema 同步
3. 阶段 2 完成 → 才能开始任何用户故事实现

### 可并行推进

阶段 2 完成且 `SubtitleProviderAdapter` 接口 / `provider-registry` 注册表就绪后，以下三个用户故事可 **并行** 推进：

- **US1**（OpenSubtitles 结构化检索，Priority P1）
- **US2**（迅雷 provider 名称检索，Priority P1）
- **US4**（单 provider 失败隔离，Priority P1）

**US3**（provider 来源区分）与 **US5**（老调用方零改动）依赖 US1 + US2 的结果产出，但因 US1/US2 各自已包含 provider 来源字段注入，老调用方兼容回归由独立的 contract test 串行覆盖；可与 US3 / US4 测试任务并行。

### 串行收口（最后阶段）

**阶段 N（Polish & Cross-Cutting）**: 全量集成测试 + 老调用方兼容性回归门禁 + OpenAPI / generated 校验 + 文档同步 + CI 门禁验证。所有用户故事完成后才能开始。

### 不引入的并行工作

- `v0.2.3` / `v0.3.0` / `v0.4.0` 范围的工作不在本任务清单内
- 并行 provider 调用 / 熔断 / 评分编排放入 post-mvp（独立 spec）
- 字段改名（`season` → `season_number` 等）放入 post-mvp

---

## 阶段 1: 初始化（共享基础设施）

**目的**: 仓库级初始化与基础结构搭建，确保所有后续任务在统一基线下推进

- [ ] T001 评审 `plan.md`、`data-model.md`、`contracts/provider-adapter-contract.md`，确认本次实现的 provider 抽象边界
- [ ] T002 评审 `docs/releases/versioning.md` 中 `v0.2.2` 范围定义，确认与本次任务清单一致
- [ ] T003 评审 `.github/copilot-instructions.md` 仓库级约定（`pnpm`、数据库测试分层、API 契约链路、运行时环境映射）
- [ ] T004 [P] 验证 `pnpm lint`、`pnpm typecheck`、`pnpm format:write` 基线通过
- [ ] T005 [P] 验证 `pnpm test` 与 `pnpm api:check` 基线通过

---

## 阶段 2: 基础能力（阻塞性前置）

**目的**: 在开始任何用户故事实现前 MUST 完成的核心基础设施

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事开发

### 数据层前置（`v0.2.2` **不**做任何 schema 变更）

> ⚠️ **范围声明**：本次 `v0.2.2` 不扩展 `providerTypes` enum、不新增 migration、不修改 `providers` / `provider_credentials` / `subtitle_search_requests` 表结构。迅雷 provider 走「不依赖数据库 schema 的最小接入路径」（provider key → adapter 映射由 `provider-registry.ts` 代码层硬编码）。`scripts/db/seed-dev.ts` / `scripts/db/seed-staging.ts` 不追加迅雷 provider 种子记录。

- [ ] T006 [P] 验证 `src/server/storage/schema.ts` 中 `providerTypes` enum 仍为 `["opensubtitles"]` 单值；本次 `v0.2.2` **不**扩展
- [ ] T007 [P] 验证本次 `v0.2.2` **不**新增 migration；仓库 `drizzle/` 目录本次 PR 不出现新文件（除 generated client 等无关产物）

### 聚合请求模型前置

- [ ] T010 在 `src/server/subtitles/subtitle-gateway.ts` 引入稳定的 `SubtitleSearchInput` 聚合请求类型，承载 `v0.2.2` 提议字段集合；保持 `v0.2.1` 字段命名不变
- [ ] T011 [P] 在 `src/server/subtitles/subtitle-gateway.ts` 中保留现有 `buildSearchQuery` / `buildAdapterInput` 行为，确保 `v0.2.1` 字段消费路径 100% 等价
- [ ] T012 [P] 在 `src/server/subtitles/subtitle-gateway.ts` 引入 provider key 类型 `SubtitleProviderKey = "opensubtitles" | "xunlei"` 与 provider 选择函数（按"已启用 + 必要字段齐全"过滤）

### provider 适配层前置

- [ ] T013 创建 `src/server/providers/provider-adapter.ts`，定义 `SubtitleProviderAdapter` 接口、`ProviderSearchResult`、`ProviderSearchOutcome`、`SkippedReason`、`ProviderSearchError` 类型
- [ ] T014 创建 `src/server/providers/provider-registry.ts`，实现 provider key → adapter 映射；提供 `getAdapter(key)` 与 `listProviderKeys()` 函数
- [ ] T015 [P] 在 `src/server/providers/provider-registry.ts` 中注册首批 `OpenSubtitlesAdapter` 与占位 `XunleiAdapter`（`XunleiAdapter` 在 US2 阶段实现具体逻辑）

### OpenAPI 前置

- [ ] T016 在 `docs/api/openapi.yaml` 中扩展 `/api/subtitles/search` 的 parameters，透传 `query` 可选字段
- [ ] T017 [P] 在 `docs/api/openapi.yaml` 中更新 `/api/subtitles/search` operation description，明确"字段可传 != 所有 provider 都消费"的契约表述

**检查点**: 已确认 `v0.2.2` 不依赖 schema 变更（`providerTypes` enum 不扩展、无新 migration）、聚合请求模型已收口、provider 适配层接口已定义、OpenAPI 请求 schema 已同步。所有用户故事实现可启动。

---

## 阶段 3: 用户故事 1 - 媒体库按 IMDb ID 走 OpenSubtitles 结构化检索 (Priority: P1) 🎯 MVP

**目标**: 保证 `v0.2.1` 已收口的 OpenSubtitles 结构化检索能力在多 provider 抽象下行为 100% 不变

**独立测试**: 传入 `imdb_id` 与 `languages` 调用聚合搜索接口，验证至少 OpenSubtitles provider 走 ID 定位路径，并返回与该 IMDb 作品匹配的字幕列表

### 用户故事 1 的测试 (REQUIRED) ⚠️

> **NOTE: 先写测试，并在实现前确认测试失败**

- [ ] T018 [P] [US1] 在 `tests/contract/subtitles.contract.test.ts` 中新增「OpenSubtitles ID 定位路径回归」contract test，固定 `v0.2.1` 行为
- [ ] T019 [P] [US1] 在 `tests/unit/subtitle-gateway.test.ts` 中新增「provider 选择 - OpenSubtitles 必要条件齐全」单元测试

### 用户故事 1 的实现

- [ ] T020 [P] [US1] 在 `src/server/providers/opensubtitles-adapter.ts` 中实现 `SubtitleProviderAdapter` 接口（`key = "opensubtitles"`、`search(credential, input, options)`），适配多 provider gateway 期望的接口形态
- [ ] T021 [US1] 在 `src/server/subtitles/subtitle-gateway.ts` 中实现 OpenSubtitles provider 调度分支：调用 `selectProviderCredential` + `OpenSubtitlesAdapter.search` + 凭据池副作用（`markCredentialUsed` / `markCredentialFailure` / `syncProviderFailureState`）
- [ ] T022 [US1] 在 `src/server/subtitles/subtitle-gateway.ts` 中保证 `v0.2.1` 风格的请求行为 100% 不变（沿用 `buildSearchQuery` / `buildAdapterInput` 逻辑）
- [ ] T023 [US1] 在 `src/server/subtitles/subtitle-gateway.ts` 中实现结果归一化的 OpenSubtitles 分支：id 格式 `opensubtitles:{providerId}:{file_id}`、`format` 来自扩展名或 `srt` 默认、`raw` 保留 `download_count` 等

**检查点**: 用户故事 1 可独立运行与测试；OpenSubtitles 结构化检索行为 100% 等价于 `v0.2.1`

---

## 阶段 4: 用户故事 2 - 用中文 / 自由文本标题走迅雷 provider 名称检索 (Priority: P1) 🎯 MVP

**目标**: 完成迅雷字幕 provider 基础接入，作为名称检索型 provider 的首个落地样本

**独立测试**: 传入 `query`（中文剧名）与 `languages` 调用聚合搜索接口，验证迅雷 provider 至少能基于 `query -> name` 与 `languages` 返回结果，并标注 provider 来源

### 用户故事 2 的测试 (REQUIRED) ⚠️

- [ ] T024 [P] [US2] 在 `tests/contract/xunlei-adapter.contract.test.ts` 中新增「XunleiAdapter 字段映射」contract test，验证 `query → name`、`language → languages` 映射
- [ ] T025 [P] [US2] 在 `tests/contract/xunlei-adapter.contract.test.ts` 中新增「XunleiAdapter 不支持字段忽略」contract test，验证 `imdb_id` / `tmdb_id` / `season` / `episode` / `type` / `year` 不传上游
- [ ] T026 [P] [US2] 在 `tests/contract/xunlei-adapter.contract.test.ts` 中新增「XunleiAdapter 必要条件缺失」contract test，验证 `query` 空 / `language` 空时返回 `skipped: true, reason: 'missing_required_field'`
- [ ] T027 [P] [US2] 在 `tests/contract/xunlei-adapter.contract.test.ts` 中新增「XunleiAdapter 错误处理」contract test，覆盖上游 5xx / 401 / 429 / 超时 / 解析失败

### 用户故事 2 的实现

- [ ] T028 [US2] 在 `src/server/providers/xunlei-adapter.ts` 中实现 `XunleiAdapter` 类，实现 `SubtitleProviderAdapter` 接口（`key = "xunlei"`）
- [ ] T029 [US2] 在 `src/server/providers/xunlei-adapter.ts` 中实现字段映射：`input.query`（trim 后非空）→ 上游 `name`、`input.language`（trim 后非空）→ 上游 `languages`；其他字段静默忽略
- [ ] T030 [US2] 在 `src/server/providers/xunlei-adapter.ts` 中实现必要条件缺失处理：`query` 或 `languages` 经 trim 后为空时返回 `{ ok: true, skipped: true, reason: 'missing_required_field', results: [] }`
- [ ] T031 [US2] 在 `src/server/providers/xunlei-adapter.ts` 中实现上游 HTTP 调用：使用 `fetch` + `AbortController` 实现 5000ms 超时；分类错误为 `upstream_failed` / `authentication_failed` / `rate_limited` / `timeout`
- [ ] T032 [US2] 在 `src/server/providers/xunlei-adapter.ts` 中实现响应解析：将迅雷原始响应解析为 `ProviderSearchResult` 形态；`id` 优先用 `gcid` 缺失时回退 `cid`、`format` 来自 `ext`（默认 `srt`）、`language` 取 `languages` 数组第一个、`score` 透传、`raw` 保留全量原始字段
- [ ] T033 [US2] 在 `src/server/subtitles/subtitle-gateway.ts` 中实现迅雷 provider 调度分支：调用 `XunleiAdapter.search`（`credential: null`）、不操作凭据池
- [ ] T034 [US2] 在 `src/server/subtitles/subtitle-gateway.ts` 中实现结果归一化的迅雷分支：id 格式 `xunlei:{providerId}:{gcid|cid}`、`format` 来自 `ext`、`raw` 保留迅雷原始字段

**检查点**: 用户故事 2 可独立运行与测试；迅雷 provider 名称检索路径可用；必要条件缺失静默跳过；provider 来源字段正确标注为 `xunlei`

---

## 阶段 5: 用户故事 3 - 多 provider 结果来源可区分 (Priority: P1) 🎯 MVP

**目标**: 保证多 provider 聚合的"来源透明"，每个返回结果 MUST 标注 provider 来源

**独立测试**: 同时启用 OpenSubtitles 与迅雷 provider，传入同一请求，验证返回结果的 `provider` 字段能正确标注来源

### 用户故事 3 的测试 (REQUIRED) ⚠️

- [ ] T035 [P] [US3] 在 `tests/unit/subtitle-result-normalizer.test.ts` 中新增「归一化 - provider 字段注入」单元测试，验证 OpenSubtitles / 迅雷结果都被显式注入 `provider` 字段
- [ ] T036 [P] [US3] 在 `tests/unit/subtitle-result-normalizer.test.ts` 中新增「归一化 - id 格式生成」单元测试，验证 `opensubtitles:{providerId}:{file_id}` 与 `xunlei:{providerId}:{gcid|cid}` 格式正确
- [ ] T037 [P] [US3] 在 `tests/unit/subtitle-result-normalizer.test.ts` 中新增「归一化 - raw 字段保留」单元测试，验证 OpenSubtitles / 迅雷原始字段全量保留
- [ ] T038 [P] [US3] 在 `tests/unit/subtitle-result-normalizer.test.ts` 中新增「归一化 - 老调用方兼容」单元测试，验证 `id` / `language` / `releaseName` / `format` / `downloadUrl` 字段集 100% 不变

### 用户故事 3 的实现

- [ ] T039 [US3] 创建 `src/server/subtitles/subtitle-result-normalizer.ts`，定义 `AggregatedSubtitleResult` / `ProviderFailureInfo` / `SubtitleSearchData` / `SubtitleSearchDataStatus` 类型
- [ ] T040 [US3] 在 `src/server/subtitles/subtitle-result-normalizer.ts` 中实现 `normalize(providerKey, providerResult, providerId)` 函数：注入 `provider` 字段、生成完整 `id`、组装 `downloadUrl`（`/api/subtitles/download?subtitleId={id}`）、保留 `raw` 字段
- [ ] T041 [US3] 在 `src/server/subtitles/subtitle-result-normalizer.ts` 中实现 `mapFailure(providerKey, error)` 函数：把 adapter 内部 `error.reason` 映射为对外 `ProviderFailureInfo.reason`
- [ ] T042 [US3] 在 `src/server/subtitles/subtitle-gateway.ts` 中引入 `AggregatedSubtitleResult` 作为对外响应模型；老调用方消费路径 100% 等价

**检查点**: 用户故事 3 可独立运行与测试；多 provider 结果来源可区分；老调用方消费路径向后兼容

---

## 阶段 6: 用户故事 4 - 单 provider 失败不拖垮整体搜索 (Priority: P1) 🎯 MVP

**目标**: 实现最小 provider 错误隔离，单 provider 失败时其他 provider 结果继续返回

**独立测试**: 模拟迅雷 provider 上游返回 5xx 或超时，验证聚合接口仍能返回 OpenSubtitles 的结果，且响应结构体现降级状态

### 用户故事 4 的测试 (REQUIRED) ⚠️

- [ ] T043 [P] [US4] 在 `tests/unit/subtitle-gateway.test.ts` 中新增「错误隔离 - OpenSubtitles 成功 + 迅雷失败」单元测试，验证 `status: partial`、`provider_failures[]` 含迅雷失败信息
- [ ] T044 [P] [US4] 在 `tests/unit/subtitle-gateway.test.ts` 中新增「错误隔离 - 迅雷成功 + OpenSubtitles 失败」单元测试
- [ ] T045 [P] [US4] 在 `tests/unit/subtitle-gateway.test.ts` 中新增「错误隔离 - 两个 provider 均失败」单元测试，验证返回明确错误且不静默返回空数组
- [ ] T046 [P] [US4] 在 `tests/unit/subtitle-gateway.test.ts` 中新增「错误隔离 - 单 provider 跳过（必要条件缺失）」单元测试，验证其他 provider 正常返回、`status: success`
- [ ] T047 [P] [US4] 在 `tests/unit/subtitle-gateway.test.ts` 中新增「错误隔离 - adapter 抛错兜底」单元测试，验证防御性兜底逻辑（adapter MUST NOT 抛错，但 gateway 仍兜底）

### 用户故事 4 的实现

- [ ] T048 [US4] 在 `src/server/subtitles/subtitle-gateway.ts` 中实现 provider 选择与串行调用循环（按 `provider-registry.listProviderKeys()` 顺序）
- [ ] T049 [US4] 在 `src/server/subtitles/subtitle-gateway.ts` 中实现 try/catch 包裹 adapter 调用：把 adapter 三种 outcome（success / error / skipped）映射到聚合逻辑
- [ ] T050 [US4] 在 `src/server/subtitles/subtitle-gateway.ts` 中实现 `provider_failures[]` 累加逻辑：把单 provider 失败信息记录到响应
- [ ] T051 [US4] 在 `src/server/subtitles/subtitle-gateway.ts` 中实现 `status` 计算逻辑：所有 provider 成功或全部跳过 → `success`；至少一个 provider 失败 → `partial`；全部 provider 失败 → 返回 502
- [ ] T052 [US4] 在 `src/server/subtitles/subtitle-gateway.ts` 中保留 OpenSubtitles 凭据池副作用隔离（不影响迅雷 provider 行为）

**检查点**: 用户故事 4 可独立运行与测试；单 provider 失败隔离正确；`status` 语义清晰；OpenSubtitles 凭据池行为不被污染

---

## 阶段 7: 用户故事 5 - 老调用方零改动继续工作 (Priority: P1) 🎯 MVP

**目标**: 保证 `v0.2.1` 风格调用方在多 provider 抽象下行为 100% 不变

**独立测试**: 用 `v0.2.1` 风格的请求调用聚合搜索接口，验证响应结构与 `v0.2.1` 一致

### 用户故事 5 的测试 (REQUIRED) ⚠️

- [ ] T053 [P] [US5] 在 `tests/contract/subtitles.contract.test.ts` 中新增「老调用方 - 仅 `title`」contract test，验证走 OpenSubtitles `buildSearchQuery` 路径
- [ ] T054 [P] [US5] 在 `tests/contract/subtitles.contract.test.ts` 中新增「老调用方 - `title + year + season + episode + language`」contract test，验证走原 fallback 路径
- [ ] T055 [P] [US5] 在 `tests/contract/subtitles.contract.test.ts` 中新增「老调用方 - `imdb_id` / `tmdb_id` 优先策略」contract test，验证 `v0.2.1` 行为不变
- [ ] T056 [P] [US5] 在 `tests/contract/subtitles.contract.test.ts` 中新增「老调用方 - 响应结构 100% 等价」contract test，验证 `provider` 仍为 `opensubtitles`、老字段集合不变

### 用户故事 5 的实现

- [ ] T057 [US5] 在 `src/app/api/subtitles/search/route.ts` 中保持 `v0.2.1` 的 Zod schema 必填 / 选填 / 冲突校验语义不变
- [ ] T058 [US5] 在 `src/app/api/subtitles/search/route.ts` 中透传 `query` 可选字段到 `SubtitleSearchInput`（不引入新必填字段）
- [ ] T059 [US5] 在 `src/server/subtitles/subtitle-gateway.ts` 中保证老调用方消费路径（`id` / `language` / `releaseName` / `format` / `downloadUrl`） 100% 等价

**检查点**: 用户故事 5 可独立运行与测试；老调用方零改动回归门禁通过；`v0.2.1` 行为 100% 保留

---

## 阶段 8: OpenAPI / generated client 同步

**目的**: 同步 API 契约链路，确保 OpenAPI / generated / route Zod schema / adapter input 一致

**⚠️ CRITICAL**: 本阶段完成前不得进入收尾阶段

- [ ] T060 在 `docs/api/openapi.yaml` 中扩展 `SubtitleSearchResult.provider` enum 为 `[opensubtitles, xunlei]`
- [ ] T061 [P] 在 `docs/api/openapi.yaml` 中新增 `SubtitleSearchResult.raw` 可选对象类型（`additionalProperties: true`）
- [ ] T062 [P] 在 `docs/api/openapi.yaml` 中新增 `SubtitleSearchResult.score` 可选 number（`nullable: true`）
- [ ] T063 [P] 在 `docs/api/openapi.yaml` 中更新 `SubtitleSearchResult.id` description，补充迅雷引用格式 `xunlei:{providerId}:{cid|gcid}`
- [ ] T064 [P] 在 `docs/api/openapi.yaml` 中更新 `SubtitleSearchResult.downloadUrl` description，明确"统一下载入口，由网关根据 subtitleId 前缀路由"
- [ ] T065 在 `docs/api/openapi.yaml` 中扩展 `SubtitleSearchData.status` enum 为 `[success, partial]`
- [ ] T066 在 `docs/api/openapi.yaml` 中新增 `SubtitleSearchData.provider_failures` 可选数组（`items: ProviderFailureInfo`）
- [ ] T067 在 `docs/api/openapi.yaml` 中新增 `ProviderFailureInfo` schema，承载 `provider` / `reason` / `message`
- [ ] T068 运行 `pnpm api:client` 重新生成 `src/lib/api/generated/`
- [ ] T069 运行 `pnpm api:check` 验证契约链路一致性
- [ ] T070 [P] 更新 `/docs/api`（Scalar）展示与 OpenAPI 同步

---

## 阶段 9: Integration 与运行时场景

**目的**: 端到端覆盖多 provider 并存路径与运行时场景

- [ ] T071 [P] 在 `tests/integration/multi-provider-isolation.test.ts` 中新增「多 provider 并存」integration test，验证 OpenSubtitles + 迅雷同时被调用、结果聚合
- [ ] T072 [P] 在 `tests/integration/multi-provider-isolation.test.ts` 中新增「单 provider 失败隔离」integration test，验证 502 不返回 + 部分失败 partial 状态
- [ ] T073 [P] 在 `tests/integration/multi-provider-isolation.test.ts` 中新增「provider 来源区分」integration test，验证 `provider` 字段在多 provider 场景下正确标注
- [ ] T074 [P] 在 `tests/runtime/` 中新增多 provider 运行时场景（如 `env-scenarios.ts` 扩展），覆盖 `mock / no-db` / `PGlite` / `real Postgres` 分层

---

## 阶段 N: 收尾与横切关注点

**目的**: 处理影响多个用户故事的改进项

- [ ] T075 在 `specs/004-multi-provider-search/contracts/` 中确认所有契约文件与最终实现一致（`subtitle-search-request.md` / `subtitle-search-response.md` / `provider-adapter-contract.md` / `xunlei-provider-quirks.md`）
- [ ] T076 在 `tests/contract/openapi-generated-client.test.ts` 中验证 generated client 与 OpenAPI 一致（`SubtitleSearchResult.provider` enum 含 `xunlei`、`AggregatedSubtitleResult` 类型对齐）
- [ ] T077 [P] 在 `tests/contract/subtitles.contract.test.ts` 中验证完整聚合 API 对外契约：`GET /api/subtitles/search` 请求 / 响应 schema、`provider_failures`、`status: partial` / `status: success` 区分、`ErrorResponse` 复用
- [ ] T078 [P] 运行 `pnpm test` 全量测试，覆盖 unit + contract + integration
- [ ] T079 [P] 运行 `pnpm lint` + `pnpm typecheck` + `pnpm format:write`
- [ ] T080 运行 `pnpm api:check` 验证契约链路（OpenAPI / generated 同步）
- [ ] T081 在 `quickstart.md` 7 个端到端验证场景基础上，手动验证至少场景 1（OpenSubtitles 回归）、场景 2（迅雷名称检索）、场景 6（老调用方零改动回归）
- [ ] T082 [P] 校验 `src/server/storage/schema.ts` / `drizzle/` migration 目录在本次 PR 中**未**改动；如仓库 CI 需运行 `pnpm db:check`，仅应验证现有 schema 健康，**不应**包含新增的 `providerTypes` enum 扩展
- [ ] T083 [P] 校验 `.github/copilot-instructions.md` 中 SPECKIT 引用仍指向 `specs/004-multi-provider-search/plan.md`
- [ ] T084 [P] 校验 `.specify/feature.json` 中 `feature_directory` 为 `specs/004-multi-provider-search`
- [ ] T085 [P] 校验 `docs/releases/versioning.md` 中 `v0.2.2` 范围定义与本次实现一致；如不一致，更新 versioning.md
- [ ] T086 代码清理与重构：移除调试代码、清理未使用导入、统一命名
- [ ] T087 [P] 安全检查：确保 provider_failures.message 不含堆栈；迅雷原始 url 仅在 `raw.url` 暴露，不在 `downloadUrl` 暴露
- [ ] T088 [P] 性能检查：在 contract test 中覆盖 `单 provider p95 ≤ v0.2.1 同路径` 与 `多 provider 串行 p95 ≤ 最慢者 + 1s` 断言（如适用）
- [ ] T089 对照 `plan.md` §11 Done When 清单逐项验证

---

## 依赖与执行顺序

### 阶段依赖

- **Setup（阶段 1）**: 无依赖，可立即开始
- **Foundational（阶段 2）**: 依赖 Setup 完成，会阻塞全部用户故事
- **OpenAPI / generated 同步（阶段 8）**: 依赖用户故事 1-5 的实现完成（响应模型已收口）
- **Integration 与运行时（阶段 9）**: 依赖用户故事 1-5 的实现完成
- **Polish（阶段 N）**: 依赖所有目标阶段完成

### 用户故事依赖

- **用户故事 1 (US1)**: Foundational（阶段 2）完成后可启动，不依赖其他故事；独立可测试
- **用户故事 2 (US2)**: Foundational（阶段 2）完成后可启动，不依赖其他故事；独立可测试
- **用户故事 3 (US3)**: 依赖 US1 + US2 的归一化结果产出；但 US1/US2 的归一化函数已先于 US3 任务编排就绪；US3 测试任务可与 US1/US2 测试任务并行启动
- **用户故事 4 (US4)**: 依赖 US1 + US2 的 adapter 已实现；US4 测试任务可与 US1/US2 实现任务并行启动
- **用户故事 5 (US5)**: 依赖 US1 + US2 + US3 的归一化结果；US5 实现任务必须等待 US3 完成后才能启动；US5 测试任务可与 US3 测试任务并行

### 每个用户故事内的顺序

- 测试 MUST 先写并在实现前失败
- 类型定义先于 adapter 实现
- adapter 单元测试先于 gateway 集成测试
- contract test 在 provider 实现完成后立即补充

### 可并行任务组

- T004 / T005（阶段 1 工具链基线验证）
- T011 / T012（阶段 2 gateway 内部并行）
- T014 / T015（阶段 2 provider-registry 注册与占位）
- T016 / T017（阶段 2 OpenAPI 请求 schema 与 description）
- T018 / T019（US1 测试）
- T020 / T021（US1 实现：adapter 接口适配 + gateway 调度）
- T024 / T025 / T026 / T027（US2 测试）
- T035 / T036 / T037 / T038（US3 测试）
- T043 / T044 / T045 / T046 / T047（US4 测试）
- T053 / T054 / T055 / T056（US5 测试）
- T061 / T062 / T063 / T064（阶段 8 OpenAPI schema 增量）
- T071 / T072 / T073（阶段 9 integration 测试）
- T075 / T076 / T077 / T078 / T079（阶段 N 收尾）
- T083 / T084 / T085（阶段 N 配置校验）
- T087 / T088（阶段 N 安全与性能）

---

## Issue 映射表

> 本节在 `/speckit.taskstoissues` 阶段填充。Task ID → GitHub Issue 编号映射。

| Task ID | 阶段 | Issue # | Title |
| ------- | ---- | ------- | ----- |
| TBD     | TBD  | TBD     | TBD   |

> 全部 task issues 同步至 milestone `v0.2.2`。若 `v0.2.2` milestone 尚未在 GitHub 仓库创建，需先创建并按 `.github/copilot-instructions.md` 仓库级 GitHub milestone 规则对齐。
