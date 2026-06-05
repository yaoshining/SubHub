# Neon Postgres + Vercel 运行路线决策

## 1. 文档定位

本文档用于记录 SubHub 当前 MVP 从本地 / 单机 SQLite 路线迁移到 Neon Postgres + Vercel 的架构与部署决策。它不是 feature spec，也不重新定义 `001-mvp-admin-console` 的产品范围。

本文档用于支撑后续：

- 基础设施相关 feature spec
- 运行时、环境变量与部署实现
- 数据库迁移、初始化与发布流程设计

当前产品范围仍以 `specs/001-mvp-admin-console/` 为准；本文只回答“在不改变 MVP 功能边界的前提下，SubHub 应以什么运行底座进入可部署阶段”。

## 2. 当前背景

当前仓库已经以 SQLite + Drizzle ORM + drizzle-kit 作为 `001-mvp-admin-console` 的落地基线，并以单实例、自托管、本地开发友好为前提推进 MVP 收口。

该路线在 001 阶段成立，但它主要服务于“先完成产品闭环”，并不适合作为当前目标部署路线的最终形态。随着 MVP 进入收口阶段，SubHub 现在需要优先收敛的是：

- 可持续的云端部署模型
- 明确的 production / preview / development 环境分层
- 可重复执行的数据库 migration 与初始化流程
- 与分支策略对齐的配置与发布约束

在这个上下文下，继续把 SQLite 作为最终部署数据库，会让部署、环境隔离和后续演进成本提前累积到运行期。

## 3. 决策结论

当前阶段采用以下主路线：

- 目标数据库：Neon Postgres
- 目标部署平台：Vercel
- 当前 MVP 的正式运行环境：Neon + Vercel
- 本地开发默认连接 dev 数据库，而不是继续把本地 SQLite 视为最终部署等价环境

同时保留以下边界：

- 不改变 `001-mvp-admin-console` 的产品功能范围
- 不在本阶段实现每个 PR 自动创建独立 Neon database branch
- 但需要在环境模型、命名与迁移策略上为该能力保留扩展空间

## 4. 为什么当前阶段不再把 SQLite 作为最终部署数据库

SQLite 对 001 的价值主要是低门槛、低运维和本地迭代速度；这些前提并不等于它适合作为当前 MVP 的正式部署数据库。

当前不再继续把 SQLite 作为最终部署数据库，原因如下：

1. SQLite 与目标部署拓扑不匹配。
   当前目标部署平台是 Vercel，运行环境更适合连接托管数据库，而不是依赖单机文件路径、持久化目录和实例本地状态。

2. SQLite 不利于环境分层治理。
   本次路线要求明确 production、staging / preview、dev 三类数据库边界，并按分支映射运行。SQLite 更适合单节点本地文件，不适合作为多环境共享与隔离的长期基线。

3. SQLite 会放大部署流程中的隐性状态。
   数据文件位置、备份、迁移顺序、构建产物目录和运行实例目录容易耦合，导致部署成功与否依赖额外手工约定。

4. SQLite 不适合作为后续云端演进的稳定锚点。
   当前已经明确后续环境管理和发布流程要围绕云部署展开，此时继续以 SQLite 为最终部署基线，只会把未来必做的迁移延后到更高成本的阶段。

5. 001 已经为 PostgreSQL 可迁移性做了设计预留。
   现有 `database-design.md` 已明确要求避免依赖 SQLite 宽松语义，并为后续 PostgreSQL 迁移保留约束。既然迁移边界已被设计进来，当前阶段应顺势把正式路线切到 Postgres，而不是继续延用过渡基线。

结论是：SQLite 仍然是 001 阶段的历史实现基线，但不再应被视为 SubHub 当前 MVP 的正式部署终点。

## 5. 为什么选择 Neon，而不是 Supabase / Turso 作为当前主路线

### 5.1 选择 Neon 的原因

Neon 作为当前主路线，核心原因是它和本次目标最对齐：需要标准 Postgres 语义、云环境下清晰的数据库分层，以及后续按分支扩展数据库隔离能力的空间。

当前选择 Neon，基于以下判断：

1. Neon 直接提供标准 Postgres 路线。
   SubHub 当前希望从 SQLite 升级到正式关系型数据库，同时保持 Drizzle / migration / SQL 语义收敛到 PostgreSQL 主线。Neon 在这条路径上最直接，没有额外的平台层抽象负担。

2. Neon 与“未来数据库 branch 扩展”方向天然一致。
   本阶段虽然不实现每个 PR 独立数据库 branch，但已经明确要评估并预留这条路线。Neon 在数据库 branch 模型上的能力，与当前环境策略目标更匹配。

