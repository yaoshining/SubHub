# 功能规格: Neon Postgres + Vercel 运行时迁移

**功能分支**: `002-migrate-neon-vercel`

**创建日期**: 2026-05-31

**状态**: Draft

**输入**: 用户描述: "请为 SubHub 新建一个独立 feature spec，主题是：数据库迁移到 Neon Postgres，部署环境采用 Vercel，保持当前 MVP 功能范围不变，收敛运行时、环境管理、数据库迁移、初始化与部署流程。"

## 功能身份与可追溯性 *(mandatory)*

- **Feature ID**: `002`
- **Spec 目录**: `specs/002-migrate-neon-vercel/`
- **主分支**: `002-migrate-neon-vercel`
- **主 Issue**: `待创建：002 运行时迁移主追踪 issue`（不得复用 `001-mvp-admin-console` 或 `#3`）
- **Task Issue 策略**: 先完成 `spec -> plan -> tasks`，确认基础设施迁移边界后再决定是否拆分 task issues；不得与 `001-mvp-admin-console` 混批同步

## 设计上下文 *(mandatory)*

### 设计来源

- **全局设计系统**: `DESIGN.md`
- **共享布局规范**: `docs/layouts/admin-layout.md`
- **页面规范**: `docs/pages/login.md`、`docs/pages/dashboard.md`、`docs/pages/providers.md`、`docs/pages/provider-detail.md`、`docs/pages/api-keys.md`、`docs/pages/users.md`、`docs/pages/settings.md`
- **功能特定设计工件**: `specs/001-mvp-admin-console/spec.md`、`specs/001-mvp-admin-console/plan.md`、`specs/001-mvp-admin-console/tasks.md`、`specs/001-mvp-admin-console/data-model.md`、`specs/001-mvp-admin-console/database-design.md`、`docs/decisions/neon-vercel-runtime.md`

### 设计范围

- **受影响页面**: 现有 MVP 全部后台页面与对外 API 入口都在运行时迁移影响面内，但本 feature 不扩大其页面职责、模块边界或 UX 范围
- **新增页面**: None
- **对设计系统的影响**: 复用既有 `DESIGN.md`、共享布局与页面规范；本 feature 不引入新的系统级视觉规则

### 设计约束

- 本 feature MUST 保持 `001-mvp-admin-console` 已定义的产品能力、页面结构、API 契约范围和 UX 语言不变。
- 本 feature MUST 聚焦运行时、环境管理、数据库迁移、初始化与部署流程，不得借机扩张 Users、Access Control、Providers、API Keys 或 Settings 的产品职责。
- 本 feature MAY 补充测试专用 `test` 数据库语义，但该语义只服务数据库相关测试隔离，不构成新的产品能力，也不构成新的正式部署环境层。
- 若迁移导致页面或 API 的可见行为发生变化，该变化 MUST 仅限于运行环境、初始化、错误提示或就绪状态表达，不得引入新的产品工作流。
- 实现 MUST 继续遵循 `DESIGN.md`、`docs/layouts/admin-layout.md` 与既有 page spec；若无需变更设计规则，则不得更新这些文档的功能边界。

## 用户场景与测试 *(mandatory)*

### 测试分层策略

- `mock / no-db`：用于纯逻辑快速单测，不验证真实数据库语义。
- `PGlite`：用于快速数据库单测层，覆盖少量 repository / service 层数据库行为，作为比 mock 更真实、比真实 Postgres 更快的测试层。
- `本地 Docker Postgres`：作为本地真实数据库测试主线，负责本地 migration、integration、contract、db tests，以及 reset / migrate / seed / 验证闭环。
- `GitHub Actions Postgres service`：作为 CI 真实数据库测试主线，负责每次 CI run 的临时干净数据库、migration、integration、contract 与 db tests。
- `Neon`：仅用于 staging / preview / production / 部署验证层，负责环境映射、发布前验证与正式部署验证。

当前结论：PGlite 已完成最小试点验证，可作为 SubHub 的“快速数据库单测层”，但它只服务于快速数据库单测，不作为正式运行时数据库，也不替代本地 Docker Postgres、GitHub Actions Postgres service 或 Neon staging / deploy verification 链路。Neon 不再作为本地或 CI 日常测试主库，以避免远程网络波动、共享数据与环境污染影响测试稳定性。

