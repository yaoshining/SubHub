# 实施计划: Neon Postgres + Vercel 运行时迁移

**分支**: `002-migrate-neon-vercel` | **日期**: 2026-05-31 | **规格**: `specs/002-migrate-neon-vercel/spec.md`

**输入**: 来自 `specs/002-migrate-neon-vercel/spec.md` 的功能规格，以及 `specs/001-mvp-admin-console/spec.md`、`specs/001-mvp-admin-console/plan.md`、`specs/001-mvp-admin-console/tasks.md`、`specs/001-mvp-admin-console/data-model.md`、`specs/001-mvp-admin-console/database-design.md`、`docs/decisions/neon-vercel-runtime.md`、`docs/runtime/environment-mapping.md`、`DESIGN.md`、`.github/copilot-instructions.md`

**说明**: 本计划只定义基础设施与运行环境迁移路径，不新增产品功能。`001-mvp-admin-console` 继续定义后台页面、统一字幕 API、数据语义与 UX 边界；`002-migrate-neon-vercel` 只负责把现有 MVP 从 SQLite + 单机运行基线迁移到 Neon Postgres + Vercel 的可运行、可发布、可回归方案。

## 摘要

本 feature 将 SubHub 的正式运行底座从 SQLite + 本地文件路径 + 单机部署假设，切换到 Neon Postgres + Vercel 的三层运行环境模型，并补充独立 `test` 数据库语义。实现重点不是新增页面或 API，而是收敛环境解析、数据库 URL 管理、Postgres schema 基线、SQLite 数据搬迁、bootstrap/seed、迁移执行方式、发布门禁，以及 production / staging / dev 与测试隔离的验证流程。

技术策略上，当前运行时将以 Neon Postgres 为正式数据库目标，采用“运行时使用 pooled URL、迁移与数据搬迁使用 direct/unpooled URL”的边界；SQLite 时代的 migration 历史不做 1:1 继承，而是为 Postgres 重新建立正式 migration 基线，并通过独立数据搬迁流程把必须保留的管理数据迁入新库。Vercel 负责 production / preview 部署，GitHub Actions 或等价受控发布流程负责 migration 与 cutover 门禁，避免把数据库切换与应用构建混成不可控的单一步骤。

## 设计上下文

**全局设计系统**: `DESIGN.md`

**共享布局规范**: `docs/layouts/admin-layout.md`

**相关页面规范**:
- `docs/pages/login.md`
- `docs/pages/dashboard.md`
- `docs/pages/providers.md`
- `docs/pages/provider-detail.md`
- `docs/pages/api-keys.md`
- `docs/pages/users.md`
- `docs/pages/settings.md`

**已评审的设计输入**:
- `specs/001-mvp-admin-console/spec.md`：现有 MVP 的正式产品范围
- `specs/001-mvp-admin-console/plan.md`：当前技术基线、质量门禁与实现范围
- `specs/001-mvp-admin-console/tasks.md`：当前 env / storage / migration / regression 触点
- `specs/001-mvp-admin-console/data-model.md`：当前核心实体与状态语义
- `specs/001-mvp-admin-console/database-design.md`：SQLite 基线、PostgreSQL 可迁移约束与数据库落地规则
- `docs/decisions/neon-vercel-runtime.md`：Neon + Vercel 路线决策与环境策略

## 技术上下文

**语言/版本**: TypeScript；运行时仍以当前 Next.js LTS 可支持的 Node.js 版本为基线。当前仓库已锁定 `next@16.2.6`、`react@19.2.6`、`typescript@6.0.3`。

**核心依赖**:
- Next.js + React + TypeScript
- pnpm
- Drizzle ORM + drizzle-kit
- Zod 环境变量校验
- OpenAPI 真源 `docs/api/openapi.yaml` + Orval + Scalar
- 计划新增 Postgres 运行驱动：`postgres` + `drizzle-orm/postgres-js`
- SQLite 读取能力隔离到迁移专用脚本或一次性导入工具，不进入正式 Vercel 运行时依赖路径

