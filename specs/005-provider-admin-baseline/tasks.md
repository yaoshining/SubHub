# 任务清单: v0.2.3 Provider Admin Baseline

**输入**: 来自 `/specs/005-provider-admin-baseline/` 的设计文档

**真源范围**:
- `specs/005-provider-admin-baseline/spec.md`
- `specs/005-provider-admin-baseline/plan.md`
- `DESIGN.md`
- `docs/pages/providers.md`
- `docs/pages/provider-detail.md`
- `docs/pages/create-provider.md`
- `design/main.pen`
- `docs/api/openapi.yaml`

**说明**:
- 本 feature 目录当前**没有**独立 `data-model.md` 与 `contracts/`；后端任务以 `spec.md`、`plan.md` 与 `docs/api/openapi.yaml` 为当前真源，不额外发明并行契约。
- 本任务清单只覆盖 `v0.2.3` 的多 provider 管理台与数据持久化收口；**不包含** `v0.3.0` 的字幕资产管理、编辑、转正或审计扩展。
- 所有前端任务必须对齐 `DESIGN.md`、对应 page spec 与 `design/main.pen` 中 `Providers – Dark/Light`、`Create OpenSubtitles Drawer Preview` 相关结构。

**测试要求**: REQUIRED，且必须覆盖 unit + integration/contract + UI。

**组织方式**: 先按实施顺序分阶段，再按用户故事组织，以支持后续 agent 按 task 独立开工。

## 格式: `[ID] [P?] [Story] Description`

- `[P]`: 可并行执行（不同文件、无未完成依赖）
- `[Story]`: 任务所属用户故事（US1~US6）
- 每个 task 的描述都包含精确文件路径；后附 `范围 / 依赖 / 验收标准`

## 阶段 1: Setup（契约与共享落点对齐）

**目的**: 先收口 API、设计与代码落点，避免后续前后端在 provider 类型、字段和状态语义上分叉。

- [ ] T001 在 `docs/api/openapi.yaml` 明确 `GET /api/admin/providers`、`GET /api/admin/providers/{providerId}`、`PATCH /api/admin/providers/{providerId}`、`POST /api/admin/providers/{providerId}/enable`、`POST /api/admin/providers/{providerId}/disable` 的 v0.2.3 多 provider 契约字段与筛选参数
范围: 后端契约真源，覆盖 `type=status` 过滤、`lastHealthStatus/lastErrorSummary/lastHealthCheckedAt`、Xunlei 空凭据返回和错误响应复用；依据 `spec.md` FR-5~FR-9、FR-15 以及 `plan.md` API / Backend Plan。
依赖: 无。
验收标准: OpenAPI 明确 `opensubtitles | xunlei`、enable/disable 即时动作、PATCH 与 detail 响应字段完整，且没有引入字幕资产相关字段。

- [ ] T002 [P] 在 `src/lib/api/generated/model/`、`src/lib/api/generated/providers/providers.ts`、`src/lib/api/providers.ts` 规划并执行与 v0.2.3 契约一致的 client/types 更新入口
范围: 前端 API 调用层共享基线，确保 providers list/detail/update/enable/disable 的生成类型、查询参数与响应字段可被 UI 直接消费；依据 `docs/api/openapi.yaml` 与 `spec.md` FR-9。
依赖: T001。
验收标准: 生成类型包含新 `providerType`、列表筛选参数和新增健康字段，前端不再依赖手写隐式字段。

- [ ] T003 [P] 在 `src/components/providers/provider-utils.tsx`、`src/components/admin/status-badge.tsx`、`src/components/admin/empty-state-card.tsx` 收口多 provider 共用的 type label、status meta、空态文案与 restricted-capability 展示基元
范围: 为列表、inspector、detail、create drawer 复用的视觉与语义基础层，必须对齐 `DESIGN.md`、`docs/pages/providers.md`、`docs/pages/provider-detail.md` 与 `design/main.pen`。
依赖: 无。
验收标准: 共享层能同时表达 OpenSubtitles / Xunlei 的 type-aware 差异、风险状态和空态，不需要在每个页面重复硬编码文案。

---

## 阶段 2: Foundational（阻塞性基础能力）

**目的**: 完成会阻塞所有用户故事的数据库、仓储、服务与测试基线。

**⚠️ CRITICAL**: 本阶段完成前，不得开始任何用户故事实现。

- [ ] T004 在 `src/server/storage/schema.ts` 扩展 `providerTypes` 为 `opensubtitles | xunlei`，为 `providers` 增补 `lastHealthCheckedAt` 字段定义，并保持 `providers_type_check` / `providers_status_check` 与现有 Drizzle 约束模型一致
范围: 数据层真源，落实 `spec.md` FR-1~FR-4、FR-15 与 `plan.md` Data Model Plan，不引入新表。
依赖: 无。
验收标准: schema 仅扩大 enum/check 允许值与健康检查时间字段，不修改既有 OpenSubtitles 行为或无关表结构。

