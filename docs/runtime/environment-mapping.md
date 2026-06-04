# 运行时环境映射与 Preview 分支白名单约定

## 目的

本文档是 SubHub 仓库级运行约定真源，用于统一 Vercel 运行环境、数据库目标与 Preview 分支白名单规则。

后续 feature spec、plan、tasks、agent 指令、review 结论、部署脚本与运行手册，默认都应引用本文档，而不是在各自上下文中重新发明另一套环境映射规则。

## 适用范围

- Vercel Production / Preview 部署
- 本地 development 运行
- 环境映射相关实现、测试、脚本、review 与文档
- 需要判断 `VERCEL_ENV`、`VERCEL_GIT_COMMIT_REF`、数据库目标或部署身份的场景

## 正式环境映射

| 场景 | 运行环境 | 数据库目标 | 说明 |
| --- | --- | --- | --- |
| `main` | `Production` | prod database | 正式生产入口，只允许映射到 prod |
| `preview` | `Preview` | staging database | 固定作为 staging / 发布前验证入口 |
| 本地 development | `Development` | dev database | 本地开发默认只允许连接 dev |
| 普通 Preview 分支白名单 | `Preview` | dev database | 仅对白名单内前缀开放，且只允许映射到 dev |

## Preview 分支白名单

除精确分支 `preview` 之外，其他 Vercel Preview 部署仅允许以下白名单前缀进入 `Preview -> dev database` 路径：

- `preview/*`
- `feature/*`
- `agent/*`
- `copilot/*`
- `fix/*`
- `chore/*`
- `renovate/*`

### 白名单边界

- `preview` 是保留分支，不属于“普通 Preview 分支白名单”；它固定映射到 `Preview -> staging database`。
- 只有命中以上前缀的普通 Preview 分支，才允许进入 `Preview -> dev database`。
- 未命中白名单的 Preview 分支，必须被视为非法部署身份。
- 新增白名单前缀时，必须先更新本文档，再同步实现、测试、脚本与 review 基线。

## 强制护栏

- 非白名单 Preview 分支必须直接报错，不允许继续启动或被视为可用。
- 不允许把非白名单 Preview 分支静默映射到 dev database。
- 不允许任意 Preview 分支自动放行。
- 不允许 `main`、`preview`、本地 development 与普通 Preview 白名单分支之间发生不明确映射。
- 应用层只允许校验“当前部署身份是否匹配当前注入的单一数据库 URL 对”，不应在 prod、staging、dev 多套数据库 URL 之间自行做运行时主路由。

## 约束分工

- 仓库级规则真源：本文档
- 运行手册与操作步骤：`docs/workflows/vercel-neon-environments.md`
- 基础设施迁移 feature 对该规则的依赖：`specs/002-migrate-neon-vercel/`

若运行手册、feature spec、plan、tasks、agent 指令或 review 结论与本文档冲突，应以本文档为准，并回收冲突表述。