**存储**:
- 正式运行目标：Neon Postgres
- 环境分层：prod database、staging database、dev database
- 测试隔离目标：统一的 `test` 数据库语义（本地落在 Docker Postgres，CI 落在 GitHub Actions Postgres service，仅供数据库相关单测、集成测试、契约测试与 CI 真实数据库校验使用）
- 旧基线：SQLite 文件数据库，仅作为历史数据来源与迁移输入，不再作为正式部署目标

**测试**:
- `vitest` 单元、集成与契约测试
- `mock / no-db` 用于纯逻辑快速单测
- `PGlite` 用于本地快速数据库单测层，优先覆盖少量 repository / service 层数据库行为
- 本地真实数据库测试主线使用 Docker Postgres，并通过专用 runtime/direct URL 运行独立 `test` 数据库
- GitHub Actions 中的真实数据库测试主线使用 Postgres service container，并为每次 CI run 提供临时干净数据库
- Neon 不再作为本地或 CI 日常测试主库，仅保留给 staging / preview / production / cutover / deploy verification
- 数据库 schema / migration / drift 校验
- SQLite -> Postgres 数据搬迁校验
- production / staging / dev 烟雾验证
- `001-mvp-admin-console` 主链路回归测试

**目标平台**:
- Vercel Production：`main`
- Vercel Preview：`preview` 分支，以及命中仓库级 Preview 分支白名单的普通 Preview 分支 `preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*`
- 本地 Development：`pnpm dev`

**项目类型**: Next.js 全栈 Web 应用 + 对外 HTTP API 网关；当前 feature 只调整运行底座，不改变应用形态。

**性能目标**:
- 保持 `001-mvp-admin-console` 已定义的查询与后台交互性能基线不回退
- 数据库环境解析失败时，应用在启动期快速失败，而不是进入半可用状态
- migration、bootstrap 和 cutover 校验必须可在单个发布窗口内完成并给出明确结果

**约束条件**:
- 不扩大 `001-mvp-admin-console` 的产品功能、页面职责、API 范围或 UX 范围
- 环境切换必须由 Vercel 环境变量与分支规则驱动，不得依赖手工改连数据库
- Vercel 对当前部署只注入唯一一组 `DATABASE_URL` / `DATABASE_URL_UNPOOLED`；应用层不得同时持有 prod、staging、dev 多套数据库 URL 后再自行路由
- `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED` 只服务测试与 CI 的真实数据库校验，不得参与 production、preview 或本地 development 的应用运行主路由
- 运行时请求只能使用 pooled URL；migration、DDL、数据搬迁、bootstrap 和校验脚本只能使用 direct/unpooled URL
- Vercel build/start 阶段不得隐式执行生产 migration
- Postgres 正式 migration 基线必须独立建立；SQLite 历史 migration 不作为 1:1 迁移目标
- `test` 数据库是测试隔离语义，不是新的产品环境层，也不是当前阶段要求新增的 Vercel 部署层

**规模/范围**:
- 影响当前全部 MVP 页面、管理端 API、对外字幕 API、数据库访问层、环境变量层、部署链路和测试链路
- 不引入新页面、不引入新产品能力、不引入 PR 级数据库 branch 自动化

## 宪章检查

*门禁：必须在第 0 阶段研究前通过，并在第 1 阶段设计后复检。*