- [ ] T005 在 `src/server/storage/migrations/003_provider_admin_baseline.sql` 与必要的 `src/server/storage/migrations/meta/*` 中实现 drop/recreate `providers_type_check`、新增 `last_health_checked_at`、插入 Xunlei seeded instance 的幂等 migration
范围: 迁移真源，必须落实 `plan.md` 中的 DDL 顺序与 Xunlei 默认值，不把 Xunlei 创建放回 UI 或运行时分支逻辑。
依赖: T004。
验收标准: migration 幂等、可重复执行；Xunlei 默认行为与 `v0.2.2` code-layer 配置一致；没有混入 `v0.3.0` 额外字段。

- [ ] T006 [P] 在 `scripts/db/seed-dev.ts`、`scripts/db/seed-staging.ts`、`scripts/db/bootstrap.ts` 与相关 db 准备脚本中校准 Xunlei seeded instance 与 migration 的一致性，避免 seed 与 migration 重复造数或漂移
范围: 数据迁移与环境初始化收口，覆盖 dev/staging 启库场景；依据 `plan.md` Migration 方向与 `spec.md` FR-2、FR-26。
依赖: T005。
验收标准: 任一初始化路径最终只存在一个语义正确的 Xunlei 实例，名称、type、status 与默认策略字段一致。

- [ ] T007 在 `src/server/providers/provider-repository.ts` 实现多 provider 基础能力：列表 `type/status` 过滤、详情健康字段透出、配置更新、`fallbackProviderId` 自引用/循环校验、type-aware 凭据摘要
范围: 后端仓储真源，落实 `spec.md` FR-10~FR-15、边界场景中的自引用/循环引用，以及 `plan.md` 对 repository 扩展的要求。
依赖: T004。
验收标准: repository 可独立支撑 list/detail/update/status 场景；保存非法 fallback 会返回明确验证错误；Xunlei 不因无凭据被仓储层误判为坏数据。

- [ ] T008 在 `src/server/services/provider-service.ts` 与 `src/server/providers/provider-registry.ts` 收口服务边界：enable/disable 改为 type-aware，registry 仅保留 adapter 映射，不再承担 provider 元数据职责
范围: 后端服务真源，落实 `spec.md` FR-10~FR-14、FR-27 与 `plan.md` Provider-Registry 职责边界。
依赖: T007。
验收标准: 启用 Xunlei 不再要求凭据；OpenSubtitles 仍保留凭据检查；provider-registry 不再输出与 DB 元数据重复的状态/策略信息。

- [ ] T009 在 `tests/integration/storage/provider-repository.postgres.test.ts`、`tests/unit/providers/provider-service.test.ts` 增补 migration/repository/service 的基础用例：xunlei enum 兼容、seeded instance、type-aware enable、fallback 校验
范围: Foundational 测试基线，覆盖真实 Postgres 与快速数据库/逻辑层分层；依据 `spec.md` NFR-002 与 `plan.md` 测试矩阵。
依赖: T005、T007、T008。
验收标准: 至少验证旧 `providers_type_check` 被替换、Xunlei 可启用、OpenSubtitles 仍需凭据、self/cycle fallback 被拒绝。

- [ ] T010 在 `tests/integration/provider-management-flow.test.ts` 与 `tests/contract/providers.contract.test.ts` 建立 v0.2.3 回归骨架，覆盖 seeded Xunlei 存在、providers 管理 API 契约不再是单 provider 假设
范围: 跨后端与 API 的基础回归入口，为后续各故事扩展测试留出稳定锚点。
依赖: T001、T005、T007、T008。
验收标准: 基础 flow 能在测试数据库中看到 Xunlei；providers contract 不再把 `type` 固定为 `opensubtitles`。

**检查点**: enum / migration / seeded Xunlei / repository / service / contract 基线全部就绪，可进入用户故事实现。

---

## 阶段 3: 用户故事 1 - 管理员在管理台看到所有已接入 provider (Priority: P1) 🎯 MVP

**目标**: 让 `/providers` 页面和 list/detail API 在同一套模型下同时展示 OpenSubtitles 与 Xunlei，并让 Xunlei seeded instance 对管理台可见。

**独立测试**: 进入 `/providers`，可同时看到 OpenSubtitles 与 Xunlei 行；按 type/status 过滤后结果正确；选中 Xunlei 时 inspector 显示“无凭据可配 / 不需要 API Key”。

### 用户故事 1 的测试

