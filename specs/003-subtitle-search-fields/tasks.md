---
description: "字幕搜索接口扩展检索字段 任务清单"
---

# 任务清单: 字幕搜索接口扩展检索字段

**输入**: 来自 `/specs/003-subtitle-search-fields/` 的设计文档

**前置条件**: `plan.md`（required）、`spec.md`（用户故事 required）、`research.md`、`data-model.md`、`contracts/subtitle-search-request.md`

**可追溯前置条件**: feature id `003` → `specs/003-subtitle-search-fields/` → 分支 `003-subtitle-search-fields` → milestone `v0.2.0` (#5)

**Issue 同步**: 全部 37 个任务已同步至 GitHub issues，归并到 `v0.2.0` milestone。Task ID → Issue 编号映射见文末 §Issue 映射表。

**测试**: 测试默认 REQUIRED，覆盖 unit + contract + integration 场景。

**组织方式**: 任务按用户故事分组，以支持每个故事独立实现与独立测试。

## 格式: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无依赖）
- **[Story]**: 任务所属用户故事（如 US1、US2、US3）
- 描述中必须包含精确文件路径

## 路径约定

- 单体 Next.js 项目：`src/`、`tests/`
- API 契约真源：`docs/api/openapi.yaml`
- 生成代码：`src/lib/api/generated/`

---

## 阶段 1: 初始化（共享基础设施）

**目的**: 确认设计文档与实现范围，无需创建新项目结构

- [ ] T001 评审 `specs/003-subtitle-search-fields/plan.md`，确认字段改名决策（保持 `season`/`episode`/`language` 现有命名）与 ID-only 场景决策（`title` 保持 required）
- [ ] T002 评审 `specs/003-subtitle-search-fields/contracts/subtitle-search-request.md`，确认请求模型字段、可选性与跨字段校验规则
- [ ] T003 评审 `specs/003-subtitle-search-fields/data-model.md`，确认 `SubtitleSearchInput` 与 `OpenSubtitlesSearchInput` 字段映射关系

---

## 阶段 2: 基础能力（阻塞性前置）

**目的**: 在开始任何用户故事实现前 MUST 完成的契约与模型定义

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事开发

- [ ] T004 更新 `docs/api/openapi.yaml` 中 `/api/subtitles/search` 的 `parameters` 区块，新增 `imdb_id`（string, optional, pattern `^tt\d+$`）、`tmdb_id`（integer, optional, min 1）、`type`（enum movie|episode, optional）三个 query parameter；保持现有 `title`/`year`/`season`/`episode`/`language` 不变；响应结构 `SubtitleSearchResponse` 不变
- [ ] T005 在 `src/server/subtitles/subtitle-gateway.ts` 扩展 `SubtitleSearchInput` 类型，新增 `imdbId?: string`、`tmdbId?: number`、`type?: "movie" | "episode"` 三个可选字段；保持现有 `title`/`year`/`season`/`episode`/`language` 字段不变
- [ ] T006 在 `src/server/providers/opensubtitles-adapter.ts` 扩展 `OpenSubtitlesSearchInput` 类型，新增 `imdbId?: string`、`tmdbId?: number`、`season?: number`、`episode?: number`、`type?: "movie" | "episode"` 三个可选字段；保持现有 `query`/`language` 字段不变

**检查点**: 契约与模型定义就绪，可并行启动用户故事实现

---

## 阶段 3: 用户故事 1 - 媒体库自动化按 IMDb ID 找字幕 (Priority: P1) 🎯 MVP

**目标**: 调用方传入 `imdb_id` 时，后端优先走 ID 定位路径，不依赖 free-text query 模糊匹配

**独立测试**: 传入 `title` + `imdb_id=tt1375666` 调用 `/api/subtitles/search`，验证上游请求包含 `imdb_id` 参数，且 `query` 仅在 `title` 存在时作为辅助

### 用户故事 1 的测试 (REQUIRED) ⚠️

- [ ] T007 [P] [US1] 在 `tests/unit/subtitle-search-validation.test.ts` 编写 `imdb_id` 格式校验单测：合法 `tt1234567` 通过、非法 `1234567`/`ttabc` 返回 `VALIDATION_FAILED`
- [ ] T008 [P] [US1] 在 `tests/unit/subtitle-gateway.test.ts` 编写 `buildAdapterInput` 分流单测：有 `imdbId` 时走 ID 定位路径、无 ID 时走 query fallback 路径
- [ ] T009 [P] [US1] 在 `tests/unit/opensubtitles-adapter-params.test.ts` 编写 adapter 参数映射单测：`imdbId` 映射到上游 `imdb_id` query param
- [ ] T010 [P] [US1] 在 `tests/contract/subtitles.contract.test.ts` 编写契约测试：传入 `title` + `imdb_id=tt1234567` 返回 200 且响应结构符合 `SubtitleSearchResponse`

### 用户故事 1 的实现

- [ ] T011 [US1] 在 `src/app/api/subtitles/search/route.ts` 扩展 `searchParamsSchema`，新增 `imdb_id`（`z.string().regex(/^tt\d+$/)` optional）字段
- [ ] T012 [US1] 在 `src/server/subtitles/subtitle-gateway.ts` 重构 `buildSearchQuery` 为 `buildAdapterInput(input)`：当 `imdbId` 存在时构造 `OpenSubtitlesSearchInput` 传 `imdbId`，`query` 仅在 `title` 存在时作为辅助；无 ID 时走现有 `buildSearchQuery` 逻辑
- [ ] T013 [US1] 在 `src/server/providers/opensubtitles-adapter.ts` 修改 `search` 方法，把 `input.imdbId` 映射到 `params.set("imdb_id", ...)`
- [ ] T014 [US1] 在 `src/server/subtitles/subtitle-gateway.ts` 的 `searchSubtitles` 中调用 `buildAdapterInput` 替换原 `buildSearchQuery` 调用，并把 `type` 透传到 adapter input

**检查点**: 用户故事 1 可独立运行，传入 `imdb_id` 走 ID 定位路径

---

## 阶段 4: 用户故事 2 - 剧集按 TMDb ID + 季集定位 (Priority: P1)

**目标**: 调用方传入 `tmdb_id + season + episode` 时，精确定位单集字幕；`type=movie` + 季集字段冲突时返回 400

**独立测试**: 传入 `title` + `tmdb_id=1396` + `season=1` + `episode=1` 调用接口，验证上游请求包含 `tmdb_id`/`season_number`/`episode_number`；传入 `type=movie` + `season=1` 返回 400

### 用户故事 2 的测试 (REQUIRED) ⚠️

- [ ] T015 [P] [US2] 在 `tests/unit/subtitle-search-validation.test.ts` 编写 `tmdb_id` 校验单测：合法 `1`/`123` 通过、非法 `0`/`-1` 返回 `VALIDATION_FAILED`
- [ ] T016 [P] [US2] 在 `tests/unit/subtitle-search-validation.test.ts` 编写跨字段冲突单测：`type=movie` + `season`/`episode` 返回 `VALIDATION_FAILED`；`type=episode` + 缺 `season`/`episode` + 缺 ID 返回 `VALIDATION_FAILED`
- [ ] T017 [P] [US2] 在 `tests/unit/subtitle-gateway.test.ts` 编写 `buildAdapterInput` 分流单测：有 `tmdbId` 时走 ID 定位路径；`imdbId` 与 `tmdbId` 同时存在时 `imdbId` 优先
- [ ] T018 [P] [US2] 在 `tests/unit/opensubtitles-adapter-params.test.ts` 编写 adapter 参数映射单测：`tmdbId`→`tmdb_id`、`season`→`season_number`、`episode`→`episode_number`、`type`→`type`
- [ ] T019 [P] [US2] 在 `tests/contract/subtitles.contract.test.ts` 编写契约测试：传入 `title` + `tmdb_id=123` + `season=1` + `episode=1` 返回 200；传入 `type=movie` + `season=1` 返回 400 `VALIDATION_FAILED`

### 用户故事 2 的实现

- [ ] T020 [US2] 在 `src/app/api/subtitles/search/route.ts` 扩展 `searchParamsSchema`，新增 `tmdb_id`（`z.coerce.number().int().min(1)` optional）与 `type`（`z.enum(["movie", "episode"])` optional）字段，并添加 `.refine()` 跨字段冲突校验
- [ ] T021 [US2] 在 `src/server/subtitles/subtitle-gateway.ts` 的 `buildAdapterInput` 中处理 `tmdbId`：当 `tmdbId` 存在时传 `tmdbId`；`imdbId` 与 `tmdbId` 同时存在时 `imdbId` 优先，`tmdbId` 作为辅助
- [ ] T022 [US2] 在 `src/server/providers/opensubtitles-adapter.ts` 修改 `search` 方法，把 `input.tmdbId`→`tmdb_id`、`input.season`→`season_number`、`input.episode`→`episode_number`、`input.type`→`type` 映射到 `params.set(...)`

**检查点**: 用户故事 1 与用户故事 2 均可独立运行，ID 定位与跨字段冲突校验就绪

---

## 阶段 5: 用户故事 3 - 老调用方保持原有 fallback 行为 (Priority: P1)

**目标**: 老调用方不传新增字段时，接口行为与响应结构 100% 不变

**独立测试**: 仅传 `title` 调用接口，验证响应与扩展前一致；传 `title` + `year` + `season` + `episode` + `language` 走 query fallback 路径

### 用户故事 3 的测试 (REQUIRED) ⚠️

- [ ] T023 [P] [US3] 在 `tests/contract/subtitles.contract.test.ts` 编写 backward compatibility 契约测试：仅传 `title` 返回 200 且行为与现状一致；传完整现有字段走 query fallback 路径
- [ ] T024 [P] [US3] 在 `tests/unit/subtitle-gateway.test.ts` 编写 fallback 单测：无 ID 字段时 `buildAdapterInput` 走原有 `buildSearchQuery` 逻辑，构造的 `query` 字符串与现状一致

### 用户故事 3 的实现

- [ ] T025 [US3] 在 `src/server/subtitles/subtitle-gateway.ts` 确认 `buildAdapterInput` 的 query fallback 分支保持现有 `buildSearchQuery` 逻辑不变（拼 `title` + `year` + `SxxExx`），并验证 `searchSubtitles` 调用链对老输入无行为变化

**检查点**: 老调用方零改动场景验证通过，兼容性保证就绪

---

## 阶段 6: 用户故事 4 - 按文件名辅助搜索 (Priority: P2)

**目标**: 本次不落地 `filename`，仅在文档中记录其为 Tier 2 辅助字段且价值有限

**独立测试**: 无代码实现；验证文档中 `filename` 标注为 Tier 2 暂缓字段

### 用户故事 4 的实现

- [ ] T026 [US4] 在 `specs/003-subtitle-search-fields/plan.md` 与 `specs/003-subtitle-search-fields/spec.md` 中确认 `filename` 已标注为 Tier 2 辅助字段、价值有限、不应被当作主路径；无需代码改动

**检查点**: `filename` 范围外边界明确，不引入代码改动

---

## 阶段 7: 收尾与横切关注点

**目的**: 生成产物同步、文档更新与全量质量门禁

- [ ] T027 运行 `pnpm api:client` 重新生成 `src/lib/api/generated/`，确认 generated client 类型包含 `imdb_id`/`tmdb_id`/`type` 新字段
- [ ] T028 运行 `pnpm api:check` 校验 OpenAPI 契约一致性
- [ ] T029 [P] 运行 `pnpm api:docs` 更新 Scalar 文档展示
- [ ] T030 [P] 在 `tests/contract/openapi-generated-client.test.ts` 中校验 generated client 类型包含新字段（如该测试文件存在）
- [ ] T031 在 `tests/integration/` 新增或扩展字幕搜索集成测试，覆盖 ID 定位路径与 query fallback 路径端到端
- [ ] T032 运行 `pnpm format:write` 将受 Prettier 管理的文件收敛到仓库格式基线
- [ ] T033 运行 `pnpm lint` 与 `pnpm typecheck` 确认无错误
- [ ] T034 运行 `pnpm test` 确认全部 unit + contract + integration 测试通过
- [ ] T035 [P] 更新 `specs/003-subtitle-search-fields/quickstart.md`，确认首批支持字段（`imdb_id`/`tmdb_id`/`type`）与暂缓字段（`filename`/`hearing_impaired`/`moviehash`/`foreign_parts_only`）说明清晰
- [ ] T036 对照 `specs/003-subtitle-search-fields/plan.md` §Risk & Compatibility，确认 ID-only 场景（`title` 保持 required）与审计表不扩展的决策已在实现中落实
- [ ] T037 运行 `specs/003-subtitle-search-fields/quickstart.md` 中的验证步骤，确认 ID 定位、剧集单集定位、query fallback、跨字段冲突四个场景行为符合预期

---

## 依赖与执行顺序

### 阶段依赖

- **Setup（阶段 1）**: 无依赖，可立即开始
- **Foundational（阶段 2）**: 依赖 Setup 完成，会阻塞全部用户故事
- **User Stories（阶段 3-6）**: 均依赖 Foundational 完成
  - US1（阶段 3）与 US2（阶段 4）可并行推进（视团队容量）
  - US3（阶段 5）依赖 US1 + US2 完成（验证兼容性需基于完整新字段集）
  - US4（阶段 6）无代码依赖，可与 US3 并行
- **Polish（阶段 7）**: 依赖所有用户故事完成

### 用户故事依赖

- **US1 (P1)**: Foundational 完成后可启动，不依赖其他故事
- **US2 (P1)**: Foundational 完成后可启动，可与 US1 并行；`type` 字段冲突校验依赖 US2 自身的 route schema 扩展
- **US3 (P1)**: 依赖 US1 + US2 完成（验证兼容性需基于完整新字段集）
- **US4 (P2)**: 无代码依赖，仅文档确认

### 每个用户故事内的顺序

- 测试 MUST 先写并在实现前失败
- 契约/模型先于实现
- route schema 先于 gateway 分流
- gateway 分流先于 adapter 参数映射
- 当前优先级故事完成后再推进下一优先级

### 可并行机会

- 阶段 1 中 T001/T002/T003 可并行（评审不同文档）
- 阶段 2 中 T004/T005/T006 可并行（不同文件）
- US1 中 T007/T008/T009/T010 可并行（不同测试文件）
- US2 中 T015/T016/T017/T018/T019 可并行（不同测试文件）
- US3 中 T023/T024 可并行（不同测试文件）
- 阶段 7 中 T029/T030/T035 可并行（不同文件）

---

## 并行示例：用户故事 1

```bash
# 一次性并行启动用户故事 1 的全部测试：
Task T007: "在 tests/unit/subtitle-search-validation.test.ts 编写 imdb_id 格式校验单测"
Task T008: "在 tests/unit/subtitle-gateway.test.ts 编写 buildAdapterInput 分流单测"
Task T009: "在 tests/unit/opensubtitles-adapter-params.test.ts 编写 adapter 参数映射单测"
Task T010: "在 tests/contract/subtitles.contract.test.ts 编写 imdb_id 契约测试"
```

---

## 实施策略

### MVP 优先（用户故事 1 + 用户故事 2 + 用户故事 3）

1. 完成阶段 1：Setup（文档评审）
2. 完成阶段 2：Foundational（契约 + 模型定义）
3. 并行完成阶段 3 + 阶段 4：US1（IMDb ID 定位）+ US2（TMDb ID + 季集 + type 冲突校验）
4. 完成阶段 5：US3（兼容性验证）
5. **STOP and VALIDATE**：独立验证 US1 + US2 + US3
6. 完成阶段 7：Polish（生成产物 + 文档 + 质量门禁）

### 增量交付

1. 完成 Setup + Foundational → 契约与模型就绪
2. 交付 US1 + US2 → ID 定位能力可用
3. 交付 US3 → 兼容性验证通过
4. 交付 Polish → 生成产物与文档同步
5. US4 为文档确认项，不涉及代码改动

### 团队并行策略

多开发者协作时：

1. 团队共同完成 Setup + Foundational
2. Foundational 完成后：
  - 开发者 A：US1（IMDb ID 定位）
  - 开发者 B：US2（TMDb ID + 季集 + type 冲突校验）
3. US1 + US2 完成后，开发者 A：US3（兼容性验证）
4. Polish 阶段由团队共同完成

---

## 备注

- [P] 任务表示不同文件且无依赖，可并行
- [Story] 标签用于将任务映射到具体用户故事，实现可追溯
- Task issue SHOULD 回指 `tasks.md` 任务 id（例如 `T012`）
- 每次 issue 同步 MUST 限定在单一 spec 目录内
- 每个用户故事应可独立完成并独立测试
- 实现前务必确认测试先失败
- 每个任务或合理任务组完成后提交
- 在任意检查点可暂停并独立验证故事
- 避免：任务描述模糊、同文件冲突、破坏独立性的跨故事依赖
- 本次不落地 `filename`/`hearing_impaired`/`moviehash`/`foreign_parts_only`，仅文档标注
- 本次不扩展 `subtitleSearchRequests` 审计表 schema
- 本次不改名 `season`/`episode`/`language`，保持现有命名

---

## Issue 映射表

全部 37 个任务已同步至 GitHub issues（仓库 `yaoshining/SubHub`），归并到 **v0.2.0** milestone（编号 5）。

### 阶段 1: 初始化（Setup）

| Task | Issue | 标题 |
|------|-------|------|
| T001 | [#81](https://github.com/yaoshining/SubHub/issues/81) | 评审 plan.md 确认字段改名与 ID-only 场景决策 |
| T002 | [#89](https://github.com/yaoshining/SubHub/issues/89) | 评审契约文档确认请求模型字段与跨字段校验规则 |
| T003 | [#90](https://github.com/yaoshining/SubHub/issues/90) | 评审 data-model.md 确认字段映射关系 |

### 阶段 2: 基础能力（Foundational）

| Task | Issue | 标题 |
|------|-------|------|
| T004 | [#87](https://github.com/yaoshining/SubHub/issues/87) | 更新 OpenAPI 契约新增 imdb_id/tmdb_id/type 参数 |
| T005 | [#88](https://github.com/yaoshining/SubHub/issues/88) | 扩展 SubtitleSearchInput 类型新增 imdbId/tmdbId/type |
| T006 | [#82](https://github.com/yaoshining/SubHub/issues/82) | 扩展 OpenSubtitlesSearchInput 类型新增上游映射字段 |

### 阶段 3: US1 - IMDb ID 定位 (P1)

| Task | Issue | 标题 |
|------|-------|------|
| T007 | [#99](https://github.com/yaoshining/SubHub/issues/99) | [US1] 编写 imdb_id 格式校验单测 |
| T008 | [#103](https://github.com/yaoshining/SubHub/issues/103) | [US1] 编写 buildAdapterInput 分流单测 |
| T009 | [#102](https://github.com/yaoshining/SubHub/issues/102) | [US1] 编写 adapter imdb_id 参数映射单测 |
| T010 | [#93](https://github.com/yaoshining/SubHub/issues/93) | [US1] 编写 imdb_id 契约测试 |
| T011 | [#104](https://github.com/yaoshining/SubHub/issues/104) | [US1] route schema 新增 imdb_id 字段 |
| T012 | [#91](https://github.com/yaoshining/SubHub/issues/91) | [US1] 重构 buildSearchQuery 为 buildAdapterInput 按 ID 分流 |
| T013 | [#98](https://github.com/yaoshining/SubHub/issues/98) | [US1] adapter search 方法映射 imdbId 到 imdb_id |
| T014 | [#96](https://github.com/yaoshining/SubHub/issues/96) | [US1] searchSubtitles 切换调用 buildAdapterInput 并透传 type |

### 阶段 4: US2 - TMDb ID + 季集定位 (P1)

| Task | Issue | 标题 |
|------|-------|------|
| T015 | [#105](https://github.com/yaoshining/SubHub/issues/105) | [US2] 编写 tmdb_id 校验单测 |
| T016 | [#106](https://github.com/yaoshining/SubHub/issues/106) | [US2] 编写 type 与季集字段跨字段冲突单测 |
| T017 | [#111](https://github.com/yaoshining/SubHub/issues/111) | [US2] 编写 buildAdapterInput tmdbId 分流与优先级单测 |
| T018 | [#113](https://github.com/yaoshining/SubHub/issues/113) | [US2] 编写 adapter tmdb_id/season/episode/type 参数映射单测 |
| T019 | [#112](https://github.com/yaoshining/SubHub/issues/112) | [US2] 编写 tmdb_id 单集定位与 type 冲突契约测试 |
| T020 | [#116](https://github.com/yaoshining/SubHub/issues/116) | [US2] route schema 新增 tmdb_id/type 与跨字段冲突校验 |
| T021 | [#110](https://github.com/yaoshining/SubHub/issues/110) | [US2] buildAdapterInput 处理 tmdbId 与 ID 优先级 |
| T022 | [#114](https://github.com/yaoshining/SubHub/issues/114) | [US2] adapter search 方法映射 tmdb_id/season/episode/type |

### 阶段 5: US3 - 兼容性验证 (P1)

| Task | Issue | 标题 |
|------|-------|------|
| T023 | [#117](https://github.com/yaoshining/SubHub/issues/117) | [US3] 编写 backward compatibility 契约测试 |
| T024 | [#120](https://github.com/yaoshining/SubHub/issues/120) | [US3] 编写 query fallback 路径单测 |
| T025 | [#118](https://github.com/yaoshining/SubHub/issues/118) | [US3] 确认 buildAdapterInput query fallback 分支保持现有逻辑 |

### 阶段 6: US4 - filename 文档边界 (P2)

| Task | Issue | 标题 |
|------|-------|------|
| T026 | [#121](https://github.com/yaoshining/SubHub/issues/121) | [US4] 确认 filename 标注为 Tier 2 暂缓字段 |

### 阶段 7: 收尾（Polish）

| Task | Issue | 标题 |
|------|-------|------|
| T027 | [#127](https://github.com/yaoshining/SubHub/issues/127) | 重新生成 API client 确认包含新字段 |
| T028 | [#125](https://github.com/yaoshining/SubHub/issues/125) | 校验 OpenAPI 契约一致性 |
| T029 | [#134](https://github.com/yaoshining/SubHub/issues/134) | 更新 Scalar API 文档展示 |
| T030 | [#124](https://github.com/yaoshining/SubHub/issues/124) | 校验 generated client 类型包含新字段 |
| T031 | [#133](https://github.com/yaoshining/SubHub/issues/133) | 新增字幕搜索 ID 定位与 fallback 集成测试 |
| T032 | [#135](https://github.com/yaoshining/SubHub/issues/135) | 执行 pnpm format:write 收敛格式基线 |
| T033 | [#130](https://github.com/yaoshining/SubHub/issues/130) | 执行 lint 与 typecheck 确认无错误 |
| T034 | [#132](https://github.com/yaoshining/SubHub/issues/132) | 执行 pnpm test 确认全量测试通过 |
| T035 | [#129](https://github.com/yaoshining/SubHub/issues/129) | 更新 quickstart.md 确认首批与暂缓字段说明 |
| T036 | [#136](https://github.com/yaoshining/SubHub/issues/136) | 确认 ID-only 场景与审计表不扩展决策已落实 |
| T037 | [#122](https://github.com/yaoshining/SubHub/issues/122) | 运行 quickstart 验证四个场景行为 |

### 说明

- 创建过程中 GitHub API 出现多次 500 错误，均通过重试解决，最终 37 个 issues 全部创建成功
- Issue 编号因 500 重试存在跳跃（如 #83-86、#107-109、#119、#123、#126、#128、#131 为重试产生的空号或失败占位），但每个 Task ID 均唯一对应一个成功创建的 issue
- 全部 issues 归并到 **v0.2.0** milestone（编号 5），与 `docs/releases/versioning.md` 中"数据库与部署生产化目标版本 v0.2.0"对齐
- 标签体系：`type:enhancement`/`type:documentation` + `area:api`/`area:backend` + `scope:post-mvp` + `priority:p0`/`p1`/`p2` + `stage:design`/`stage:implement`