- **代码质量门禁**: 通过。计划继续沿用 `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm db:check`、`pnpm api:check` 作为核心门禁，并新增 Postgres 迁移与数据搬迁验证步骤。
- **必需测试策略**: 通过。覆盖环境映射、数据库 URL 解析、Postgres schema/migration、SQLite 数据搬迁、bootstrap/seed、三层环境 smoke test、独立 `test` 数据库隔离/reset 策略与 001 主链路回归。
- **UX/API 一致性约束**: 通过。迁移后后台页面与对外 API 行为继续以 001 定义为准，仅允许新增运行时错误和未就绪状态的最小表达。
- **性能预算与验证方法**: 通过。保持 001 的核心性能目标，同时要求启动失败与发布校验快速、明确。
- **可维护性/模块化方案**: 通过。运行时 env 解析、Postgres client、SQLite 数据搬迁、bootstrap/seed、发布脚本与 Vercel/GitHub Actions 分离。
- **设计来源映射**: 通过。`DESIGN.md`、共享布局与既有 page specs 都被视为“不得扩张范围”的正式约束。
- **是否需要增补 `DESIGN.md`**: No。当前不引入新的系统级视觉或交互规则。
- **worktree 隔离**: 通过。当前 active feature 为 `specs/002-migrate-neon-vercel`。
- **可追溯关系**: 有条件通过。feature id、spec 目录与分支已建立；主追踪 issue 仍需在进入 tasks / issue 同步前创建。
- **issue 同步范围**: 通过。后续 `speckit.tasks` 与 issue 同步只面向 `specs/002-migrate-neon-vercel`。

## 设计映射

### 适用规则

- **全局规则**:
  - `DESIGN.md §2` 控制台气质、运维事实优先、信息密度与高风险动作可见性保持不变
  - `DESIGN.md §8` 错误状态和未就绪状态必须与文案共同表达
  - `DESIGN.md §10` 可访问性与交互底线继续适用
- **页面规则**:
  - 所有既有 page spec 继续有效；本 feature 不改变 `/login`、`/dashboard`、`/providers`、`/providers/:providerId`、`/api-keys`、`/users`、`/settings` 的模块边界
  - 若迁移导致需要新增“环境未就绪 / 数据库不可用 / 初始化未完成”提示，只能在既有页面内最小化落地，不得借机重构页面职责

### 计划中的文档变更

- **更新 `DESIGN.md`**: No
- **更新既有页面规范**: 默认 `None`；仅当实现需要补充环境未就绪提示时，最小更新相关 page spec
- **新建页面规范**: None

## 项目结构

### 文档（本功能）

```text
specs/002-migrate-neon-vercel/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── runtime-environment-contract.md
│   └── release-cutover-contract.md
└── tasks.md
```

### 现有源码与预期改造面（仓库根目录）

```text
src/
├── app/
│   ├── (admin)/...
│   ├── api/admin/...
│   ├── api/subtitles/...
│   └── docs/api/page.tsx
├── lib/
│   ├── env.ts
│   └── api/
└── server/
    └── storage/
        ├── schema.ts
        ├── client.ts
        ├── migrations/
        └── ...

tests/
├── contract/
├── integration/
├── unit/
└── ui/

docs/
└── api/openapi.yaml

.github/
└── workflows/

drizzle.config.ts
package.json
```

### 计划中的结构调整

```text
src/
├── lib/
│   └── env.ts                        # 环境变量读取、部署身份校验与运行护栏
└── server/
    └── storage/
        ├── schema.ts                # Postgres 正式 schema 真源
        ├── client.ts                # 统一 StorageClient 出口，默认连接 Postgres
        ├── postgres-client.ts       # 运行时 Postgres 连接与 pooled URL 使用边界
        ├── bootstrap.ts             # bootstrap / seed / init 入口
        ├── validate-cutover.ts      # 迁移后校验与 smoke gate
        ├── migrations/              # Postgres 正式 migration 基线
        └── legacy-sqlite/           # SQLite 时代迁移文件与参考资产（如需归档）

scripts/
└── db/
  ├── import-sqlite.ts             # SQLite -> Postgres 数据搬迁脚本，仅在迁移阶段执行
  └── sqlite-reader/               # 如需保留原生 SQLite 读取能力，隔离在迁移工具目录

tests/
├── unit/storage/
├── integration/storage/
├── contract/runtime/
└── smoke/

.github/
└── workflows/
    ├── db-migrate.yml               # staging / production 迁移工作流
    └── deploy-smoke.yml             # 部署后 smoke gate
```