- [ ] T011 [P] [US1] 在 `tests/contract/providers.contract.test.ts` 扩展 list/detail 契约测试，验证 `GET /api/admin/providers` 与 `GET /api/admin/providers/{providerId}` 返回多 provider、`type`、过滤参数与 Xunlei 空凭据数组
范围: 验证 API 契约层与 `docs/api/openapi.yaml` 对齐，重点覆盖 list/detail 的多 provider 可见性。
依赖: T010。
验收标准: 契约测试显式断言 Xunlei 出现在 list 中、detail 的 `credentials=[]`，以及 type/status 过滤参数生效。

- [ ] T012 [P] [US1] 在 `tests/integration/provider-management-flow.test.ts` 编写 seeded Xunlei + OpenSubtitles 并存的管理流集成测试，验证列表默认返回顺序、Xunlei 可见、空凭据不报错
范围: 验证 migration 与 service 的联动结果，不依赖前端组件实现。
依赖: T010。
验收标准: 新测试能在真实 flow 中看到 Xunlei 默认行，且不会因为无凭据被 list/detail 路径过滤掉。

- [ ] T013 [P] [US1] 在 `tests/ui/providers-page.test.tsx` 增补 providers list / inspector UI 测试，验证 type tabs、status filter、selected state、Xunlei inspector restricted callout 与空态/错误态
范围: 前端行为测试，直接覆盖 `docs/pages/providers.md` 与 `design/main.pen` 的新版结构要求。
依赖: T003。
验收标准: UI 测试可区分 OpenSubtitles 与 Xunlei 的行、筛选与 inspector 差异，并覆盖加载失败与 no-results 空态。

### 用户故事 1 的实现

- [ ] T014 [US1] 在 `src/app/api/admin/providers/route.ts`、`src/app/api/admin/providers/[providerId]/route.ts`、`src/server/services/provider-service.ts` 接入 `type/status` 查询参数与多 provider list/detail 输出
范围: 后端 list/detail 承载层，严格依据 `spec.md` FR-5、FR-15、FR-16、FR-18。
依赖: T007、T008、T011。
验收标准: list/detail API 可返回多 provider 数据、支持 type/status 过滤，且 Xunlei detail 的 `credentials` 为稳定空数组。

- [ ] T015 [US1] 在 `src/components/providers/provider-list.tsx`、`src/components/providers/provider-pool-inspector.tsx`、`src/app/(admin)/providers/providers-client.tsx` 重构 providers 页面为新版 multi-provider 结构
范围: 前端页面真源对齐 `docs/pages/providers.md`、`DESIGN.md`、`design/main.pen` 的 `Providers – Dark/Light` 结构，落实主状态条、卡片行、inspector 和 type tabs。
依赖: T002、T003、T013、T014。
验收标准: 页面不再是单 provider 状态模型；主按钮文案为“创建 Provider”；列表选中、筛选、inspector 与空态遵守 page spec。

- [ ] T016 [US1] 在 `src/app/(admin)/providers/page.tsx`、`src/app/(admin)/providers/loading.tsx`（若存在则更新）与 providers 相关 server entry 中收口加载态、错误态与 seeded Xunlei 的默认选中策略
范围: 页面入口状态收口，确保首屏行为与 `docs/pages/providers.md` 的 scanning / triage 目标一致。
依赖: T015。
验收标准: 首屏默认优先选中 degraded / needs_config / 首个 provider；加载 skeleton、错误态、no-results 文案与 page spec 对齐。

**检查点**: US1 完成后，多 provider 可见性已落地，可作为建议 MVP 演示范围。

---

## 阶段 4: 用户故事 2 - 管理员启用 / 禁用 provider (Priority: P1)

**目标**: 启停动作在列表与详情页都是即时动作，并真实影响聚合搜索调度，且 Xunlei 不因无凭据而无法重新启用。

**独立测试**: 禁用 Xunlei 后聚合搜索不再调用它；重新启用后重新参与；列表与详情页无需手动刷新即可同步状态。

### 用户故事 2 的测试

- [ ] T017 [P] [US2] 在 `tests/unit/providers/provider-service.test.ts` 编写 type-aware enable/disable 单测：OpenSubtitles 无凭据启用失败、Xunlei 无凭据启用成功、两种 type 均可禁用
范围: 验证 service 层即时启停语义与错误映射。
依赖: T009。
验收标准: 测试明确区分 OS 与 Xunlei 的启用门槛，防止回归到“所有 provider 都必须有凭据”的旧假设。

- [ ] T018 [P] [US2] 在 `tests/unit/subtitles/subtitle-gateway.test.ts` 与 `tests/integration/subtitle-gateway-flow.test.ts` 增补 disabled / enabled provider 调度测试，验证 disabled provider 被跳过且不出现在 `provider_failures[]`
范围: 验证 `spec.md` FR-10~FR-13 对聚合搜索的影响。
依赖: T008。
验收标准: disabled provider 不被调用、重新启用后恢复调度，全部 provider 关闭时仍返回明确错误而不是空结果。

