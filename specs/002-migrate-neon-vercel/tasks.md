# 任务清单: Neon Postgres + Vercel 运行时迁移

**输入**: 来自 `specs/002-migrate-neon-vercel/` 的设计文档

**前置条件**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/runtime-environment-contract.md`、`contracts/release-cutover-contract.md`、`specs/001-mvp-admin-console/spec.md`、`specs/001-mvp-admin-console/plan.md`、`specs/001-mvp-admin-console/tasks.md`、`specs/001-mvp-admin-console/data-model.md`、`specs/001-mvp-admin-console/database-design.md`、`docs/decisions/neon-vercel-runtime.md`、`DESIGN.md`

**可追溯前置条件**: Feature ID `002`，spec 目录 `specs/002-migrate-neon-vercel/`，分支 `002-migrate-neon-vercel`；同步 task issue 前必须先创建 002 主追踪 issue，且不得复用 `001-mvp-admin-console` 或 `#3`

**测试**: REQUIRED。任务必须显式覆盖环境映射、数据库 URL 解析、Postgres schema / migration、SQLite 数据搬迁、bootstrap / seed / cutover、三层环境可用性验证、独立 `test` 数据库隔离 / reset 策略，以及 `001-mvp-admin-console` 主链路回归。

**组织方式**: 任务按用户故事分组，同时在任务描述中标明所属迁移层：环境映射层、Postgres 接入层、SQLite 搬迁层、bootstrap / seed 层、部署与发布门禁层、测试与回归层、文档层。

## 格式: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无依赖）
- **[Story]**: 用户故事阶段任务使用 `[US1]`、`[US2]`、`[US3]`、`[US4]`
- **路径**: 每个任务描述都包含明确文件路径

## Extension Hooks

**Optional Pre-Hook**: git
Command: `/speckit.git.commit`
Description: Auto-commit before task generation

Prompt: Commit outstanding changes before task generation?
To execute: `/speckit.git.commit`

---

## 外部阻塞项

- 在同步 task issue 之前，必须先创建 002 主追踪 issue。
- 在开始 Vercel 部署与 release gate 任务前，必须已准备好 Neon 的 prod / staging / dev 三类数据库，以及 Vercel Production / Preview 环境与分支覆盖能力。
- 在开始数据库相关单测、集成测试、契约测试与 CI 真实数据库校验任务前，必须已准备好独立 `test` 数据库或 test branch，以及 `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED` 的测试注入方式。
- 在执行 SQLite cutover 相关任务前，必须准备可恢复的 SQLite 备份或快照，并确认生产迁移窗口。

---

## 阶段 1: 初始化（共享基础设施）

**目的**: 建立 002 的基础脚本、环境变量真源、测试脚手架和 Vercel/Neon 运行手册。

