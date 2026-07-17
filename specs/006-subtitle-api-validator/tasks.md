# Tasks: 字幕 API 验证工具（Subtitle API Validator）

**输入**: `specs/006-subtitle-api-validator/` 下的 spec.md、plan.md、research.md、data-model.md、quickstart.md、contracts/  
**前提**: 遵循 `design/main.pen`、`docs/pages/subtitle-api-validator.md`、`DESIGN.md`、现有 admin/provider 架构与 `pnpm` 工作流

## Phase 1: Setup

**目的**: 建立 validator feature 的实现入口、导航承接与 API/client 基础骨架。

- [ ] T001 新增 Subtitle API Validator 页面路由入口于 `src/app/(admin)/subtitle-api-validator/page.tsx`
- [ ] T002 新增页面客户端容器骨架于 `src/app/(admin)/subtitle-api-validator/subtitle-api-validator-client.tsx`
- [ ] T003 新增 validator API 手写封装文件于 `src/lib/api/subtitle-validator.ts`
- [ ] T004 更新管理后台导航入口于 `src/components/admin/sidebar.tsx`

---

## Phase 2: Foundational

**目的**: 建立所有用户故事共用的 admin facade、契约、共享类型与受控调用边界；完成后各故事才能独立推进。

- [ ] T005 [P] 定义 validator 共享 schema 与诊断类型于 `src/server/subtitles/admin-subtitle-validator-schema.ts`
- [ ] T006 [P] 实现 provider 能力摘要与参数定义映射于 `src/server/subtitles/admin-subtitle-validator-capabilities.ts`
- [ ] T007 实现 admin validator 服务 facade 于 `src/server/subtitles/admin-subtitle-validator.ts`
- [ ] T008 [P] 新增 provider 列表路由于 `src/app/api/admin/subtitle-validator/providers/route.ts`
- [ ] T009 [P] 新增搜索验证路由于 `src/app/api/admin/subtitle-validator/search/route.ts`
- [ ] T010 [P] 新增下载验证路由于 `src/app/api/admin/subtitle-validator/download-validation/route.ts`
- [ ] T011 更新 OpenAPI 契约于 `docs/api/openapi.yaml`
- [ ] T012 生成并校验前端 API 客户端输出于 `src/lib/api/generated/`

**检查点**: admin-only validator API 契约、类型与 facade 已建立，且不改变正式 `src/app/api/subtitles/*` 行为。

---

## Phase 3: User Story 1 — 管理员查看当前可验证的 provider 列表 (Priority: P1)

**目标**: 管理员进入页面后可看到当前 provider 列表、默认选中对象、状态/健康摘要与内部工具定位。

**独立测试**: 打开 `/admin/subtitle-api-validator`，可看到 provider rail、内部工具提示、默认选中 provider、disabled/restricted 状态表达与列表加载失败反馈。

- [ ] T013 [P] [US1] 为 provider 列表 API 编写契约测试于 `tests/contract/subtitle-validator-providers.contract.test.ts`
- [ ] T014 [P] [US1] 为 provider rail 状态与默认选择规则编写 UI 测试于 `tests/ui/subtitle-api-validator-page.test.tsx`
- [ ] T015 [US1] 在 `src/server/subtitles/admin-subtitle-validator.ts` 中实现 provider 列表与默认选中逻辑，包含 disabled/restricted 可见性与状态说明
- [ ] T016 [US1] 在 `src/lib/api/subtitle-validator.ts` 中实现 provider 列表请求封装
- [ ] T017 [US1] 实现 Provider Rail 与页面 Header/内部工具提示于 `src/app/(admin)/subtitle-api-validator/subtitle-api-validator-client.tsx`
- [ ] T018 [US1] 新增 provider rail 展示组件于 `src/components/providers/subtitle-validator-provider-rail.tsx`
- [ ] T019 [US1] 新增 provider 概览/能力面板组件于 `src/components/providers/subtitle-validator-provider-overview.tsx`
- [ ] T020 [US1] 为 provider 列表加载失败、空列表与权限拒绝增加集成测试于 `tests/integration/subtitle-validator-access-flow.test.ts`

---

## Phase 4: User Story 2 — 管理员按 provider 发起搜索验证 (Priority: P1)

**目标**: 管理员可输入基础参数与 provider 扩展参数，发起搜索验证，并清晰区分成功、有结果、空结果、超时、参数错误与 provider 错误。

**独立测试**: 选择 provider，输入关键词并提交；页面可呈现 searching / success / empty / invalid params / timeout / provider error 等状态，且空结果是 200 成功语义。