- [ ] T019 [P] [US2] 在 `tests/ui/providers-page.test.tsx`、`tests/ui/provider-detail-page.test.tsx` 增补列表行与详情页启停 UI 测试，验证确认弹窗、即时反馈与状态同步
范围: 覆盖 `docs/pages/providers.md` 与 `docs/pages/provider-detail.md` 的 enable/disable 交互规则。
依赖: T013。
验收标准: UI 测试显式断言启停不进入 dirty state、成功后 toast/状态标签刷新、失败时显示明确错误。

### 用户故事 2 的实现

- [ ] T020 [US2] 在 `src/server/subtitles/subtitle-gateway.ts` 改造 provider candidate 选择与 Xunlei 调度路径，统一从 `providers` 表消费 `status/priority/weight` 元数据，移除 callXunlei 的硬编码元数据分支
范围: 后端调度真源，落实 `spec.md` FR-11~FR-14 与 `plan.md` 对 subtitle-gateway 的核心变更要求。
依赖: T008、T018。
验收标准: gateway 仅把 provider-registry 作为 adapter 映射；Xunlei 通过 DB 元数据参与 / 退出调度；disabled/needs_config 处理符合 spec。

- [ ] T021 [US2] 在 `src/components/providers/provider-list.tsx`、`src/app/(admin)/providers/providers-client.tsx`、`src/app/(admin)/providers/[providerId]/provider-detail-client.tsx` 实现列表与详情页的即时启停交互与状态同步
范围: 前端即时动作收口，包含确认弹窗、乐观/回写策略、错误提示与不进入 dirty state 的约束。
依赖: T019、T020。
验收标准: 列表与详情页均可启停；成功后状态同步；失败时保留当前配置草稿并展示错误，不要求手动刷新页面。

**检查点**: US2 完成后，管理台已可真正控制 provider 是否参与聚合搜索。

---

## 阶段 5: 用户故事 3 - 管理员查看 provider 基础状态 (Priority: P1)

**目标**: 在列表、inspector、详情页完整展示 provider 的 status、health、last error 与 last health checked at，并覆盖空态与错误态。

**独立测试**: 执行一次聚合搜索或模拟状态回写后，列表与详情页能看到最新健康摘要；状态读取失败时进入明确错误态而非伪健康。

### 用户故事 3 的测试

- [ ] T022 [P] [US3] 在 `tests/contract/providers.contract.test.ts` 扩展 detail/list 健康字段契约测试，验证 `lastHealthStatus`、`lastErrorSummary`、`lastHealthCheckedAt` 的返回与错误格式
范围: 保证状态展示字段成为稳定 API 契约的一部分。
依赖: T011。
验收标准: 契约测试能区分 `unknown`、`degraded`、`needs_config` 等状态字段，并验证错误响应仍走 `ErrorResponse`。

- [ ] T023 [P] [US3] 在 `tests/integration/storage/subtitle-gateway-failure.postgres.test.ts` 与 `tests/integration/subtitle-gateway-flow.test.ts` 增补健康状态回写测试，验证搜索成功/失败后 provider 健康摘要被刷新
范围: 验证 runtime 回写与 provider status 展示的一致性。
依赖: T020。
验收标准: 测试能观察到 `lastHealthStatus/lastErrorSummary/lastHealthCheckedAt` 随调度变化而更新。

- [ ] T024 [P] [US3] 在 `tests/ui/providers-page.test.tsx`、`tests/ui/provider-detail-page.test.tsx` 补充状态块、健康摘要、错误态与 no-data 展示测试
范围: 前端状态可见性测试，覆盖 page spec 中的一眼可识别要求。
依赖: T013。
验收标准: degraded / needs_config / unknown / 错误态在 UI 中有明确视觉与文案，不会误显示为绿色正常。

### 用户故事 3 的实现

- [ ] T025 [US3] 在 `src/server/providers/provider-repository.ts`、`src/server/subtitles/subtitle-gateway.ts`、必要的 provider failure/health 更新辅助模块中打通 provider 健康字段的读取与回写
范围: 后端状态事实来源，围绕 `spec.md` FR-13~FR-15 与 `plan.md` States 矩阵实现。
依赖: T007、T020、T023。
验收标准: provider 详情可稳定读取健康字段；搜索成功/失败路径会更新相应字段；Xunlei 不因无凭据丢失健康摘要。

- [ ] T026 [US3] 在 `src/components/providers/provider-pool-inspector.tsx`、`src/components/providers/provider-activity.tsx`、`src/app/(admin)/providers/[providerId]/provider-detail-client.tsx` 实现新版状态摘要与只读健康信息区
范围: 前端状态信息承载，对齐 `docs/pages/providers.md` inspector 与 `docs/pages/provider-detail.md` context strip / right inspector 的健康展示结构。
依赖: T024、T025。
验收标准: 列表、inspector、detail 三处均可显示健康摘要、最后错误与最后检查时间，且空值与未知值文案稳定。

