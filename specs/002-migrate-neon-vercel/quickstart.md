# Neon Postgres + Vercel 运行时迁移 - Quickstart

## 1. 前置条件

- 已存在 `specs/002-migrate-neon-vercel/spec.md` 与 `plan.md`
- 已准备 Neon 的 prod / staging / dev 三类数据库
- 已准备独立 `test` 数据库或 test branch，供数据库相关单测、集成测试、契约测试与 CI 真实数据库校验使用
- 已准备 Vercel 项目与 Production / Preview / Development 环境
- 当前仓库仍保留 SQLite 源数据或可恢复备份

## 2. 配置环境变量

### 2.1 Vercel Production

配置：

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `APP_URL`
- `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`
- `ADMIN_SESSION_SECRET`
- `CALLER_KEY_SECRET`

### 2.2 Vercel Preview

配置：

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `APP_URL`
- `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`
- `ADMIN_SESSION_SECRET`
- `CALLER_KEY_SECRET`

说明：

- `preview` 分支对应的 Preview 部署，应通过 Vercel 分支覆盖注入 staging 的 `DATABASE_URL` / `DATABASE_URL_UNPOOLED`
- 其他 Preview 分支，应通过默认 Preview 环境注入 dev 的 `DATABASE_URL` / `DATABASE_URL_UNPOOLED`

### 2.3 本地 Development

在 `.env.development.local` 配置：

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `APP_URL=http://localhost:3000`
- `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`
- `ADMIN_SESSION_SECRET`
- `CALLER_KEY_SECRET`

### 2.4 测试与 CI 数据库

数据库相关单测、集成测试、契约测试，以及 CI 中需要真实数据库行为验证的测试，不得复用 dev / staging / production。

应单独配置：

- `DATABASE_URL_TEST`
- `DATABASE_URL_TEST_UNPOOLED`

约束：

- `DATABASE_URL_TEST` 只用于测试运行时读写路径
- `DATABASE_URL_TEST_UNPOOLED` 只用于测试 migration、bootstrap、fixture 准备、reset 或重建
- 当前阶段优先使用长期存在的 `test` 数据库或 test branch，不要求每次 PR 或每次 test run 自动创建临时数据库 branch
- `test` 数据库必须允许清理、重建或 reset，不得承载开发预览、发布前验证或生产运维职责

## 3. 建立 Postgres 基线

1. 安装依赖：`pnpm install`
2. 生成 Postgres migration：`pnpm db:generate`
3. 对目标环境执行 migration：`pnpm db:migrate`
4. 执行 bootstrap：`pnpm db:bootstrap`

## 4. 可选：从 SQLite 导入历史数据

1. 准备 SQLite 备份
2. 执行导入：`pnpm db:import:sqlite`
3. 执行迁移后校验：`pnpm db:validate:cutover`

说明：SQLite 读取能力应由迁移专用脚本或一次性导入工具承载，不进入正式 Vercel 运行时部署链路。

## 5. 非生产 seed

- dev：`pnpm db:seed:dev`
- staging：`pnpm db:seed:staging`
- production：禁止执行 seed

## 6. 测试数据库准备与重置

数据库相关测试执行前，应保证 `test` 数据库具备以下条件：

1. 已使用 `DATABASE_URL_TEST_UNPOOLED` 完成 schema migration
2. 已完成最小 bootstrap 或 fixture 准备
3. 当前库内不存在上一次测试遗留的脏数据、旧 schema 或不可重复使用的状态

推荐流程：

1. 运行测试前先执行测试数据库 prepare / reset
2. 再运行数据库相关单测、集成测试、契约测试
3. 测试结束后执行清理、重建或 reset，使 test 基线恢复干净

说明：数据库相关测试不得依赖 dev、staging 或 production 中的历史脏数据通过。

## 7. 验证

执行：

- `pnpm typecheck`
- `pnpm test`
- `pnpm db:check`
- `pnpm api:check`

并完成以下 smoke test：

- 后台登录
- Dashboard 摘要
- Provider 列表与详情
- API Keys 列表
- Users 列表
- Settings 就绪状态
- 统一字幕查询与下载主路径

## 8. 发布顺序

### staging / preview

1. 推送 `preview` 分支
2. 运行 staging migration workflow
3. 验证 Preview 部署与 smoke test

### production

1. 确认当前是 **greenfield production** 还是 **SQLite cutover production**
2. 运行 production migration workflow
3. 若为 greenfield：执行 bootstrap + 首个管理员初始化
4. 若为 cutover：执行 SQLite 数据导入 + cutover 校验，不触发首个管理员初始化
5. 发布/确认 `main` 对应 Production 部署
6. 执行 production smoke test