- [x] T021 [P] [US2] 为搜索验证路由与空结果语义编写契约测试于 `tests/contract/subtitle-validator-search.contract.test.ts`
- [x] T022 [P] [US2] 为 provider-aware 参数表单与搜索状态编写 UI 测试于 `tests/ui/subtitle-api-validator-search.test.tsx`
- [x] T023 [P] [US2] 为参数映射与错误归类编写单元测试于 `tests/unit/admin-subtitle-validator-search.test.ts`
- [x] T024 [US2] 在 `src/server/subtitles/admin-subtitle-validator-capabilities.ts` 中实现基础参数/扩展参数定义与示例参数映射
- [x] T025 [US2] 在 `src/server/subtitles/admin-subtitle-validator.ts` 中实现单 provider 搜索验证、空结果独立成功态与错误分类
- [x] T026 [US2] 在 `src/lib/api/subtitle-validator.ts` 中实现搜索验证请求封装
- [x] T027 [US2] 新增搜索参数与操作区组件于 `src/components/providers/subtitle-validator-search-composer.tsx`
- [x] T028 [US2] 新增诊断摘要组件于 `src/components/providers/subtitle-validator-diagnostic-summary.tsx`
- [x] T029 [US2] 在 `src/app/(admin)/subtitle-api-validator/subtitle-api-validator-client.tsx` 中集成 provider 切换、搜索提交、loading/empty/error 状态与结果上下文清理
- [x] T030 [US2] 新增搜索验证闭环集成测试于 `tests/integration/subtitle-validator-search-flow.test.ts`

---

## Phase 5: User Story 3 — 管理员对搜索结果执行下载验证 (Priority: P1)

**目标**: 管理员可对结果项执行 browser download 或 URL check，并清晰区分成功、失败、无下载地址、不支持与 provider 异常，尤其正确处理 Xunlei 特例。

**独立测试**: 对搜索结果项发起下载验证；页面能展示 success / failed / missing_download / unsupported，且 Xunlei 可 URL check 但 browser download 可返回 unsupported。

- [ ] T031 [P] [US3] 为下载验证路由状态矩阵编写契约测试于 `tests/contract/subtitle-validator-download-validation.contract.test.ts`
- [ ] T032 [P] [US3] 为结果项下载验证交互编写 UI 测试于 `tests/ui/subtitle-api-validator-download.test.tsx`
- [ ] T033 [P] [US3] 为下载模式分支与 Xunlei 特例编写单元测试于 `tests/unit/admin-subtitle-validator-download.test.ts`
- [ ] T034 [US3] 在 `src/server/subtitles/admin-subtitle-validator.ts` 中实现下载验证 facade，区分 browser download / url check / missing_download / unsupported
- [ ] T035 [US3] 在 `src/lib/api/subtitle-validator.ts` 中实现下载验证请求封装
- [ ] T036 [US3] 新增搜索结果控制台组件于 `src/components/providers/subtitle-validator-results-console.tsx`
- [ ] T037 [US3] 新增下载验证反馈组件于 `src/components/providers/subtitle-validator-download-status.tsx`
- [ ] T038 [US3] 在 `src/app/(admin)/subtitle-api-validator/subtitle-api-validator-client.tsx` 中集成结果项下载验证、最近一次验证反馈与诊断摘要联动
- [ ] T039 [US3] 新增下载验证闭环集成测试于 `tests/integration/subtitle-validator-download-flow.test.ts`

---

## Phase 6: User Story 4 — 管理员理解 provider 参数边界与错误上下文 (Priority: P1)

**目标**: 页面持续体现“基础通用参数 + provider 扩展参数”的边界，并在失败态中给管理员足够明确的上下文与下一步建议。

**独立测试**: 切换 provider 后参数区稳定、扩展字段自然切换；失败态能区分 invalid params / timeout / provider error / unknown error，且不泄露敏感信息。

- [ ] T040 [P] [US4] 为错误上下文与脱敏反馈编写 UI 测试于 `tests/ui/subtitle-api-validator-diagnostics.test.tsx`
- [ ] T041 [P] [US4] 为诊断摘要与错误脱敏编写单元测试于 `tests/unit/admin-subtitle-validator-diagnostics.test.ts`
- [ ] T042 [US4] 在 `src/server/subtitles/admin-subtitle-validator.ts` 中补齐 error summary、nextActionHint 与脱敏诊断摘要
- [ ] T043 [US4] 在 `src/components/providers/subtitle-validator-provider-overview.tsx` 与 `src/components/providers/subtitle-validator-search-composer.tsx` 中强化基础/扩展参数边界说明与限制提示
- [ ] T044 [US4] 在 `src/components/providers/subtitle-validator-diagnostic-summary.tsx` 与 `src/components/providers/subtitle-validator-results-console.tsx` 中强化错误来源、动作类型与下一步建议呈现
- [ ] T045 [US4] 新增跨 provider 切换与错误上下文集成测试于 `tests/integration/subtitle-validator-diagnostics-flow.test.ts`

