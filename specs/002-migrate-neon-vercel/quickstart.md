# Neon Postgres + Vercel 运行时迁移 - Quickstart

## 1. 前置条件

- 已存在 `specs/002-migrate-neon-vercel/spec.md` 与 `plan.md`
- 已准备 Neon 的 prod / staging / dev 三类数据库
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

## 6. 验证

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

## 7. 发布顺序

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