### 用户故事 1 - 生产环境可稳定运行当前 MVP (Priority: P1)

作为 SubHub 的维护者，我希望当前 MVP 可以在 Vercel 上连接 Neon Postgres 稳定运行，从而不再依赖 SQLite 文件和单机部署约定作为正式上线前提。

**优先级原因**: 这是本 feature 的核心价值；若 production 运行基线不成立，其余 preview、development 和迁移流程都没有交付意义。

**独立测试**: 在不改变既有产品范围的前提下，将当前 MVP 部署到 production 环境并完成数据库连接、migration、初始化和主要后台/对外 API 验证，可独立验证正式运行闭环。

**验收场景**:

1. **Given** `main` 分支触发生产部署，**When** 部署连接 production 数据库并完成所需初始化，**Then** 当前 MVP 后台页面和对外 API 可在 production 环境中正常运行。
2. **Given** production 环境存在合法数据库连接与已迁移 schema，**When** 管理员访问登录、控制台页面和现有管理 API，**Then** 系统行为与 `001-mvp-admin-console` 定义保持一致。
3. **Given** production 数据库连接配置错误或缺失，**When** 部署或运行开始，**Then** 系统明确暴露不可运行状态，并阻止错误地把实例视为已就绪。

---

### 用户故事 2 - Preview 与 Development 具有稳定且可区分的环境映射 (Priority: P2)

作为维护者，我希望仓库级 `preview` 分支、普通 Preview 分支白名单以及本地 development 都有清晰且稳定的数据库映射策略，从而避免 preview、dev 和 production 串库。

**优先级原因**: 一旦环境映射不清晰，迁移 feature 会引入最高等级的运行风险，即使 production 可部署也不能安全协作。

**独立测试**: 分别在 `preview` 分支、其他非生产分支和本地 development 验证数据库目标解析、初始化与基础功能可用性，可独立证明环境拓扑成立。

**验收场景**:

1. **Given** `preview` 分支触发部署，**When** 系统解析环境目标，**Then** 它只连接 staging 数据库而不访问 production 或 dev 数据库。
2. **Given** 其他命中仓库级 Preview 分支白名单的分支（`preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*`）触发 Preview 部署，**When** 系统解析环境目标，**Then** 它默认连接 dev 数据库。
3. **Given** 本地 development 运行，**When** 开发者启动应用并执行数据库相关流程，**Then** 本地实例默认连接 dev 数据库，而不是回退到生产数据库或继续把 SQLite 视为正式基线。
4. **Given** 数据库相关单测、集成测试、契约测试或 CI 真实数据库校验运行，**When** 测试解析数据库目标，**Then** 它只连接独立 `test` 数据库，而不复用 dev、staging 或 production 数据库。

---

### 用户故事 3 - SQLite 历史数据迁移不纳入当前 002 交付范围 (Priority: P3)

作为维护者，我希望 002 迁移线明确以 Neon Postgres 作为唯一正式数据基线，而不是继续为 SQLite 历史数据导入、cutover 或回滚设计实施目标，从而让当前阶段聚焦正式接入、初始化与环境治理。

**优先级原因**: 当前项目尚未正式上线，SQLite 只是 MVP 早期临时实现基线；若继续把历史数据迁移写成活跃交付目标，会放大范围并误导后续实现。

**独立测试**: `spec.md`、`plan.md`、`tasks.md`、`quickstart.md` 与相关 issue 边界一致表达：当前不要求将 SQLite 历史数据迁入正式环境，Postgres baseline 独立成立。

**验收场景**:

1. **Given** 当前仓库仍保留 SQLite 历史实现痕迹，**When** 维护者查看 002 迁移线文档，**Then** 文档会明确说明这些内容只作为历史实现参考，而不是当前正式交付输入。
2. **Given** 团队准备推进 v0.2.0 的 Neon / Vercel 迁移，**When** 拆分 issue、plan 或 tasks，**Then** 不再把 SQLite 数据导入、cutover 校验或回滚编排作为必须完成的实施目标。
3. **Given** Postgres schema baseline 与运行时接入已经建立，**When** 维护者评估当前是否具备上线前基础条件，**Then** 不需要以“先完成 SQLite 历史数据迁移”为前提才判定主线成立。