3. Neon 更适合作为运行时基础设施，而不是产品能力平台。
   当前需要的是数据库托管与环境隔离能力，不需要在这一阶段同时引入认证、对象存储、实时订阅等更宽的平台能力。Neon 的职责边界更聚焦。

4. Neon 有利于保持数据库层的可迁移心智。
   当前文档和实现关注点应尽量落在 Postgres、Drizzle、migration、连接管理、部署与回滚，而不是额外的平台特性。这样更利于后续 spec 与实现保持清晰。

### 5.2 当前不选 Supabase 的原因

Supabase 并非不可用，但它不是这次基础设施收敛的最小决策集。

当前不将 Supabase 作为主路线，原因如下：

1. Supabase 的产品面更宽，超出本次决策目标。
   本阶段不需要把认证、存储、Edge Functions、实时能力一起纳入架构决策。若此时选择 Supabase，容易把“数据库迁移决策”扩展成“平台选型决策”。

2. 当前重点是替换运行底座，不是引入一整套 BaaS 能力。
   SubHub 已有明确的应用架构、Next.js 服务边界和 OpenAPI 链路，本阶段更需要的是清晰的 Postgres 托管方案。

3. 对后续 spec 而言，Supabase 会引入更多非本期问题。
   例如是否使用其 Auth、是否依赖平台特定能力、如何处理平台耦合，这些都不是当前必须决策的内容。

### 5.3 当前不选 Turso 的原因

Turso 也不是这次的最佳主路线，因为当前目标已经明确转向 Postgres，而不是继续沿 SQLite 族方案演进。

当前不将 Turso 作为主路线，原因如下：

1. Turso 延续的是 SQLite 路线，不是 Postgres 路线。
   本次目标不是“把 SQLite 托管化”，而是“把正式部署数据库升级到 Postgres”。

2. 当前仓库已经为 PostgreSQL 可迁移性做了显式预留。
   在这种前提下，继续选择 SQLite 系托管方案，会延续类型、约束和运行语义上的双重心智负担。

3. 未来分环境、分分支的数据策略更适合围绕 Postgres 统一。
   既然目标部署与迁移链路都要转向 Postgres，现在继续走 Turso 会让后续再次迁移成为二次工程。

结论是：Neon 不是因为“功能最多”而被选中，而是因为它最贴合当前阶段“以最小额外复杂度切换到正式 Postgres 云部署基线”的目标。

## 6. 为什么选择 Vercel 作为部署平台

Vercel 作为当前部署平台，主要是因为它与当前仓库技术栈、预览环境模型和 MVP 交付节奏最匹配。

当前选择 Vercel，基于以下判断：

1. 与 Next.js 主路径一致。
   当前仓库以 Next.js + TypeScript 为应用基线，Vercel 可以最直接承接构建、预览部署和运行时配置，不需要额外引入自托管平台编排成本。

2. Preview 部署模型天然适合当前分支策略。
   本次已经明确需要区分 production、preview/staging 与 dev。Vercel 对非生产分支的 Preview 部署能力，天然适合承接这一路线。

3. 有利于尽早收敛环境变量与发布流程。
   当前需要明确哪些变量属于 production、preview、development，以及在何时执行 migration、初始化与部署检查。Vercel 能把这些问题收敛到一套统一部署入口。

4. 可以减少当前阶段的基础设施噪音。
   当前重点不是搭建通用容器平台、Kubernetes 或自管 PaaS，而是让 MVP 尽快进入可部署、可验证、可演进状态。Vercel 在这一阶段的路径更短。

结论是：Vercel 是当前阶段的部署收敛工具，而不是永久排他的基础设施承诺。现阶段优先级是稳定交付与环境治理，而不是追求最大平台控制权。

## 7. 环境与数据库映射策略

当前环境策略的仓库级真源已收敛到 `docs/runtime/environment-mapping.md`；本节只保留架构决策摘要，不再作为唯一规则来源。

当前策略摘要如下：

| 应用环境 | 分支 / 来源 | 部署形态 | 目标数据库 |
|------|------|------|------|
| Production | `main` | Vercel Production | production 数据库 |
| Preview / Staging | `preview` | Vercel Preview | staging / preview 数据库 |
| Development | 命中仓库级 Preview 白名单的普通 Preview 分支：`preview/*`、`agent/*`、`feature/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*` | Vercel Preview 或本地开发 | dev 数据库 |
| Local Development | 本地 `pnpm dev` | 本地运行 | dev 数据库 |

这里的关键原则是：

- `main` 只连接 production 数据库
- `preview` 分支只连接 staging / preview 数据库
- 只有命中仓库级 Preview 分支白名单的普通 Preview 分支才默认共享 dev 数据库
- 本地 development 默认也连接 dev 数据库
- 非白名单 Preview 分支必须直接失败，不允许静默映射到 dev