---

## Phase 7: Polish & Cross-Cutting Concerns

**目的**: 收口文档、回归、契约链路与全量校验，确认正式 API 不受影响。

- [ ] T046 [P] 更新页面规范收口实现差异于 `docs/pages/subtitle-api-validator.md`
- [ ] T047 [P] 按需更新职责边界说明于 `docs/pages/providers.md`
- [ ] T048 [P] 按需更新职责边界说明于 `docs/pages/provider-detail.md`
- [ ] T049 回归正式字幕 API 相关测试，确认 `src/app/api/subtitles/search/route.ts` 与 `src/app/api/subtitles/download/route.ts` 行为不变
- [ ] T050 运行 API 契约链路校验：`pnpm api:spec && pnpm api:client && pnpm api:check`
- [ ] T051 运行定向测试集合：`pnpm test -- tests/contract/subtitle-validator-providers.contract.test.ts tests/contract/subtitle-validator-search.contract.test.ts tests/contract/subtitle-validator-download-validation.contract.test.ts tests/ui/subtitle-api-validator-page.test.tsx tests/ui/subtitle-api-validator-search.test.tsx tests/ui/subtitle-api-validator-download.test.tsx tests/ui/subtitle-api-validator-diagnostics.test.tsx tests/integration/subtitle-validator-access-flow.test.ts tests/integration/subtitle-validator-search-flow.test.ts tests/integration/subtitle-validator-download-flow.test.ts tests/integration/subtitle-validator-diagnostics-flow.test.ts`
- [ ] T052 运行格式化、静态检查与类型检查：`pnpm format:write && pnpm lint && pnpm typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup（Phase 1）→ Foundational（Phase 2）→ 全部用户故事（Phase 3-6）→ Polish（Phase 7）
- User Story 1 依赖 Phase 2 完成
- User Story 2 依赖 US1 的页面骨架与 Phase 2 的搜索契约
- User Story 3 依赖 US2 的搜索结果上下文
- User Story 4 依赖 US2 / US3 已产出的诊断与结果组件

### User Story Dependencies

- **US1 (P1)**: 可在 Phase 2 后独立实现并验证
- **US2 (P1)**: 依赖 US1 的工作台骨架，但可在其上独立完成搜索闭环
- **US3 (P1)**: 依赖 US2 的结果输出，但不依赖 US4
- **US4 (P1)**: 依赖 US2 / US3 的基础交互与错误通路

### Parallel Opportunities

- Phase 2 中 `T005`、`T006`、`T008`、`T009`、`T010` 可并行
- US1 中 `T013`、`T014` 可与 `T016`、`T018`、`T019` 并行
- US2 中 `T021`、`T022`、`T023` 可并行，UI 组件与服务实现可并行推进
- US3 中 `T031`、`T032`、`T033` 可并行，结果控制台与下载状态组件可并行
- US4 中 `T040`、`T041` 可并行，边界提示与诊断展示增强可并行
- Polish 中文档同步任务 `T046`、`T047`、`T048` 可并行

## Implementation Strategy

### MVP First

1. 先完成 Phase 1-3，交付可见 provider 列表、默认选中与内部工具定位
2. 再完成 Phase 4，形成搜索验证闭环（这是最小可用诊断工作台）
3. 然后完成 Phase 5，补齐下载验证闭环
4. 最后完成 Phase 6-7，强化诊断语义、文档与回归

### Incremental Delivery

1. 先交付 admin-only provider rail + overview
2. 追加 provider-aware search composer + diagnostics
3. 追加 results console + download validation
4. 追加错误脱敏、跨 provider 诊断与完整回归

### Quality Gates

- 每个用户故事完成后至少通过对应 contract / UI / integration 测试
- 最终必须通过 `pnpm format:write`、`pnpm lint`、`pnpm typecheck`
- 若更新 OpenAPI，必须通过 `pnpm api:spec && pnpm api:client && pnpm api:check`
- 必须保留对正式 `src/app/api/subtitles/*` 行为不变的回归验证