**检查点**: US3 完成后，管理员能在不离开管理台的前提下判断 provider 当前是否健康可服务。

---

## 阶段 6: 用户故事 4 - 管理员编辑 provider 最小基础配置 (Priority: P1)

**目标**: 管理员可以在详情页保存 priority/weight/concurrency/cooldown/fallback/rotation 等最小配置，并获得明确 dirty state、字段错误与保存反馈。

**独立测试**: 修改调度策略后保存成功并持久化；非法 fallback 保存被拒绝；未保存离开页面会收到提示。

### 用户故事 4 的测试

- [ ] T027 [P] [US4] 在 `tests/contract/providers.contract.test.ts` 扩展 `PATCH /api/admin/providers/{providerId}` 契约测试，覆盖合法保存、fallback 不存在、自引用、循环引用与 Xunlei 隐藏字段
范围: 验证 PATCH 契约、字段校验与错误结构。
依赖: T011。
验收标准: PATCH 契约能明确返回字段级错误，不接受无效 fallback，也不会要求 Xunlei 提交 rotationEnabled UI 字段。

- [ ] T028 [P] [US4] 在 `tests/integration/provider-management-flow.test.ts` 与 `tests/integration/storage/provider-repository.postgres.test.ts` 增补配置持久化与 fallback 链路测试
范围: 验证配置保存真正写入 DB，并在后续调度中可被消费。
依赖: T009。
验收标准: priority/weight/cooldown/fallback 更新后可通过 repository/service 重新读取，非法回退链被拒绝。

- [ ] T029 [P] [US4] 在 `tests/ui/provider-detail-page.test.tsx` 增补 dirty state、离开确认、字段级错误、保存成功与 section-local save 行为测试
范围: 前端交互测试，严格覆盖 `docs/pages/provider-detail.md` 的 dirty / save 规则。
依赖: T024。
验收标准: 编辑后出现未保存提示；离开/刷新前阻断；保存成功清空 dirty；错误时草稿保留。

### 用户故事 4 的实现

- [ ] T030 [US4] 在 `src/app/api/admin/providers/[providerId]/route.ts`、`src/server/services/provider-service.ts`、`src/server/providers/provider-repository.ts` 实现 provider 配置保存、fallback 校验与字段级错误返回
范围: 后端配置保存主链路，依据 `spec.md` FR-5、FR-10、FR-14、边界场景与 `plan.md` Provider 详情 API / Repository 扩展。
依赖: T027、T028。
验收标准: API 只保存 v0.2.3 范围字段；fallback 不存在/自引用/循环引用时给出明确错误；成功后刷新 `updatedAt`。

- [ ] T031 [US4] 在 `src/components/providers/provider-policy-form.tsx` 与 `src/app/(admin)/providers/[providerId]/provider-detail-client.tsx` 重构详情页调度策略区，落地 section-local save、字段分组与 dirty state 提示
范围: 前端核心配置表单，对齐 `docs/pages/provider-detail.md` Module B 与 `design/main.pen` 的 detail 叙事节奏。
依赖: T029、T030。
验收标准: 表单按基础字段/调度字段分组；保存按钮与 Section B 绑定；dirty state 只针对配置编辑而非启停/凭据操作。

- [ ] T032 [US4] 在 `src/components/providers/provider-utils.tsx`、必要的表单辅助逻辑与 detail layout 中实现 Xunlei / OpenSubtitles 的配置字段差异化渲染
范围: type-aware 表单差异，重点是 `rotationEnabled` 仅对 OpenSubtitles 显示，fallback 选项不含自身且提供说明。
依赖: T031。
验收标准: Xunlei 不渲染无意义字段；OpenSubtitles 保持现有可编辑能力；差异通过结构而非仅文案表达。

**检查点**: US4 完成后，详情页已具备可保存、可校验、可解释的最小调度配置能力。

---

## 阶段 7: 用户故事 5 - 老管理台使用路径不被无端打断 (Priority: P1)

**目标**: 保留 OpenSubtitles 创建与凭据池路径，同时把 create-provider drawer 升级为 two-step flow，并确保它不会引入对 Xunlei 的错误创建入口。

**独立测试**: 通过创建抽屉仍可创建 OpenSubtitles；Xunlei 在 Step 1 被标记为已接入/不可重复创建；创建成功后列表自动选中新实例且不强制跳转。

### 用户故事 5 的测试

- [ ] T033 [P] [US5] 在 `tests/contract/providers.contract.test.ts` 扩展 create provider 契约测试，验证 POST 仍只允许创建 OpenSubtitles，Xunlei 不可重复创建且返回明确限制语义
范围: 验证创建路径契约与 v0.2.3 范围边界。
依赖: T010。
验收标准: create 接口继续接受 OS 初始凭据；不会新增 UI/接口层的“创建 Xunlei”成功路径。