---

### 用户故事 4 - 初始化、migration 与发布流程可重复执行 (Priority: P4)

作为维护者，我希望数据库初始化、migration 执行、seed/bootstrap 和部署发布流程有明确责任边界，从而让团队可以重复执行上线、preview 验证和本地恢复，而不是依赖隐式手工步骤。

**优先级原因**: 这是把运行路线从“能跑一次”提升到“可持续发布”的关键条件。

**独立测试**: 分别验证首次环境初始化、已有环境迁移、重复执行 migration 和部署前后检查，可独立证明发布流程具备可操作性。

**验收场景**:

1. **Given** 一个新的 dev 或 staging 数据库，**When** 执行初始化流程，**Then** schema、基础 bootstrap 和后续应用启动顺序清晰且可重复。
2. **Given** 一个已经存在 schema 的环境，**When** 重复执行 migration 流程，**Then** 系统不会错误重置数据，也不会把测试数据混入正式环境。
3. **Given** 团队准备生产发布，**When** 执行受控 migration 与部署流程，**Then** 可明确区分数据库变更、应用发布和发布后验证的责任边界。

---

### 边界场景

- 当 `main`、`preview`、普通 Preview 白名单分支或本地 development 的数据库映射发生冲突时，系统必须拒绝以不明确目标继续运行。
- 当 Preview 部署分支不在仓库级白名单内时，系统必须直接报错，而不是静默回落到 dev 数据库。
- 当 Vercel 环境变量缺失、名称错误或引用了错误环境数据库时，系统必须明确暴露配置失败，而不是静默回退。
- 当 Postgres migration 已部分执行但验证失败时，系统必须明确阻止应用将该环境视为健康可用。
- 当 production 迁移尚未执行完成时，应用不得以“仅读模式”或“局部可用”误导维护者进入不一致状态。
- 当 preview/staging 数据包含演示或测试数据时，系统必须避免该数据通过错误配置流入 production。
- 当本地 development 需要使用 dev 数据库时，系统必须避免误连 production 数据库。
- 当数据库相关测试或 CI 真实数据库校验运行时，系统必须拒绝回落到 dev、staging 或 production 数据库。
- 当本地真实数据库测试开始前，若 Docker Postgres `test` 容器未运行或未就绪，测试流程必须先显式启动或恢复该容器，而不是在不可用状态下继续执行。
- 当 `test` 数据库中遗留历史脏数据、旧 schema 或未清理 fixture 时，测试流程必须支持 reset、重建或最小 fixture 重置，而不是依赖脏状态继续通过。
- 当本地真实数据库测试结束后，若选择保留容器常驻，系统仍必须通过 reset、truncate/reseed 或等价受控步骤恢复干净基线；不得把长期脏状态留给下一次测试处理。
- 当使用 pooled 与 unpooled 数据库连接时，系统必须对它们的职责边界做明确区分，避免在不适合的流程中复用错误连接。
- 当未来引入每个 PR 独立数据库 branch 时，现有三层环境模型必须仍然成立，而不是被当前命名或配置方式锁死。

## 需求 *(mandatory)*

### 功能需求