该策略强调“环境身份优先于部署地点”。也就是说，本地运行并不天然代表独立数据库；只要处于 development 语义，就应默认落到 dev 数据库，而不是回退到 SQLite 文件。

## 8. staging / dev / preview 的数据策略

### 8.1 production 数据策略

- production 数据库承载正式运行数据。
- 仅 `main` 对应的生产部署可连接该数据库。
- migration、初始化和高风险变更必须经过显式发布流程控制。

### 8.2 staging / preview 数据策略

- `preview` 分支绑定一个长期存在的 staging / preview 数据库。
- 该数据库用于验证接近生产的 migration、配置、初始化与部署链路。
- 该环境允许使用脱敏测试数据、固定演示数据或受控的集成验证数据，但不应承载 production 真数据副本，除非有明确脱敏与同步策略。
- staging / preview 的目标是验证“这次变更是否可以安全进入 production”，而不是承载所有功能分支的并行试验。

### 8.3 dev 数据策略

- 命中仓库级 Preview 分支白名单的普通 Preview 分支 `preview/*`、`agent/*`、`feature/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*` 默认共享 dev 数据库；非白名单 Preview 分支必须直接失败。
- 本地 development 也默认连接同一个 dev 数据库或其逻辑等价环境。
- dev 数据允许更高频率的重置、清理、seed 与实验性验证。
- dev 数据不要求长期稳定，也不应被当作验收环境。

### 8.4 分支与数据边界原则

- staging / preview 用于“发布前验证”。
- dev 用于“开发与集成试验”。
- production 用于“正式运行”。
- 任何环境都不应通过人工临时改连到其他环境数据库来完成验证。

这样做的目的是避免“部署看似隔离，但数据库实际串用”的隐性风险。

## 9. 是否保留 PR 独立数据库 branch 的扩展空间

保留，但不在当前阶段实现。

当前结论如下：

- 当前阶段不要求每个 PR 自动创建独立 Neon branch
- 后续应允许在不推翻当前环境模型的前提下扩展该能力

因此，本阶段的设计应提前满足以下约束：

1. 不把 dev 数据库命名、连接方式或初始化流程写死成唯一不可拆分形态。
2. 环境变量命名和数据库目标解析逻辑应允许未来按分支注入不同连接串。
3. migration 与 seed 流程应支持在“任意目标数据库”上重复执行，而不是默认绑定单一固定库。
4. 文档与 spec 应把“长期 staging 库”和“未来 PR 独立库”区分为两个层次，不混为一谈。

这意味着当前路线不是否定 PR 独立数据库 branch，而是先以 production / preview / dev 三层模型完成最小可运维闭环，再视团队协作和并行开发压力决定是否升级到更细粒度隔离。

## 10. 对后续 spec 与实现的约束

本文档落地后，后续正式 spec 与实现应遵循以下方向：

1. 数据库正式目标应从 SQLite 切换为 Neon Postgres。
2. 运行时环境应围绕 Vercel 的 production / preview 部署模型设计。
3. 环境变量、数据库连接解析、migration、seed、bootstrap、部署检查应按 production / staging / dev 三层环境收敛。
4. 不应再把 SQLite 文件路径、单机持久化目录或本地文件备份视为正式部署主路径。
5. SQLite 历史实现资产如需保留，只作为参考或归档对象处理，不再作为当前正式交付中的迁移与 cutover 目标。

## 11. 待后续 spec 明确的问题

本文已经确定主路线，但以下问题仍应在后续正式 spec 中明确：

- Neon 生产库、staging 库、dev 库的命名与创建约定
- Vercel 各环境变量分组与 secret 管理方式
- migration 的执行责任边界：本地、CI、部署前还是受控发布任务
- seed / bootstrap 的最小内容：是否包含首个管理员初始化、演示数据或仅基础系统数据
- SQLite 历史实现资产是否需要保留、归档或移除的仓库整理策略
- 是否以及何时升级到 PR 级独立数据库 branch

## 12. 最终结论

SubHub 当前 MVP 已经不再处于“只需本地闭环”的阶段，而是进入“需要稳定部署基线”的阶段。基于当前技术栈、环境策略目标和后续演进方向，正式运行路线应收敛为 Neon Postgres + Vercel。

该决策的核心含义是：

- 001 的产品范围不变
- 正式运行底座从 SQLite / 单机思路切换到 Postgres / 云部署思路
- 当前先完成 production / preview / dev 三层环境闭环
- 未来为 PR 独立数据库 branch 保留扩展空间，但不把它作为本阶段前置条件

这份决策文档可作为后续基础设施 feature spec、部署与迁移方案、环境管理实现的上游依据。
