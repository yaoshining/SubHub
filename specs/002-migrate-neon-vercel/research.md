# Neon Postgres + Vercel 运行时迁移 - 研究结论

## Decision: 使用分支感知的三层环境解析，而不是手工切库

**Rationale**: 当前 feature 已固定环境映射：`main` -> production、`preview` -> staging、其他 preview/feature/agent 分支 + 本地 development -> dev。由于 Vercel 的 `preview` 环境同时承载 staging 分支和其他非生产分支，运行时必须结合 `VERCEL_ENV` 与 `VERCEL_GIT_COMMIT_REF` 自动解析目标数据库，避免维护者通过手工改连来切环境。

**Alternatives considered**:
- 为每个非生产分支单独维护一套数据库 URL：当前范围过重，不符合本期“只保留 PR 独立数据库 branch 扩展空间”的约束。
- 继续使用单一 preview 数据库：会让 staging 验证与日常开发试验混在一起，违反当前环境策略。

## Decision: 为 Postgres 重新建立正式 migration 基线，而不是搬运 SQLite migration 历史

**Rationale**: `001-mvp-admin-console` 的 SQLite 设计已经为 PostgreSQL 可迁移性做了预留，但这不等于 SQLite 时代的 migration 文件需要原样进入 Postgres 正式链路。更稳妥的方案是保留 schema 语义、命名与约束要求，在 Postgres 上重建正式 baseline migration，再通过单独的数据搬迁流程处理历史数据。

**Alternatives considered**:
- 继续让 Postgres 直接消费 SQLite migration 历史：方言差异、索引写法和 pragma 依赖会让后续维护成本升高。
- 完全手写 Postgres schema 而不复用现有语义：会增加与 001 数据模型脱节的风险。

## Decision: 运行时只使用 pooled URL，migration / cutover 只使用 direct URL

**Rationale**: Next.js 在 Vercel 上的请求流量更适合通过 pooled URL 连接 Postgres，而 migration、DDL、数据搬迁、bootstrap 和校验脚本需要更直接、可控的连接方式。把两者职责分开，可以降低运行时与运维脚本互相干扰的风险。

**Alternatives considered**:
- 所有场景都使用 pooled URL：迁移与数据搬迁阶段的可控性不足。
- 所有场景都使用 direct URL：会把运行时连接管理压力带到 Vercel 请求路径。

## Decision: Vercel 负责部署，数据库迁移通过受控 workflow 执行

**Rationale**: 当前目标是让 production / preview 部署可运行，但不能把数据库切换、migration 和应用构建混为一个不可控步骤。因此 Vercel 负责构建与部署，GitHub Actions 或等价受控流程负责 staging / production 的 migration、cutover 校验与发布门禁。

**Alternatives considered**:
- 在 Vercel build/start 中直接运行 migration：失败点不可审计，且容易把数据库变更和应用构建绑定在一起。
- 完全手工执行生产迁移：风险可控性差，难以形成可重复流程。

## Decision: 首个管理员初始化属于 bootstrap，不属于 seed

**Rationale**: production、staging、dev 三类环境都需要区分“系统已经具备运行前提”与“是否注入测试/演示数据”。首个管理员初始化是系统正式启用的一部分，不应和 dev/staging 的 seed 数据混淆。

**Alternatives considered**:
- 把管理员初始化混入 seed：会让 production 引入不必要的演示数据语义。
- 每次迁移后强制重建管理员：会破坏既有持久化对象的连续性。

## Decision: cutover 后不迁移活动后台 session，统一重新登录

**Rationale**: 活动 session 与旧 cookie、旧 deployment secret 和旧数据库实现紧密相关。对这类会话做跨数据库、跨部署一致性迁移收益低、风险高。更安全的策略是迁移必要管理对象，但在 cutover 后统一要求后台重新登录。

**Alternatives considered**:
- 迁移全部 session：复杂度高，且难以证明跨部署安全性。
- 全量放弃所有历史对象：会丢失必须保留的管理配置与审计价值。

## Decision: 请求记录摘要允许条件迁移，而不是一律强制迁走

**Rationale**: `subtitle_search_requests` 和 `subtitle_download_requests` 的运营价值低于管理员、Provider 和 Caller Key 配置。若数据量较大，强制全量迁移这些记录会显著放大 cutover 复杂度。更合理的做法是允许按保留窗口迁移，或在验证后放弃历史明细。

**Alternatives considered**:
- 所有请求记录一律全量迁移：对 MVP 运行价值提升有限，但显著增加迁移窗口。
- 所有请求记录一律丢弃：可能损失必要的排障上下文，因此保留为条件迁移更合适。