- [ ] T034 [P] [US5] 在 `tests/integration/provider-management-flow.test.ts` 增补 create-provider two-step flow 对应的服务端闭环测试，验证创建后默认字段、列表自动可见与 Xunlei seeded instance 不重复
范围: 验证创建后的数据与列表一致性。
依赖: T012。
验收标准: 新建 OS 后 provider 默认字段与 spec 一致；Xunlei 仍为唯一 seeded 实例；创建不会破坏旧凭据池流程。

- [ ] T035 [P] [US5] 在 `tests/ui/providers-page.test.tsx` 与 `tests/ui/provider-responsive.test.tsx` 增补 create-provider drawer two-step UI 测试，验证 Step 1 type selector、Step 2 OS 初始建档、Xunlei locked state 与创建成功回流列表
范围: 直接覆盖 `docs/pages/create-provider.md` 与 `design/main.pen` 的 drawer 结构。
依赖: T013。
验收标准: UI 测试显式断言按钮文案为“创建 Provider”、存在 two-step flow、Xunlei 不可创建、成功后默认回到列表并选中新实例。

### 用户故事 5 的实现

- [ ] T036 [US5] 在 `src/components/providers/create-provider-drawer.tsx` 重构为 two-step flow：Step 1 选择 provider type，Step 2 仅对 OpenSubtitles 展示首轮建档表单，并引用 `docs/pages/create-provider.md` 与 `design/main.pen` 的 drawer 结构
范围: 前端创建主流程，必须保留 OpenSubtitles 既有创建能力，同时满足 v0.2.3 的 type-neutral 入口与 Xunlei locked state。
依赖: T002、T003、T035。
验收标准: drawer 内先选类型再填写建档信息；Xunlei 卡片显示已接入/不可重复创建；不暴露 Base URL 字段；成功后关闭抽屉并回流列表。

- [ ] T037 [US5] 在 `src/app/api/admin/providers/route.ts`、`src/app/(admin)/providers/providers-client.tsx`、`src/lib/api/providers.ts` 收口创建入口与创建后回流逻辑，确保现有 OpenSubtitles 创建路径兼容且不强制跳详情页
范围: 前后端创建闭环，对齐 `spec.md` FR-23、FR-24 与 `docs/pages/providers.md` 创建按钮规则。
依赖: T033、T034、T036。
验收标准: API 仍以 OpenSubtitles 为唯一可创建 type；列表创建成功后自动选中新实例；不会把用户强制送往 detail 页面。

**检查点**: US5 完成后，旧管理路径保持兼容，同时创建体验升级到 two-step flow。

---

## 阶段 8: 用户故事 6 - 管理员理解 Xunlei 与 OpenSubtitles 的差异 (Priority: P2)

**目标**: 通过列表、inspector、详情页与创建抽屉的 type-aware 结构，让管理员清楚知道 Xunlei 不需要 API Key、无凭据池、不可重复创建。

**独立测试**: 在 providers list、detail、create drawer 中切换两类 provider，差异一眼可见，且不会把 Xunlei 渲染成“坏掉的 OpenSubtitles”。

### 用户故事 6 的测试

- [ ] T038 [P] [US6] 在 `tests/ui/providers-page.test.tsx`、`tests/ui/provider-detail-page.test.tsx` 补充 Xunlei restricted-capability callout 与 OpenSubtitles credential pool 对照测试
范围: 验证 type-aware UI 差异是否由结构表达，而非仅靠说明文字。
依赖: T024、T035。
验收标准: Xunlei 页面不出现“新增凭据”按钮或凭据表；OpenSubtitles 页面保持原有凭据池表格与动作。

- [ ] T039 [P] [US6] 在 `tests/ui/provider-responsive.test.tsx` 增补多断点下的 type-aware 布局测试，验证 Inspector/Bottom Sheet/Drawer 在移动端仍能清晰表达差异
范围: 响应式 UI 覆盖，防止多 provider 语义在小屏下丢失。
依赖: T035。
验收标准: 桌面与移动断点下，Xunlei restricted state、OS credential pool 和 drawer locked card 都可见且可操作。

### 用户故事 6 的实现

- [ ] T040 [US6] 在 `src/components/providers/provider-credential-table.tsx`、`src/components/providers/provider-pool-inspector.tsx`、`src/components/providers/provider-activity.tsx` 实现 Xunlei restricted capability 组件分支与 OpenSubtitles 凭据池保留分支
范围: 详情页与列表 inspector 的 type-aware 核心差异区，对齐 `docs/pages/provider-detail.md` Module C 与 `docs/pages/providers.md` Inspector 规则。
依赖: T038。
验收标准: Xunlei 整段替换为 restricted callout；OpenSubtitles 继续使用凭据表；两者共享外层骨架但中心信息块不同。

