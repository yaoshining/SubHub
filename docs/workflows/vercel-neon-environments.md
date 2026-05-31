# Vercel / Neon 环境映射手册

## 环境映射

| 场景 | 部署环境 | 数据库 tier | 平台注入 |
| --- | --- | --- | --- |
| `main` | Vercel Production | prod | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` |
| `preview` | Vercel Preview | staging | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` |
| `preview/*`、`feature/*`、`agent/*` | Vercel Preview | dev | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` |
| 本地 `NODE_ENV=development` | local | dev | `DEV_DATABASE_URL` + `DEV_DATABASE_URL_UNPOOLED` |

应用层只校验部署身份与当前注入的单一 URL 对，不在 prod / staging / dev 多套数据库 URL 之间自行路由。

## Vercel 环境变量分组

1. **Production**
   - 绑定 `main`
   - 注入 prod 的 `DATABASE_URL`
   - 注入 prod 的 `DATABASE_URL_UNPOOLED`
2. **Preview**
   - 默认给 `preview` 分支注入 staging URL 对
   - 为其他 `preview/*`、`feature/*`、`agent/*` 分支覆盖为 dev URL 对
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
- `VERCEL_ENV=preview` 时，`VERCEL_GIT_COMMIT_REF` 必须是 `preview`、`preview/*`、`feature/*` 或 `agent/*`
- 缺少 `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 时，实例必须失败
- 本地 development 缺少 `DEV_DATABASE_URL` / `DEV_DATABASE_URL_UNPOOLED` 时，实例必须失败
- 运行时请求使用 pooled `DATABASE_URL`
- migration / bootstrap / cutover 使用 direct `DATABASE_URL_UNPOOLED`