- **FR-001**: 系统 MUST 将当前 MVP 的正式运行数据库基线从 SQLite 切换为 Neon Postgres。
- **FR-002**: 系统 MUST 将当前 MVP 的正式部署目标收敛到 Vercel，并以此作为 production 与 preview 的标准部署模型。
- **FR-003**: 系统 MUST 保持 `001-mvp-admin-console` 已定义的产品功能、页面、用户流程、数据语义和对外 API 范围不变。
- **FR-004**: 系统 MUST 遵循仓库级环境映射真源 `docs/runtime/environment-mapping.md`：`main` 对应 Production 与 prod database，`preview` 分支对应 Preview 与 staging database，本地 development 对应 dev database；普通 Preview 分支只有命中仓库级白名单时，才允许映射到 Preview 与 dev database；数据库相关测试与 CI 真实数据库校验使用独立 `test` 数据库，但不作为新的应用部署环境主路由。
- **FR-005**: 系统 MUST 优先通过 Vercel 环境变量与环境分组管理 production、staging 和 dev 的数据库映射，并与仓库级 Preview 分支白名单保持一致，不得依赖部署后手工改连。
- **FR-006**: 系统 MUST 明确定义 production、staging、dev 和 test 四类数据库的职责边界，并防止不同环境在无明确授权时串用同一数据目标。
- **FR-007**: 系统 MUST 将当前 SQLite + Drizzle 的 schema 语义、核心约束与数据库访问约定迁移到适配 Neon Postgres 的正式方案。
- **FR-008**: 系统 MUST 明确需要改造的数据库相关边界，至少包括 schema 真源、migration 目录、数据库 client、Drizzle 配置、环境变量读取与数据库 URL 解析。
- **FR-009**: 系统 MUST 将当前正式交付基线建立在独立的 Postgres schema / migration / bootstrap 路径上，不以 SQLite 历史数据导入为前置条件。
- **FR-010**: 系统 MUST 明确 SQLite 历史数据迁移不属于当前 002 的正式交付范围；Postgres 基线独立建立，且不把 SQLite 时代的 migration 历史作为 1:1 迁移目标。
- **FR-011**: 系统 MUST 定义 bootstrap、seed 和管理员初始化在新环境下的职责边界，明确哪些是首次环境初始化必需步骤，哪些属于可选测试或演示数据。
- **FR-012**: 系统 MUST 定义 production 环境中 migration 的执行策略，并明确它与应用部署、发布确认和回滚判断之间的顺序关系。
- **FR-013**: 系统 MUST 为 pooled 与 unpooled 数据库 URL 定义明确使用边界，使运行时请求路径、迁移流程和运维脚本不会误用同一连接类型。
- **FR-014**: 系统 MUST 定义 Vercel 部署模型下的环境变量策略，包括 production、preview 和 development 所需配置类别与最小必需项；同时为测试与 CI 定义 `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED` 的专用配置语义。
- **FR-015**: 系统 MUST 明确 preview/staging、dev 与 test 的数据策略，区分发布前验证数据、开发测试数据、测试隔离数据与正式生产数据。
- **FR-016**: 系统 MUST 明确测试数据、演示数据、seed 数据和生产数据之间的隔离规则，防止在迁移或部署过程中混淆。
- **FR-017**: 系统 MUST 定义现有 OpenAPI / Orval / Scalar 链路在迁移后的兼容要求，确保当前 API 契约真源、生成代码和文档入口仍然可用。
- **FR-018**: 系统 MUST 定义现有 Next.js、pnpm、Drizzle 与既有 MVP 服务边界在运行时迁移后的兼容约束，避免基础设施迁移迫使产品层重新设计。
- **FR-019**: 系统 MUST 将“未来每个 PR 自动创建独立 Neon database branch”标记为可扩展方向，而不是当前 feature 的强制交付范围。
- **FR-020**: 系统 MUST 保证当前三层环境模型在未来扩展到 PR 独立数据库 branch 时仍可兼容，不得把当前环境命名、数据库解析或初始化流程写死为不可扩展结构。
- **FR-021**: 系统 MUST 定义当环境映射错误、数据库连接异常、migration 失败或初始化不完整时的可识别失败结果，使维护者可以明确判断环境不可运行。
- **FR-021A**: 系统 MUST 对不在仓库级 Preview 分支白名单内的 Preview 部署直接失败；不得静默映射到 dev，也不得对任意 Preview 分支自动放行。
- **FR-022**: 系统 MUST 定义本 feature 与 `001-mvp-admin-console` 的边界：001 继续定义产品范围，002 只定义运行底座迁移，不得在 002 中新增产品能力要求。
- **FR-023**: 系统 MUST 约束数据库相关单测、集成测试、契约测试与 CI 中需要真实数据库行为验证的测试默认连接 `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED`；本地真实数据库测试默认连接本地 Docker Postgres，CI 真实数据库测试默认连接 GitHub Actions Postgres service，并在测试前完成 schema 建立与最小 fixture 准备。
- **FR-024**: 系统 MUST 允许测试流程在结束后执行清理、重建或 reset，使 `test` 数据库保持干净、隔离、可重复的运行基线；测试不得依赖 dev、staging 或 production 中的历史脏数据。
- **FR-025**: 系统 MUST 将当前阶段的测试数据库策略收敛为单一的 `test` 数据库语义：本地日常真实数据库测试走本地 Docker Postgres，CI 日常真实数据库测试走 GitHub Actions Postgres service；不得再并行引入共享远程 test branch、共享远程 test database 或每次 PR 动态创建临时数据库 branch 作为另一条日常主线。
- **FR-026**: 系统 MAY 在数据库相关单测中使用 PGlite 作为快速数据库单测层，但该层 MUST 与正式 Postgres / Neon 验证链路隔离，不得替代本地 Docker Postgres、GitHub Actions Postgres service、Neon staging 或 deploy verification。
- **FR-027**: 系统 MUST 明确 Neon 不再作为本地或 CI 日常数据库测试主库；本地与 CI 日常测试必须优先走本地 Docker Postgres 与 GitHub Actions Postgres service，不得默认连接 dev、staging、prod 或其他共享远程数据库。
- **FR-028**: 系统 MUST 为本地 Docker Postgres 测试容器定义受控生命周期规则：测试前必须确认容器可用并完成 reset / migrate / 必要 seed；测试后必须至少通过 reset database、truncate / reseed、stop container 或 remove container 之一恢复到可重复的干净基线，但不机械要求每次都销毁容器。
- **FR-029**: 系统 MUST 明确本地真实数据库测试的核心要求是“数据库测试状态干净、隔离、可重复”，而不是固定容器销毁策略；允许采用“容器常驻 + 测试前 reset”或“测试前启动、测试后停止/删除”等方式，但不得完全交由个人习惯决定。