- [ ] T041 [US6] 在 `src/components/providers/provider-list.tsx`、`src/components/providers/create-provider-drawer.tsx`、`src/components/providers/provider-utils.tsx` 强化 type identity、locked/restricted 标签与解释文案
范围: 列表与创建入口的认知差异表达，对齐 `docs/pages/providers.md`、`docs/pages/create-provider.md` 与 `design/main.pen`。
依赖: T039、T040。
验收标准: Xunlei 在列表和创建流中都被明确标记为不同能力类型，且没有“灰掉但语义不明”的状态。

**检查点**: US6 完成后，管理员无需阅读代码即可理解两类 provider 的能力差异。

---

## 阶段 9: Polish & Cross-Cutting Concerns

**目的**: 处理横切验证、文档收口与最终交付质量门禁。

- [ ] T042 [P] 在 `docs/pages/providers.md`、`docs/pages/provider-detail.md`、`docs/pages/create-provider.md` 校准实现后的 allowed overrides、状态矩阵与 type-aware 例外，确保页面真源与代码一致
范围: 页面级设计文档收口；不修改 `DESIGN.md` 的系统级规则。
依赖: T015、T026、T031、T036、T040。
验收标准: page spec 明确记录 two-step flow、Xunlei restricted capability、即时启停与 dirty state 规则，且不出现与实现相反的旧描述。

- [ ] T043 [P] 在 `src/lib/api/generated/`、`src/lib/api/providers.ts`、`README.md` 或必要的管理台说明文档中收口 API/client 与使用说明更新
范围: API 契约链路与开发者文档收口，确保生成代码与文档一致。
依赖: T001、T002、T014、T030、T037。
验收标准: 生成 client 与实际契约一致；必要文档说明 `v0.2.3` 多 provider 管理台边界；未引入 `v0.3.0` 字幕资产叙述。

- [ ] T044 在 `tests/unit/providers/provider-service.test.ts`、`tests/unit/subtitles/subtitle-gateway.test.ts`、`tests/contract/providers.contract.test.ts`、`tests/integration/provider-management-flow.test.ts`、`tests/integration/subtitle-gateway-flow.test.ts`、`tests/ui/providers-page.test.tsx`、`tests/ui/provider-detail-page.test.tsx`、`tests/ui/provider-responsive.test.tsx` 运行并修复 v0.2.3 回归
范围: 功能级验证汇总，覆盖 unit / integration / UI 三层。
依赖: T041。
验收标准: 所有新增与受影响测试稳定通过，且验证的是 v0.2.3 行为，不掺入未来范围。

- [ ] T045 在 `pnpm format:write`、`pnpm lint`、`pnpm typecheck`、必要的 `pnpm test -- ...` / Postgres 专项测试命令下完成交付前验证，并处理因 provider admin baseline 引入的格式、类型与契约偏差
范围: 质量门禁执行，符合宪章与仓库约定。
依赖: T044。
验收标准: 格式化、静态检查、类型检查与目标测试通过；无将 `pnpm` 替换为其它包管理器的工作流漂移。

- [ ] T046 在 `specs/005-provider-admin-baseline/tasks.md` 与后续 issue 同步上下文中收口并行/串行边界、任务状态与交付说明，确保 tasks -> issue 时不混入 `v0.3.0` 或无关优化项
范围: 交付治理收口，便于后续 `/speckit.taskstoissues` 直接使用。
依赖: T045。
验收标准: task 与 issue 分组边界清楚；没有“未来可选优化”或字幕资产任务混入主链路。

---

## 依赖与执行顺序

### 阶段依赖

- 阶段 1（Setup）: 无依赖，可立即开始。
- 阶段 2（Foundational）: 依赖阶段 1，会阻塞全部用户故事。
- 阶段 3（US1）: 依赖阶段 2；建议作为 MVP 首个交付。
- 阶段 4（US2）: 依赖阶段 2，且需要 US1 的 list/detail 页面与 API 基线完成后再接 UI。
- 阶段 5（US3）: 依赖阶段 2；建议在 US2 的 gateway 状态回写能力就绪后推进。
- 阶段 6（US4）: 依赖阶段 2；建议在 US3 之后收口 detail 页保存与健康状态。
- 阶段 7（US5）: 依赖阶段 2；可与 US3/US4 并行，但必须在发布前与 list 页集成验证。
- 阶段 8（US6）: 依赖 US1、US3、US5 的 type-aware 结构基础。
- 阶段 9（Polish）: 依赖所有目标用户故事完成。

### 用户故事依赖

