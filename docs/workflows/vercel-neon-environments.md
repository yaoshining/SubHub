# Vercel / Neon 环境映射手册

本文档是运行手册；仓库级规则真源以 `docs/runtime/environment-mapping.md` 为准。若本文档与仓库级真源冲突，应优先回收本文档中的旧表述。

## 环境映射

| 场景 | 部署环境 | 数据库 tier | 平台注入 |
| --- | --- | --- | --- |
| `main` | Vercel Production | prod | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` |
| `preview` | Vercel Preview | staging | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` |
| 普通 Preview 白名单分支：`preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*` | Vercel Preview | dev | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` |
| 本地 `NODE_ENV=development` | local | dev | `DEV_DATABASE_URL` + `DEV_DATABASE_URL_UNPOOLED` |

应用层只校验部署身份与当前注入的单一 URL 对，不在 prod / staging / dev 多套数据库 URL 之间自行路由。

## Vercel 环境变量分组

1. **Production**
   - 绑定 `main`
   - 注入 prod 的 `DATABASE_URL`
   - 注入 prod 的 `DATABASE_URL_UNPOOLED`
2. **Preview**
   - 默认给 `preview` 分支注入 staging URL 对
   - 仅为命中仓库级白名单的普通 Preview 分支 `preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*` 覆盖为 dev URL 对
3. **Development**
   - 本地通过 `.env.development.local` 提供 `DEV_DATABASE_URL`
   - 本地通过 `.env.development.local` 提供 `DEV_DATABASE_URL_UNPOOLED`

## 本地 development 示例

```dotenv
APP_URL=http://localhost:3000
DEV_DATABASE_URL=postgres://dev-pooled-url
DEV_DATABASE_URL_UNPOOLED=postgres://dev-direct-url
PROVIDER_CREDENTIAL_ENCRYPTION_KEY=replace-with-at-least-32-chars
ADMIN_SESSION_SECRET=replace-with-at-least-32-chars
CALLER_KEY_SECRET=replace-with-at-least-32-chars
```

本地 development 不应直接写 `DATABASE_URL` / `DATABASE_URL_UNPOOLED`，以免误把非 dev 数据库带入本机运行。

## 护栏

- `VERCEL_ENV=production` 时，`VERCEL_GIT_COMMIT_REF` 必须是 `main`
- `VERCEL_ENV=preview` 时，`VERCEL_GIT_COMMIT_REF` 必须是 `preview`，或命中仓库级白名单前缀 `preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*`
- 非白名单 Preview 分支必须直接失败，不允许静默映射到 dev
- 缺少 `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 时，实例必须失败
- 本地 development 缺少 `DEV_DATABASE_URL` / `DEV_DATABASE_URL_UNPOOLED` 时，实例必须失败
- 运行时请求使用 pooled `DATABASE_URL`
- migration / bootstrap / cutover 使用 direct `DATABASE_URL_UNPOOLED`
- 只有显式设置 `ALLOW_INITIAL_ADMIN_BOOTSTRAP=true` 时，才允许执行首个管理员初始化；已有管理员后必须关闭
- `pnpm db:seed:dev` / `pnpm db:seed:staging` 只允许写入 non-production 占位数据，production 永不执行 seed

## 上线前最小初始化顺序

1. 对目标环境执行 `pnpm db:migrate`
2. 执行 `pnpm db:bootstrap`，确认 `schemaReady` / `bootstrapReady`
3. 若是 greenfield 且无管理员，临时启用 `ALLOW_INITIAL_ADMIN_BOOTSTRAP=true` 与 `INITIAL_ADMIN_*` 后再次执行 `pnpm db:bootstrap`
4. dev / staging 如需样例数据，再执行 `pnpm db:seed:dev` 或 `pnpm db:seed:staging`
5. production 路径到此为止；不得再执行任意 seed

## GitHub Actions migration / deploy gate 入口

- `.github/workflows/db-migrate.yml`
  - 当前阶段只收敛最小 migration gate
  - 只允许 `staging` 与 `production`
  - `production` 触发时，必须先完成 `staging` migration job，再进入 production job
  - migration 与 bootstrap 都由 GitHub Actions 显式调用；Vercel build / start 不承担 migration 职责
  - migration 使用 `DATABASE_URL_UNPOOLED` 直连边界，不把 pooled 运行时 URL 当成正式 migration 主路径
- `.github/workflows/deploy-smoke.yml`
  - 当前阶段只提供最小 deploy smoke gate
  - 支持 `development` / `staging` / `production`
  - 仅检查最小公开入口可达性与 bootstrap 状态接口形状，不在本阶段写死最终 readiness / promotion 阻断语义
- `.github/workflows/ci.yml`
  - 至少覆盖 `pnpm typecheck`、`pnpm test`、`pnpm db:check`
  - 覆盖环境映射护栏、URL 边界护栏与 migration 后最小数据库校验

## 当前阶段的最小执行边界

- staging migration 必须先于 production migration
- preview / dev 不在本阶段复用 production migration gate；它们只进入各自的非生产 smoke / 护栏路径
- production migration 失败、bootstrap 基线校验失败或 deploy smoke 失败时，必须阻断后续人工 promotion
- 当前阶段只阻断“migration / bootstrap / 最小 smoke”失败，不在本文件内重新定义 #64 的 production readiness 语义

## GitHub environment / secret 最小约定

- `staging` 与 `production` GitHub environment 都应提供：
  - `DATABASE_URL`
  - `DATABASE_URL_UNPOOLED`
  - `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`
  - `ADMIN_SESSION_SECRET`
  - `CALLER_KEY_SECRET`
- `staging` 与 `production` GitHub environment 变量应至少提供：
  - `APP_URL`

说明：`APP_URL` 供 `pnpm db:bootstrap` 与 deploy smoke 读取；Preview 动态 URL 由调用 `deploy-smoke.yml` 的上游流程显式传入，不在本阶段写死为单一路径。