- [ ] T001 在 `package.json` 添加 `postgres`、`drizzle-orm/postgres-js` 依赖，以及 `db:bootstrap`、`db:seed:dev`、`db:seed:staging`、`db:precheck:cutover`、`db:import:sqlite`、`db:validate:cutover`，并补充 `db:prepare:test` / `db:reset:test` 等测试数据库脚本，同时将 `better-sqlite3` 从正式运行时依赖路径中移出
- [ ] T002 在 `drizzle.config.ts` 将 drizzle-kit 配置切换到 `DATABASE_URL_UNPOOLED` 驱动的 Postgres 模式，并保持输出目录为 `src/server/storage/migrations/`
- [ ] T003 在 `src/lib/env.ts` 落地环境映射层的单一 `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 读取、`VERCEL_ENV` / `VERCEL_GIT_COMMIT_REF` 部署身份校验和 greenfield / cutover 模式开关，并补充 `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED` 的测试专用语义
- [ ] T004 [P] 在 `tests/unit/env/runtime-environment.test.ts` 编写环境映射层测试，覆盖 `main -> production`、`preview -> staging`、其他 `preview/*|feature/*|agent/* -> development`、本地 development -> dev、数据库相关测试 -> test，以及错误注入护栏
- [ ] T005 [P] 在 `tests/contract/runtime/environment-contract.test.ts` 对照 `specs/002-migrate-neon-vercel/contracts/runtime-environment-contract.md` 编写环境变量契约测试，验证应用不在多套 URL 间自行路由，且数据库相关测试不会回落到 dev / staging / prod
- [ ] T006 [P] 在 `.env.example` 创建运行时环境变量示例，仅保留 `DATABASE_URL`、`DATABASE_URL_UNPOOLED`、`APP_URL` 和必要 secrets 的单部署配置写法
- [ ] T007 在 `tests/setup.ts` 建立 Postgres 测试数据库启动、清理、最小 fixture、reset 和 direct URL 测试注入逻辑，统一接入 `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED`，替换当前以 SQLite 文件为中心的测试初始化路径
- [ ] T008 [P] 在 `docs/workflows/vercel-neon-environments.md` 记录 Vercel 环境变量分组、Preview 分支覆盖、Neon prod / staging / dev 数据库准备步骤，以及独立 `test` 数据库的准备、清理与重建约束，作为仓库内的环境映射操作手册

**检查点**: 仓库已有单一 URL 环境变量基线、Postgres 测试脚手架和 Vercel/Neon 环境说明，可继续推进正式接入。

---

## 阶段 2: 基础能力（阻塞性前置）

**目的**: 建立 Postgres 正式运行路径、schema 基线、bootstrap 真源和基础数据库验证能力。

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事开发。

- [ ] T009 在 `src/server/storage/postgres-client.ts` 实现 Postgres 接入层的 pooled / direct client 工厂，明确 `DATABASE_URL` 与 `DATABASE_URL_UNPOOLED` 的调用边界
- [ ] T010 在 `src/server/storage/client.ts` 将统一 `StorageClient` 出口切换到 Postgres 运行时实现，并移除 SQLite 作为应用主路径的连接逻辑
- [ ] T011 在 `src/server/storage/schema.ts` 将 001 的 SQLite 语义映射为 Postgres 正式 schema，覆盖 `timestamptz`、boolean、部分唯一索引、外键和状态约束，同时保持实体命名和语义不扩张
- [ ] T012 在 `src/server/storage/migrations/002_neon_vercel_baseline.ts` 创建 Postgres schema / migration 基线，替代 SQLite 时代 migration 历史的直接继承
- [ ] T013 [P] 在 `tests/unit/storage/postgres-schema.test.ts` 编写 Postgres schema / migration 测试，覆盖关键唯一约束、外键、pending invitation 部分唯一索引、布尔字段和时间字段映射
- [ ] T014 [P] 在 `tests/unit/storage/runtime-url-boundary.test.ts` 编写 URL 边界测试，验证运行时只使用 `DATABASE_URL`，migration / bootstrap / cutover 只使用 `DATABASE_URL_UNPOOLED`
- [ ] T015 [P] 在 `tests/integration/storage/postgres-client.test.ts` 编写 Postgres 接入层集成测试，验证 pooled 运行路径、direct migration 路径和失败时快速阻断
- [ ] T016 在 `src/server/storage/bootstrap.ts` 建立 bootstrap / seed 层真源，定义 greenfield production、SQLite cutover production、staging seed、dev seed 四种初始化模式
- [ ] T017 在 `scripts/db/bootstrap.ts` 创建 bootstrap 脚本入口，并接入 `src/server/storage/bootstrap.ts` 的模式化初始化逻辑
- [ ] T018 [P] 在 `tests/integration/storage/bootstrap-state.test.ts` 编写 bootstrap 状态测试，验证 `schemaReady`、`bootstrapReady`、`seedState`、`adminInitializationState` 的合法转换

**检查点**: Postgres 正式 client、schema baseline、bootstrap 真源和基础数据库测试就绪，可并行推进用户故事。

---

## 阶段 3: 用户故事 1 - 生产环境可稳定运行当前 MVP (Priority: P1) 🎯 MVP

**目标**: `main` 对应的 Production 部署可以在 Neon Postgres 上运行现有 MVP，而不扩张任何产品功能。

**独立测试**: 对 production 环境执行 migration + bootstrap 后，后台登录、Dashboard、Settings、Providers、API Keys、Users、统一字幕查询/下载主链路均可在 Postgres 上稳定运行；migration 或 bootstrap 缺失时实例明确失败。

### 用户故事 1 的测试 (REQUIRED) ⚠️

- [ ] T019 [P] [US1] 在 `tests/smoke/production-runtime.smoke.test.ts` 编写生产环境 smoke test，覆盖登录、Dashboard、Providers、API Keys、Users、Settings、统一字幕查询与下载主路径的 Postgres 运行验证
- [ ] T020 [P] [US1] 在 `tests/integration/runtime/production-readiness-gate.test.ts` 编写生产就绪门禁测试，验证 migration 缺失、bootstrap 缺失或 direct URL 错误时实例不会被视为可用
- [ ] T021 [P] [US1] 在 `tests/integration/admin-auth-flow.test.ts` 和 `tests/integration/settings-readiness-flow.test.ts` 回归现有登录与设置状态流程，确保迁移到 Postgres 后行为与 001 保持一致

### 用户故事 1 的实现

- [ ] T022 [US1] 在 `src/server/services/auth-service.ts`、`src/server/services/bootstrap-service.ts`、`src/app/api/admin/bootstrap/route.ts`、`src/app/api/admin/bootstrap/status/route.ts`、`src/app/api/admin/auth/login/route.ts`、`src/app/api/admin/auth/logout/route.ts`、`src/app/api/admin/auth/me/route.ts` 接入 Postgres `StorageClient`，并区分 greenfield production 的首个管理员初始化与 cutover production 的既有管理员迁移路径
- [ ] T023 [US1] 在 `src/server/services/dashboard-service.ts`、`src/server/services/settings-service.ts`、`src/app/api/admin/dashboard/summary/route.ts`、`src/app/api/admin/settings/status/route.ts` 落地生产运行时的数据库就绪状态、bootstrap 状态和失败护栏，且不引入新的后台治理流程
- [ ] T024 [US1] 在 `src/server/api/admin-auth.ts` 和 `src/server/api/response.ts` 增加 production 运行护栏与错误映射，使 migration / bootstrap 未完成时返回明确失败结果而不是半可用状态
- [ ] T025 [US1] 在 `src/server/subtitles/subtitle-gateway.ts`、`src/server/subtitles/subtitle-download.ts`、`src/app/api/subtitles/search/route.ts`、`src/app/api/subtitles/download/route.ts` 验证对外字幕主路径完全走 pooled Postgres 运行时连接，且不改变现有统一 API 行为
- [ ] T026 [US1] 在 `.github/workflows/db-migrate.yml` 落地 production 迁移工作流，使用 `DATABASE_URL_UNPOOLED` 执行 migration / bootstrap，并在失败时阻断应用 promotion
- [ ] T027 [US1] 在 `.github/workflows/deploy-smoke.yml` 落地 production 部署后 smoke gate，验证 Postgres 运行下的后台与对外 API 主链路
- [ ] T028 [US1] 运行 `pnpm db:migrate`、`pnpm db:bootstrap`、`pnpm test -- tests/smoke/production-runtime.smoke.test.ts tests/integration/runtime/production-readiness-gate.test.ts tests/integration/admin-auth-flow.test.ts tests/integration/settings-readiness-flow.test.ts` 并修复 `src/server/services/`、`src/app/api/admin/`、`src/app/api/subtitles/`、`.github/workflows/` 中被触达文件

**检查点**: Production 环境在 Neon Postgres 上可稳定运行现有 MVP，且 readiness gate 能阻止错误实例被视为可用。

---

## 阶段 4: 用户故事 2 - Preview 与 Development 具有稳定且可区分的环境映射 (Priority: P2)

**目标**: `preview` 分支稳定使用 staging database，其他 Preview 分支与本地 development 稳定使用 dev database，且环境切换主路由由 Vercel 环境变量完成。

**独立测试**: 在 `preview` 分支、其他 Preview 分支和本地 development 三种情况下，应用都只消费当前部署唯一注入的 `DATABASE_URL` / `DATABASE_URL_UNPOOLED`，并在身份不匹配时明确失败。

### 用户故事 2 的测试 (REQUIRED) ⚠️

- [ ] T029 [P] [US2] 在 `tests/integration/runtime/preview-branch-mapping.test.ts` 编写环境映射测试，覆盖 `preview` 分支 -> staging、其他 Preview 分支 -> dev 的部署身份校验
- [ ] T030 [P] [US2] 在 `tests/smoke/nonproduction-runtime.smoke.test.ts` 编写 staging / dev 非生产 smoke test，验证后台与对外 API 在 Preview / 本地 development 的基本可用性
- [ ] T031 [P] [US2] 在 `tests/unit/env/local-development-env.test.ts` 编写本地 development 环境测试，验证 `.env.development.local` 到 `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 的映射和 prod 误连阻断

### 用户故事 2 的实现

- [ ] T032 [US2] 在 `src/lib/env.ts` 完成环境映射层的 Vercel Preview / local development 身份护栏，确保应用只校验当前注入 URL 与部署身份，不再在 prod / staging / dev 多套 URL 中自行路由
- [ ] T033 [US2] 在 `docs/workflows/vercel-neon-environments.md`、`specs/002-migrate-neon-vercel/quickstart.md`、`specs/002-migrate-neon-vercel/contracts/runtime-environment-contract.md` 写清 Vercel Preview 分支覆盖、staging / dev 唯一 URL 注入和本地 development 配置方式
- [ ] T034 [US2] 在 `.github/workflows/deploy-smoke.yml` 为 `preview` 分支与其他 Preview 分支增加 staging / dev 分层 smoke gate，确保非生产部署可用性验证不串用 prod 数据库
- [ ] T035 [US2] 在 `.github/workflows/ci.yml` 增加环境映射与 URL 护栏校验步骤，使映射回归在合并前被阻断
- [ ] T036 [US2] 在 `.env.example` 收敛生产 / Preview / development 的单部署 URL 说明，并移除任何暗示应用内多库选路的变量命名
- [ ] T037 [US2] 运行 `pnpm test -- tests/unit/env/runtime-environment.test.ts tests/unit/env/local-development-env.test.ts tests/integration/runtime/preview-branch-mapping.test.ts tests/smoke/nonproduction-runtime.smoke.test.ts` 并修复 `src/lib/env.ts`、`.env.example`、`.github/workflows/`、`specs/002-migrate-neon-vercel/` 中被触达文件

**检查点**: Preview / Development 的环境映射由 Vercel 注入主导，应用层只负责校验与护栏，不再存在运行时多 URL 主路由选择。

---

## 阶段 5: 用户故事 3 - 现有 SQLite 基线可有序迁移到 Neon Postgres (Priority: P3)

**目标**: SQLite 只作为迁移输入来源，Postgres 拥有正式基线；数据搬迁、cutover 校验和回退判断独立可执行。

**独立测试**: 使用 SQLite 备份或测试 fixture 执行 precheck、数据导入、post-validation 和 cutover gate，可明确区分 required / conditional / excluded 对象，并阻断不安全切换。

### 用户故事 3 的测试 (REQUIRED) ⚠️

- [ ] T038 [P] [US3] 在 `tests/integration/storage/sqlite-import.test.ts` 编写 SQLite 数据搬迁测试，覆盖 required entities 全量导入、conditional request history 窗口导入和 excluded active session 不迁移规则
- [ ] T039 [P] [US3] 在 `tests/integration/storage/cutover-validation.test.ts` 编写 cutover 校验测试，验证 precheck、导入后数量/状态语义校验以及失败中止路径
- [ ] T040 [P] [US3] 在 `tests/unit/storage/data-migration-scope.test.ts` 编写数据迁移范围测试，固定 required / conditional / excluded 对象清单与策略
- [ ] T041 [P] [US3] 在 `tests/fixtures/sqlite/subhub-mvp.sqlite` 和 `tests/fixtures/sqlite/subhub-mvp.expected.json` 准备 SQLite fixture 与预期清单，用于稳定复现实验性迁移与校验场景

### 用户故事 3 的实现

- [ ] T042 [US3] 在 `scripts/db/sqlite-reader/index.ts` 隔离 SQLite 读取工具，并在 `package.json` 中将 `better-sqlite3` 约束为迁移专用脚本依赖，不进入 `src/` 正式运行时路径
- [ ] T043 [US3] 在 `scripts/db/precheck-cutover.ts` 实现 cutover 前检查，覆盖 direct URL 可用性、SQLite 备份存在性、Postgres baseline 同步状态和目标 tier 护栏
- [ ] T044 [US3] 在 `scripts/db/import-sqlite.ts` 实现 SQLite -> Postgres 数据搬迁脚本，覆盖 `admin_users`、`admin_invitations`、`providers`、`provider_credentials`、`caller_keys`、`caller_key_rotations`、`admin_action_results` 的 required 导入，以及请求历史的条件迁移
- [ ] T045 [US3] 在 `src/server/storage/validate-cutover.ts` 和 `scripts/db/validate-cutover.ts` 实现迁移后校验，覆盖数量比对、关键状态语义、管理员登录、Provider/Caller Key 可用性和 active session 排除规则
- [ ] T046 [US3] 在 `package.json` 接入 `db:precheck:cutover`、`db:import:sqlite`、`db:validate:cutover`，并确保 SQLite 搬迁工具只通过迁移脚本暴露
- [ ] T047 [US3] 在 `specs/002-migrate-neon-vercel/quickstart.md` 和 `specs/002-migrate-neon-vercel/contracts/release-cutover-contract.md` 写实 cutover 命令、request history 条件迁移、active session 排除和失败中止条件
- [ ] T048 [US3] 运行 `pnpm test -- tests/unit/storage/data-migration-scope.test.ts tests/integration/storage/sqlite-import.test.ts tests/integration/storage/cutover-validation.test.ts`、`pnpm db:precheck:cutover` 和 `pnpm db:validate:cutover` 并修复 `scripts/db/`、`src/server/storage/`、`package.json`、`specs/002-migrate-neon-vercel/` 中被触达文件

**检查点**: SQLite 数据搬迁、cutover 校验与失败阻断路径独立成立，且 SQLite 不再作为正式运行时依赖。

---

## 阶段 6: 用户故事 4 - 初始化、migration 与发布流程可重复执行 (Priority: P4)

**目标**: greenfield production、SQLite cutover production、staging 和 dev 的 bootstrap / seed / release gate 路径清晰分离，且能重复执行而不污染正式数据。

**独立测试**: 分别验证 greenfield production 初始化、cutover production 初始化、staging/dev seed 幂等执行和 release gate 阻断条件，可独立证明发布流程具备可操作性。

### 用户故事 4 的测试 (REQUIRED) ⚠️

- [ ] T049 [P] [US4] 在 `tests/integration/storage/greenfield-production-init.test.ts` 编写 greenfield production 初始化测试，验证 schema migration + bootstrap + 首个管理员初始化路径
- [ ] T050 [P] [US4] 在 `tests/integration/storage/cutover-production-init.test.ts` 编写 cutover production 初始化测试，验证 schema migration + 数据搬迁 + 迁移后校验路径不会触发首个管理员初始化
- [ ] T051 [P] [US4] 在 `tests/integration/storage/seed-repeatability.test.ts` 编写 staging / dev seed 幂等性测试，验证重复执行不会污染正式数据
- [ ] T052 [P] [US4] 在 `tests/smoke/staging-dev-seed.smoke.test.ts` 编写 staging / dev 初始化 smoke test，验证 seed 后后台主链路仍符合 001 现有行为

### 用户故事 4 的实现

- [ ] T053 [US4] 在 `src/server/storage/bootstrap.ts` 和 `scripts/db/bootstrap.ts` 明确区分 greenfield production、SQLite cutover production、staging seed、dev seed 的初始化模式，并约束管理员初始化只在“无管理员且显式 greenfield”时触发
- [ ] T054 [US4] 在 `scripts/db/seed-dev.ts` 和 `scripts/db/seed-staging.ts` 实现非生产 seed，确保 staging/dev 可重复初始化，且 production 永不执行 seed
- [ ] T055 [US4] 在 `.github/workflows/db-migrate.yml` 为 staging 增加 direct URL migration job、cutover gate 和失败阻断逻辑，并与 production job 保持同一套受控责任边界
- [ ] T056 [US4] 在 `.github/workflows/deploy-smoke.yml` 和 `.github/workflows/ci.yml` 增加 post-migration smoke gate、release-blocking checks 和三层环境验证步骤，阻止失败实例被 promotion
- [ ] T057 [US4] 在 `specs/002-migrate-neon-vercel/data-model.md`、`specs/002-migrate-neon-vercel/contracts/release-cutover-contract.md`、`specs/002-migrate-neon-vercel/quickstart.md` 同步 `BootstrapState`、`ReleaseCutover`、seed 规则和 greenfield/cutover 责任边界
- [ ] T058 [US4] 运行 `pnpm db:bootstrap`、`pnpm db:seed:dev`、`pnpm db:seed:staging`、`pnpm test -- tests/integration/storage/greenfield-production-init.test.ts tests/integration/storage/cutover-production-init.test.ts tests/integration/storage/seed-repeatability.test.ts tests/smoke/staging-dev-seed.smoke.test.ts` 并修复 `src/server/storage/`、`scripts/db/`、`.github/workflows/`、`specs/002-migrate-neon-vercel/` 中被触达文件

**检查点**: bootstrap / seed / release gate 在 greenfield production、cutover production、staging、dev 四条路径上职责清晰且可重复执行。

---

## 阶段 7: 收尾与横切关注点

**目的**: 完成文档对齐、001 主链路回归、OpenAPI/Orval/Scalar 兼容验证和发布候选校验。

- [ ] T059 [P] 在 `docs/decisions/neon-vercel-runtime.md` 和 `docs/workflows/vercel-neon-environments.md` 回写最终环境变量命名、Vercel 分支覆盖规则和 cutover runbook
- [ ] T060 [P] 在 `specs/001-mvp-admin-console/database-design.md` 记录“SQLite 已降级为迁移输入、Postgres 成为正式运行基线”的仓库真源变化，并保留 001 数据语义不变
- [ ] T061 [P] 在 `tests/unit/storage/schema.test.ts`、`tests/integration/provider-management-flow.test.ts`、`tests/integration/users-management-flow.test.ts`、`tests/integration/subtitle-gateway-flow.test.ts`、`tests/integration/settings-readiness-flow.test.ts` 执行并修复 Postgres-backed 的 `001-mvp-admin-console` 主链路回归
- [ ] T062 [P] 在 `tests/contract/openapi-generated-client.test.ts`、`tests/contract/admin-auth.contract.test.ts`、`tests/contract/providers.contract.test.ts`、`tests/contract/caller-keys.contract.test.ts`、`tests/contract/users.contract.test.ts`、`tests/contract/subtitles.contract.test.ts`、`tests/contract/settings.contract.test.ts` 验证 OpenAPI / Orval / Scalar 链路在 Postgres 运行时下仍然兼容，并仅在必要时更新 `docs/api/openapi.yaml`、`src/lib/api/generated/`、`src/lib/api/`
- [ ] T063 运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm db:check`、`pnpm api:check` 以及 `pnpm test -- tests/smoke/production-runtime.smoke.test.ts tests/smoke/nonproduction-runtime.smoke.test.ts tests/smoke/staging-dev-seed.smoke.test.ts` 作为 release candidate 验证，并修复所有被触达文件
- [ ] T064 在 `specs/002-migrate-neon-vercel/quickstart.md` 执行一次 dev 与 staging 的 dry run，回写命令、环境变量说明或阻塞项，确保后续 issue / implementation 能按文档复现

---

## 依赖与执行顺序

### 阶段依赖

- **Setup（阶段 1）**: 无依赖，可立即开始
- **Foundational（阶段 2）**: 依赖 Setup 完成，会阻塞全部用户故事
- **用户故事 1（阶段 3）**: 依赖 Foundational 完成
- **用户故事 2（阶段 4）**: 依赖 Foundational 完成，可与用户故事 1 并行
- **用户故事 3（阶段 5）**: 依赖 Foundational 完成；执行 cutover 前还依赖外部 SQLite 备份/快照与迁移窗口
- **用户故事 4（阶段 6）**: 依赖 Foundational 完成，并建议在用户故事 1 与用户故事 3 的核心脚本就绪后推进
- **Polish（阶段 7）**: 依赖所有目标用户故事完成

### 用户故事依赖

- **用户故事 1 (P1)**: 不依赖其他故事，是 production MVP 运行闭环
- **用户故事 2 (P2)**: 不依赖用户故事 1 的产品能力，可与 US1 并行，但共享 env / workflow 文件时需串行合并
- **用户故事 3 (P3)**: 不依赖用户故事 2 的产品能力，但执行 cutover 干跑前需要 Postgres baseline 与 bootstrap 真源已完成
- **用户故事 4 (P4)**: 与 US1 / US3 共用 bootstrap、workflow 与 smoke gate 文件，建议在它们的实现结果稳定后整合

### 每个用户故事内的顺序

- 测试 MUST 先写并在实现前失败
- 环境映射层 / 接入层先于部署与工作流任务
- schema / migration 先于数据搬迁
- 数据搬迁先于 cutover 校验
- bootstrap / seed 规则先于 release gate
- 当前优先级故事完成并通过验证后，再推进下一故事

### 可并行机会

- Setup 中的 `T004`、`T005`、`T006`、`T008` 可并行
- Foundational 中的 `T013`、`T014`、`T015`、`T018` 可并行
- US1 中的 `T019`、`T020`、`T021` 可并行
- US2 中的 `T029`、`T030`、`T031` 可并行
- US3 中的 `T038`、`T039`、`T040`、`T041` 可并行
- US4 中的 `T049`、`T050`、`T051`、`T052` 可并行
- 阶段 7 中的 `T059`、`T060`、`T061`、`T062` 可并行

---

## 并行示例：用户故事 1

```bash
# 并行启动 production 运行验证测试：
Task: "在 tests/smoke/production-runtime.smoke.test.ts 编写生产环境 smoke test"
Task: "在 tests/integration/runtime/production-readiness-gate.test.ts 编写生产就绪门禁测试"
Task: "在 tests/integration/admin-auth-flow.test.ts 和 tests/integration/settings-readiness-flow.test.ts 回归现有登录与设置状态流程"
```

## 并行示例：用户故事 3

```bash
# 并行准备 SQLite 搬迁验证资产：
Task: "在 tests/integration/storage/sqlite-import.test.ts 编写 SQLite 数据搬迁测试"
Task: "在 tests/integration/storage/cutover-validation.test.ts 编写 cutover 校验测试"
Task: "在 tests/unit/storage/data-migration-scope.test.ts 编写数据迁移范围测试"
Task: "在 tests/fixtures/sqlite/subhub-mvp.sqlite 和 tests/fixtures/sqlite/subhub-mvp.expected.json 准备 SQLite fixture 与预期清单"
```

---

## 实施策略

### MVP 优先（仅用户故事 1）

1. 完成阶段 1：Setup
2. 完成阶段 2：Foundational
3. 完成阶段 3：用户故事 1
4. **STOP and VALIDATE**：验证 Production Postgres 运行闭环
5. 条件满足后再推进 Preview / Development、SQLite cutover 与 release repeatability

### 增量交付

1. 交付 Setup + Foundational，形成 Postgres 正式接入基线
2. 交付用户故事 1，拿到 production 运行闭环
3. 交付用户故事 2，拿到 preview / development 环境映射闭环
4. 交付用户故事 3，拿到 SQLite 搬迁与 cutover 校验闭环
5. 交付用户故事 4，拿到 bootstrap / seed / release gate 闭环
6. 最后完成阶段 7 的回归、文档和发布候选验证

### 团队并行策略

多开发者协作时：

1. 团队共同完成 Setup + Foundational
2. Foundational 完成后：
   - 开发者 A：用户故事 1（production 运行）
   - 开发者 B：用户故事 2（preview / development 映射）
   - 开发者 C：用户故事 3（SQLite 搬迁与 cutover）
3. 用户故事 4 由能同时整合 workflow、bootstrap 与发布门禁的成员推进
4. 最后统一完成阶段 7 的回归与文档对齐

---

## 备注

- 本任务集严格限定在基础设施迁移范围内，不包含新的 Providers、API Keys、Users、Access Control 功能，也不包含新页面或新的后台治理流程。
- “每个 PR 自动创建独立 Neon database branch” 不属于当前 feature；若后续需要，应作为 `v0.2.x` / future 扩展单独建模。
- 若外部前置条件尚未满足（Neon 实例、Vercel 分支覆盖、SQLite 备份、迁移窗口），相关实现任务可先完成代码与测试，但不得将 cutover 视为可执行完成。