- US1 → 后续所有故事的列表/详情认知基础，建议最先完成。
- US2 → 与 US3 共享 gateway / provider 状态事实来源；串行优先于 US3 的健康展示回写。
- US3 → 为 US4/US6 提供稳定的状态摘要与 detail 布局锚点。
- US4 → 依赖 detail 页面与 repository 校验能力；与 US5 仅共享页面入口，不强依赖。
- US5 → 创建路径兼容性收口，可与 US4 并行，但必须在 US1 页面结构稳定后接入。
- US6 → 依赖 US1/US3/US5 完成后的 type-aware UI 骨架。

### 必须串行的关键任务

- T001 → T002
- T004 → T005 → T006
- T007 → T008 → T020
- T014 → T015 → T016
- T030 → T031 → T032
- T036 → T037
- T044 → T045 → T046

### 适合并行的任务

- T002 与 T003
- T009 与 T010
- US1: T011 / T012 / T013 可并行
- US2: T017 / T018 / T019 可并行
- US3: T022 / T023 / T024 可并行
- US4: T027 / T028 / T029 可并行
- US5: T033 / T034 / T035 可并行
- US6: T038 / T039 可并行
- Polish: T042 与 T043 可并行

---

## 并行示例

### US1 并行示例

```bash
Task: "T011 [US1] 扩展 providers list/detail 契约测试"
Task: "T012 [US1] 编写 seeded Xunlei 并存的 provider-management 集成测试"
Task: "T013 [US1] 补充 providers 页面多 provider UI 测试"
```

### US4 并行示例

```bash
Task: "T027 [US4] 扩展 PATCH provider 契约测试"
Task: "T028 [US4] 增补配置持久化与 fallback 链路集成测试"
Task: "T029 [US4] 补充 detail 页 dirty state / 保存 UI 测试"
```

### US5 并行示例

```bash
Task: "T033 [US5] 扩展 create provider 契约测试"
Task: "T034 [US5] 编写 create-provider two-step flow 集成测试"
Task: "T035 [US5] 补充 create drawer two-step UI 测试"
```

---

## 实施策略

### 建议 MVP 范围

1. 阶段 1: T001-T003
2. 阶段 2: T004-T010
3. 阶段 3: T011-T016

MVP 交付结果: 管理台能看见 OpenSubtitles / Xunlei，两类 provider 结构正确、API 契约稳定、seeded Xunlei 与列表/inspector 一致。

### 完整 v0.2.3 交付顺序

1. 完成 Setup + Foundational
2. 交付 US1（多 provider 可见性）
3. 交付 US2（即时启停）
4. 交付 US3（状态可见）
5. 交付 US4（基础配置保存）
6. 交付 US5（兼容旧路径 + two-step create drawer）
7. 交付 US6（type-aware 差异表达）
8. 收尾文档、验证与 issue 收口

---

## 建议 Issue 分组方案

### Group A - 契约与基础设施

- T001-T010
- 适用标签: `type:feature`, `area:provider`, `area:api`, `area:db`, `priority:high`, `scope:mvp`
- 目标: 先完成 enum/migration/seed/repository/service/contract 基线

### Group B - 多 Provider 列表与 Inspector

- T011-T016
- 适用标签: `type:feature`, `area:provider`, `area:admin`, `priority:high`, `scope:mvp`
- 目标: 完成 providers list、筛选、inspector、新版结构与空态/错误态

### Group C - 启停与聚合搜索联动

- T017-T021
- 适用标签: `type:feature`, `area:provider`, `area:api`, `area:search`, `priority:high`, `scope:mvp`
- 目标: 完成 enable/disable 即时动作与 gateway skip/restore 语义

### Group D - 健康状态与详情页状态摘要

- T022-T026
- 适用标签: `type:feature`, `area:provider`, `area:admin`, `priority:high`, `scope:mvp`
- 目标: 完成 status/health/error/last checked 的显示与回写

### Group E - 策略保存与 Dirty State

- T027-T032
- 适用标签: `type:feature`, `area:provider`, `area:admin`, `priority:high`, `scope:mvp`
- 目标: 完成 detail 页最小配置保存、fallback 校验、dirty state 和 Xunlei 字段差异

### Group F - Create Provider Two-Step Flow 与兼容收口

- T033-T037
- 适用标签: `type:feature`, `area:provider`, `area:admin`, `priority:high`, `scope:mvp`
- 目标: 保留 OpenSubtitles 创建路径，同时实现 two-step drawer 与 Xunlei locked state

### Group G - Type-Aware UX 差异

- T038-T041
- 适用标签: `type:feature`, `area:provider`, `area:design`, `priority:medium`, `scope:mvp`
- 目标: 强化 OpenSubtitles / Xunlei 的能力差异表达

### Group H - 收尾与发布门禁

- T042-T046
- 适用标签: `type:chore`, `area:provider`, `area:docs`, `priority:high`, `scope:mvp`
- 目标: 文档收口、测试回归、格式/类型/契约门禁与 tasks -> issue 整理
