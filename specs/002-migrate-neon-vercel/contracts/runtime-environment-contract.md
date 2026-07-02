# 运行环境契约

## 1. 目标

本契约定义 SubHub 在 `002-migrate-neon-vercel` 中的运行环境校验、数据库 URL 责任边界与初始化门禁。它约束平台如何为当前部署注入唯一数据库目标，以及应用如何验证该身份。

仓库级运行时环境映射与 Preview 分支白名单真源以 `docs/runtime/environment-mapping.md` 为准；本契约是 002 对该仓库级规则的实现约束，不单独发明另一套映射规则。

补充说明：本契约同时定义数据库相关测试如何接入独立 `test` 数据库语义，但 `test` 不构成新的产品部署环境层。

## 2. 环境解析规则

### 2.1 校验输入

- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_REF`
- `NODE_ENV`
- 当前部署已注入的 `DATABASE_URL`
- 当前部署已注入的 `DATABASE_URL_UNPOOLED`
- 测试入口可额外注入 `DATABASE_URL_TEST`
- 测试入口可额外注入 `DATABASE_URL_TEST_UNPOOLED`

### 2.2 平台注入规则

| 场景                                                                                                                                         | 平台注入的唯一数据库目标 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `main` -> Vercel Production                                                                                                                  | prod database            |
| `preview` 分支 -> Vercel Preview                                                                                                             | staging database         |
| 其他命中仓库级 Preview 分支白名单的分支 `preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*` -> Vercel Preview | dev database             |
| 本地 `NODE_ENV=development`                                                                                                                  | dev database             |

数据库相关测试与 CI 真实数据库校验不走上述应用运行主路由；它们必须显式连接独立 `test` 数据库。

应用不负责在多套数据库 URL 之间做主路由选择；若平台注入与当前部署身份不一致，应用必须以配置错误失败，不得回退到 SQLite 或其他默认库。

额外护栏：若 `VERCEL_ENV=preview` 但 `VERCEL_GIT_COMMIT_REF` 未命中仓库级 Preview 分支白名单，应用必须直接失败，不得静默映射到 dev database。

## 3. 环境变量契约

### 3.1 当前部署必需项

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `APP_URL`
- `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`
- `ADMIN_SESSION_SECRET`
- `CALLER_KEY_SECRET`

### 3.2 本地 development 可选真源

- `DEV_DATABASE_URL`
- `DEV_DATABASE_URL_UNPOOLED`

本地 development 可以通过 `.env.development.local` 将 `DEV_DATABASE_URL` / `DEV_DATABASE_URL_UNPOOLED` 映射到运行时使用的 `DATABASE_URL` / `DATABASE_URL_UNPOOLED`，但应用层最终仍只消费后一组变量。

### 3.3 测试专用真源

- `DATABASE_URL_TEST`
- `DATABASE_URL_TEST_UNPOOLED`

这组变量只服务数据库相关单测、集成测试、契约测试，以及 CI 中需要真实数据库行为验证的测试。它们不得被 production、preview 或本地 development 的应用运行主路由消费。

## 4. URL 使用边界

- `DATABASE_URL`: 只允许应用运行时请求使用
- `DATABASE_URL_UNPOOLED`: 只允许 migration、bootstrap、seed、SQLite 数据搬迁、cutover 校验脚本使用
- `DATABASE_URL_TEST`: 只允许数据库相关测试的运行时读写路径使用
- `DATABASE_URL_TEST_UNPOOLED`: 只允许数据库相关测试的 migration、bootstrap、最小 fixture 准备、reset、重建和测试校验脚本使用

任何脚本或运行时若使用了错误 URL 类型，都应视为契约违规。

额外约束：数据库相关测试若未显式提供 test URL 对，必须失败，而不是回落到 dev、staging 或 production。

## 5. 初始化门禁

应用在启动前必须满足：

- 目标环境已解析成功
- 目标数据库 URL 完整
- Postgres baseline migration 已应用
- bootstrap 状态满足最小可运行要求

若任一条件未满足，应用必须进入明确的不可用状态，不得假装可服务。

## 6. 测试数据库门禁

数据库相关测试开始前必须满足：

- `DATABASE_URL_TEST` 与 `DATABASE_URL_TEST_UNPOOLED` 已解析成功
- `test` 数据库 schema 已建立
- 最小 fixture 或 bootstrap 状态已就绪
- 当前测试批次具备清理、重建或 reset 能力

若任一条件未满足，测试必须失败，不得借用 dev、staging 或 production 数据库继续执行。