**结构决策**: 保持 Next.js 单仓全栈结构不变，只对 env / storage / deploy workflow 做增量调整。`src/server/storage/schema.ts` 升级为 Postgres 正式真源；SQLite 读取能力从应用运行时代码中移出，下沉到独立迁移脚本或一次性导入工具，避免正式 Vercel 构建和运行链路继续携带本地 SQLite 依赖。

## 实现路径

### 1. 环境解析与配置层

- 扩展 `src/lib/env.ts`，从当前只识别 SQLite 文件路径，升级为读取当前部署已注入的唯一 `DATABASE_URL` / `DATABASE_URL_UNPOOLED`，并对部署身份做校验。
- 运行环境映射与 Preview 分支白名单以仓库级真源 `docs/runtime/environment-mapping.md` 为准：`main` -> `Production` -> `prod database`，`preview` -> `Preview` -> `staging database`，本地 development -> `Development` -> `dev database`，其他 Preview 部署仅当分支命中白名单前缀 `preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*` 时，才允许进入 `Preview -> dev database`。
- 环境切换的主路由选择由 Vercel 环境变量分组与 Preview 分支覆盖完成：Production 只注入 prod URL；`preview` 分支对应的 Preview 只注入 staging URL；命中仓库级白名单的普通 Preview 分支只注入 dev URL；本地 development 只配置 dev URL；非白名单 Preview 分支必须直接报错，不允许静默映射到 dev。
- 应用层只使用 `VERCEL_ENV`、`VERCEL_GIT_COMMIT_REF`、`NODE_ENV` 与当前注入的单一 URL 对进行身份校验、未就绪护栏和错误提示，不负责在 prod/staging/dev 多套 URL 之间做主路由选择。

### 1.5 测试数据库策略

- 数据库相关单测、集成测试、契约测试，以及 CI 中需要真实数据库行为验证的测试，统一使用独立 `test` 数据库语义，不复用 prod、staging 或 dev。
- 本地需要真实数据库行为的测试，默认连接本地 Docker Postgres；该主线必须具备 reset、migrate、seed 与验证能力，不得默认连接 dev、staging、prod 或其他共享远程数据库。
- 本地真实数据库测试在执行前必须先确认 Docker Postgres `test` 容器已运行且可连接；若容器未运行，必须有显式启动或恢复步骤，而不是依赖手动临场处理。
- GitHub Actions 中需要真实数据库行为的测试，默认连接 Postgres service container；每次 CI run 都必须获得临时干净数据库，不依赖共享远程测试库。
- 当前已完成最小 PGlite 试点验证；PGlite 可作为快速数据库单测层，用于少量 repository / service 层数据库行为验证，但不替代本地 Docker Postgres、GitHub Actions Postgres service 或 Neon staging 的正式验证职责。
- 测试默认消费 `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED`；其中 pooled URL 用于模拟运行时读写路径，direct/unpooled URL 用于 migration、reset、bootstrap 和最小 fixture 准备。
- `test` 数据库不属于新的产品部署环境层；应用运行时的环境主路由仍只覆盖 prod / staging / dev，测试入口通过测试脚手架或显式测试配置接入 `test` URL 对。
- 当前阶段将 `test` 数据库语义收敛为单一日常主线：本地使用 Docker Postgres，CI 使用 GitHub Actions Postgres service；两者都必须保证可重复、可清理、可重建，不引入共享远程 test branch，也不要求每次 PR 或每次 test run 自动创建临时数据库 branch。
- 测试执行前必须能够明确 schema 已建立，并完成最小 fixture 准备；测试执行后必须支持清理、重建或 reset，避免依赖历史脏数据继续通过。
- 本地 Docker Postgres 容器生命周期的真正约束是“测试状态干净、隔离、可重复”，而不是机械要求每次都删除容器；允许采用“容器常驻 + 测试前 reset”或“测试前启动、测试后停止/删除”两类策略，但都必须被脚本或文档明确约束，不得完全交由个人习惯决定。
- 测试结束后的本地清理可以是 reset database、truncate / reseed、stop container 或 remove container；无论选择哪种方式，下一次测试运行前都必须能回到干净基线。
- Neon 不再作为本地或 CI 日常测试主库，以避免远程网络波动、共享数据与环境污染影响测试稳定性；它只保留给 staging / preview / production / cutover / 部署验证。
- PGlite 不作为正式运行时数据库，不作为 SQLite -> Postgres cutover 验证底座，也不替代生产化 migration / deploy / release gate 验证链路。