### 非功能需求 *(mandatory)*

- **NFR-001 (代码质量)**: Feature MUST 要求运行时迁移相关改动继续遵循 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm db:generate`、`pnpm db:migrate`、`pnpm db:check`、`pnpm api:check` 等门禁，并在正式实现前明确最小执行矩阵。
- **NFR-002 (测试)**: Feature MUST 要求至少覆盖环境映射、数据库 URL 解析、Postgres schema/migration、bootstrap 流程、production/preview/development 可用性验证、本地 Docker Postgres 与 GitHub Actions Postgres service 的真实数据库测试主线、独立 `test` 数据库隔离与 reset 策略、容器可用性与测试后清理规则，以及现有 MVP 回归验证。
- **NFR-003 (UX 一致性)**: Feature MUST 要求迁移后对管理员和外部调用方的可见行为保持与 `001-mvp-admin-console` 一致；若运行时错误暴露方式变化，必须保持错误语义清晰、可识别且不改变产品任务路径。
- **NFR-004 (性能)**: Feature MUST 要求迁移到 Neon Postgres 后，现有 MVP 核心路径性能不低于 001 所定义的基线，且数据库切换不得导致明显的请求挂起或后台页面长时间不可用。
- **NFR-005 (设计保真)**: Feature MUST 声明本次迁移不改变 `DESIGN.md`、共享布局和 page specs 的功能边界；若需要页面提示或状态文案调整，只能作为基础设施迁移的最小表现层变化。
- **NFR-006 (并行隔离)**: Feature MUST 绑定当前 active feature 目录 `specs/002-migrate-neon-vercel`，并确认该 worktree 当前只跟踪 002 基础设施迁移 feature。
- **NFR-007 (Issue 同步范围)**: 后续 tasks 或 issue 同步 MUST 仅面向 `specs/002-migrate-neon-vercel`，不得与 `specs/001-mvp-admin-console` 混批。
- **NFR-008 (测试分层边界)**: Feature MUST 保持测试分层清晰：PGlite 仅用于快速数据库单测层；本地 Docker Postgres 是本地真实数据库测试主线；GitHub Actions Postgres service 是 CI 真实数据库测试主线；Neon 仅保留给 staging / preview / production / deploy / release gate 验证。
- **NFR-009 (本地测试生命周期)**: Feature MUST 保证本地 Docker Postgres 测试容器的使用规范可执行、可文档化、可重复；不允许形成“长期脏测试库”“手动随缘清理”或“默认复用共享数据库”的隐式习惯。

### 关键实体 *(如功能涉及数据请填写)*

- **运行环境配置**: 描述应用处于 production、preview 或 development 的运行身份，以及该身份对应的部署目标、数据库目标和环境变量集合；同时说明测试运行如何映射到独立 `test` 数据库语义。
- **数据库目标**: 描述 prod、staging、dev、test 四类 Neon 数据库的职责边界、使用场景与禁止串用规则。
- **迁移动作**: 描述一次 schema 变更或数据迁移的执行单元，包含目标环境、执行时机、校验要求和失败处理边界。
- **初始化状态**: 描述一个数据库环境是否已完成必需的 schema 建立、bootstrap、管理员初始化与最小可运行条件检查。
- **发布准备状态**: 描述从 Postgres schema baseline、bootstrap 到生产可用性验证之间的受控发布阶段、验证动作和阻断条件。

## 成功标准 *(mandatory)*

### 可度量结果

- **SC-001**: `main` 分支对应的 production 部署可在完成必要 migration 与初始化后稳定运行现有 MVP，且管理后台与对外 API 的核心路径无功能回退。
- **SC-002**: `preview` 分支对应的 Preview 部署可稳定连接 staging 数据库运行，并能完成发布前验证而不访问 production 或 dev 数据库。
- **SC-003**: 其他命中仓库级 Preview 分支白名单的分支（`preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*`）以及本地 development 可稳定连接 dev 数据库运行，且 100% 不会因默认配置误连 production 数据库；非白名单 Preview 分支 100% 会被明确阻断。
- **SC-004**: 002 迁移线相关文档、任务与 issue 边界 100% 不再把“SQLite 历史数据迁移到 Neon”视为当前正式交付要求。
- **SC-005**: production migration 流程具备清晰执行责任与前后校验步骤，维护者可在一次发布窗口内明确判断“可继续发布”或“必须中止切换”。
- **SC-006**: 迁移完成后，现有 MVP 的登录、Dashboard、Providers、Provider Detail、API Keys、Users、Settings、统一字幕查询与下载主路径均可在至少一个 production、一个 staging 和一个 dev 环境完成验证。
- **SC-007**: 数据库相关单测、集成测试、契约测试与 CI 真实数据库校验 100% 使用独立 `test` 数据库运行，不复用 dev、staging 或 production，且测试执行前后都可通过 reset、重建或受控容器生命周期操作恢复干净基线。

## 假设

- `001-mvp-admin-console` 的产品范围、页面职责、数据模型语义和 API 契约范围在本 feature 期间保持稳定，不作为本 spec 的修改对象。
- 当前仓库继续以 Next.js + TypeScript、pnpm、OpenAPI / Orval / Scalar、Drizzle ORM + drizzle-kit 为基础技术栈。
- Neon Postgres 是当前阶段的正式数据库路线，Vercel 是当前阶段的正式部署平台；本 spec 不再比较替代路线。
- 仓库级运行时环境映射与 Preview 分支白名单真源为 `docs/runtime/environment-mapping.md`；`preview` 分支是长期 staging / preview 验证入口，其他命中白名单的普通 Preview 分支默认共享 dev 数据库，而不是各自拥有独立数据库分支。
- 数据库相关测试默认使用统一的 `test` 数据库语义，并通过 `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED` 接入；本地日常真实数据库测试对应本地 Docker Postgres，CI 日常真实数据库测试对应 GitHub Actions Postgres service；当前阶段不引入共享远程 test branch，也不要求每次 PR 或每次测试动态创建临时数据库 branch。
- PGlite 最小试点已证明其适合少量 repository / service 层快速数据库单测，但该结论不改变“本地 Docker Postgres + GitHub Actions Postgres service”作为日常真实数据库测试主线，以及 Neon 作为运行时环境验证与发布验证层的地位。
- 未来可能引入每个 PR 独立数据库 branch，但当前阶段只要求为其保留扩展空间，不要求在本 feature 中交付自动化能力。
- SQLite 相关资产只作为历史实现参考；当前 002 feature 不以导入这些历史数据作为正式交付前提。
- 当前 feature 可以引入运行时和部署层面的必要环境变量调整，但不应重塑产品层认证模型、权限模型或页面信息架构。

## 页面规范更新

- **需更新的既有页面规范**: `None`，除非后续实现发现某些环境/初始化状态提示需要最小化补充说明
- **需新建的页面规范**: `None`
- **是否需要更新 `DESIGN.md`**: `No`，本 feature 不改变系统级视觉与交互规则