### 2. 数据库驱动与 client 边界

- 用 Postgres 运行时 client 替代当前 `better-sqlite3` 正式路径。
- 计划采用 `postgres` + `drizzle-orm/postgres-js` 作为 Postgres 运行时与脚本驱动，以减少运行时与迁移脚本的驱动分裂。
- `src/server/storage/client.ts` 改为统一导出 Postgres `StorageClient`；SQLite 读取逻辑移动到 `scripts/db/import-sqlite.ts` 或等价迁移工具目录，不进入 Next.js 运行时 bundle。
- pooled / direct URL 边界固定如下：
  - **pooled URL**: Next.js 运行时请求、后台页面读写、管理 API、对外字幕 API
  - **direct / unpooled URL**: `drizzle-kit` 迁移、DDL、SQLite 数据搬迁、bootstrap、cutover 校验、受控管理脚本

### 3. Postgres schema 基线与 SQLite 数据搬迁

- 当前 SQLite migration 历史不做 1:1 延续；`src/server/storage/migrations/` 重新建立 Postgres 正式基线。
- `schema.ts` 保留 001 的实体语义与命名，但将 SQLite 特定字段表示、pragma 依赖和部分索引写法改成 PostgreSQL 正式表达。
- SQLite 数据搬迁拆成独立步骤：
  1. 读取 SQLite 源数据
  2. 对目标 Postgres schema 做前置校验
  3. 分对象导入必须迁移的数据
  4. 运行迁移后校验
  5. 满足条件后再执行 cutover
- 必须迁移对象：`admin_users`、`admin_invitations`、`providers`、`provider_credentials`、`caller_keys`、`caller_key_rotations`、`admin_action_results`
- 条件迁移对象：`subtitle_search_requests`、`subtitle_download_requests`，是否迁移取决于数据量与运营价值；默认允许保留最近窗口或放弃历史明细
- 不建议迁移对象：活动后台 session；cutover 后统一要求重新登录，更安全且简化迁移边界

### 4. Bootstrap / Seed / 初始化

- 首次环境初始化拆成三类步骤：
  - **schema migration**: 建立 Postgres 表、索引与约束
  - **bootstrap**: 建立系统最小运行前提，例如版本标记、可选系统元数据、管理员初始化状态
  - **seed**: 仅限 dev / staging 的可重复样例数据或测试数据
- `test` 数据库不复用 staging/dev seed 语义；它应拥有独立的 migration、bootstrap、最小 fixture 与 reset 路径，以保证数据库相关测试的隔离和可重复性。
- 本地 Docker Postgres 测试容器可以常驻以提升效率，但常驻不等于长期保留脏状态；测试批次前后的 reset / rebuild / truncate / reseed 责任必须明确。
- production 禁止自动写入演示或测试数据；但必须区分两种初始化路径：
  - **greenfield production**: `schema migration + 必需 bootstrap + 首个管理员初始化`
  - **SQLite cutover production**: `schema migration + 必需 bootstrap + 数据搬迁 + 迁移后校验`，以迁移既有管理员为主，不进入“首个管理员初始化”路径
- staging 允许受控 seed，但不得使用 production 真数据副本，除非有单独脱敏流程
- dev 允许可重复 reset / reseed，用于本地与非生产 Preview 验证
- test 允许在每次测试批次前后执行 reset / rebuild，但不得承载开发预览、发布前验证或生产运维职责
- bootstrap 和 seed 都必须具备幂等性；重复执行不得污染正式数据或重复创建管理员/演示数据。管理员初始化逻辑必须只在“数据库内无管理员且显式 greenfield 模式”时允许执行。

### 5. Vercel 部署与发布门禁

- Vercel 只负责应用构建、部署和运行时环境注入；不在 build/start 中隐式执行数据库 migration。
- 构建前/构建时：只允许类型检查、API 文档构建、前端构建和静态校验，不执行写数据库动作。
- 运行前：数据库必须已经由受控 workflow 迁移到目标版本，否则实例应以未就绪失败状态启动。
- 部署后：执行 smoke gate，验证后台登录、关键管理接口、对外 API 与健康状态。
- migration 执行方式：
  - local dev：手工运行 `pnpm db:migrate`、`pnpm db:bootstrap`、可选 `pnpm db:seed:dev`
  - staging / production：通过 GitHub Actions 或等价受控发布工作流，使用 direct URL 执行 migration 与 cutover 校验
- 生产发布必须把“数据库变更”和“应用发布可用性确认”拆成两个可审计步骤，中间保留失败中止点

### 6. 回归与兼容

- 保持 Next.js + TypeScript + pnpm 主链路不变
- 保持 OpenAPI 真源、Orval 生成与 Scalar 文档入口不变；必要时只调整服务器 URL、环境说明或就绪状态相关描述
- 保持既有后台页面与管理 API 行为不变；若数据库错误导致未就绪，只允许新增清晰的失败/未就绪反馈
- 保持 001 已有测试与回归链路可继续运行；新增 Postgres 迁移与环境解析测试不能替代原有产品主链路回归
- 保持测试分层边界清晰；PGlite 的定位仅为快速数据库单测层，日常真实数据库测试主线固定为本地 Docker Postgres 与 GitHub Actions Postgres service，Neon 仅承担环境与发布验证职责

## 计划中的文档与脚本改动

- **必改脚本**: `package.json` 中的 `db:generate`、`db:migrate`、`db:check` 将切换到 Postgres 目标；新增 `db:bootstrap`、`db:seed:dev`、`db:seed:staging`、`db:import:sqlite`、`db:validate:cutover`
- **本地测试执行基线**: 需要在脚本或文档中明确 Docker Postgres `test` 容器的启动、可用性检查、prepare/reset 与测试后清理策略，至少覆盖“容器常驻 + 测试前 reset”和“测试前启动、测试后停止/删除”两种允许路径。
- **必改配置**: `drizzle.config.ts`、`src/lib/env.ts`、Vercel 环境变量、GitHub Actions secrets
- **可选文档补充**: 仅当页面需要最小未就绪提示时更新相关 page spec；否则不改 `DESIGN.md` 与页面规范

## 复杂度追踪

| 例外项 | 必要原因 | 为何拒绝更简单方案 |
|-----------|------------|-------------------------------------|
| Postgres 新 migration 基线 | SQLite 与 Postgres 运行语义不同，且当前 feature 明确不要求继承 SQLite migration 历史 | 继续沿用 SQLite 历史会把旧方言与新方言混在一起，增加迁移风险与长期维护成本 |
| 运行时 pooled / direct 双 URL | Vercel 运行时与数据库 DDL / cutover 的连接模式不同 | 只保留单一 URL 会让运行时和迁移脚本在连接边界上互相污染 |
| Vercel 与 migration workflow 分离 | 必须避免在构建/启动期隐式改库 | 把 migration 塞进 Vercel build/start 会让发布失败点不可控、不可审计 |
