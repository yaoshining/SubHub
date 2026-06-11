# Neon Postgres + Vercel 运行时迁移 - Quickstart

说明：本 quickstart 只提供 002 的执行入口与操作提示。运行时环境映射与 Preview 分支白名单的仓库级真源以 `docs/runtime/environment-mapping.md` 为准；若本文件与仓库级真源冲突，应优先回收本文件中的局部表述。

## 1. 前置条件

- 已存在 `specs/002-migrate-neon-vercel/spec.md` 与 `plan.md`
- 已准备 Neon 的 prod / staging / dev 三类数据库
- 已准备本地 Docker Postgres，作为本地真实数据库测试主线
- 已准备统一的 `test` 数据库语义：本地映射到 Docker Postgres 测试库，CI 映射到 GitHub Actions Postgres service container
- 已准备 Vercel 项目与 Production / Preview / Development 环境
- 当前仓库可能仍保留 SQLite 历史实现资产，但它们不属于当前正式交付前置条件

说明：Neon 不再作为本地或 CI 日常测试主库。日常真实数据库测试默认走本地 Docker Postgres 与 GitHub Actions Postgres service；Neon 仅保留给 staging / preview / production / 部署验证。

本地 Docker Postgres 最小基线：

- 容器名：`subhub-postgres-test`
- 镜像：`postgres:16-alpine`
- 端口：`55432 -> 5432`
- 数据库名：`subhub_test`
- 用户名：`subhub_test`
- 密码：`subhub_test_password`

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
- 其他命中仓库级 Preview 分支白名单的分支 `preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*`，应通过默认 Preview 环境注入 dev 的 `DATABASE_URL` / `DATABASE_URL_UNPOOLED`
- 非白名单 Preview 分支必须直接失败，不允许静默映射到 dev

### 2.3 本地 Development

在 `.env.development.local` 配置：

- `DEV_DATABASE_URL`
- `DEV_DATABASE_URL_UNPOOLED`
- `APP_URL=http://localhost:3000`
- `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`
- `ADMIN_SESSION_SECRET`
- `CALLER_KEY_SECRET`

### 2.4 测试与 CI 数据库

数据库相关单测、集成测试、契约测试，以及 CI 中需要真实数据库行为验证的测试，不得复用 dev / staging / production。

默认主线：

- 本地真实数据库测试默认连接本地 Docker Postgres
- GitHub Actions 真实数据库测试默认连接 Postgres service container
- PGlite 只用于快速数据库单测层
- Neon 不参与本地或 CI 日常测试主库路径

应单独配置：

- `DATABASE_URL_TEST`
- `DATABASE_URL_TEST_UNPOOLED`

约束：

- `DATABASE_URL_TEST` 只用于测试运行时读写路径
- `DATABASE_URL_TEST_UNPOOLED` 只用于测试 migration、bootstrap、fixture 准备、reset 或重建
- 当前阶段 `test` 数据库语义收敛为：本地使用 Docker Postgres 测试库，CI 使用 GitHub Actions Postgres service container，不引入共享远程 test branch，也不要求每次 PR 或每次 test run 自动创建临时数据库 branch
- `test` 数据库必须允许清理、重建或 reset，不得承载开发预览、发布前验证或生产运维职责
- 本地真实数据库测试的核心要求是“状态干净、隔离、可重复”，而不是机械要求每次都销毁 Docker 容器
- 本地允许采用“容器常驻 + 测试前 reset”或“测试前启动、测试后停止/删除”两类策略，但必须通过脚本、命令约定或文档明确，不得完全交由个人习惯处理

当前仓库已在测试入口内置本地 Docker Postgres 默认连接，无需额外创建共享示例文件。
只有在你需要覆盖默认主机、端口、库名或凭据时，才应在本地创建未提交的 `.env.test.local` 或 `.env.test`。

- `pnpm test` 继续作为日常全量测试入口，不负责自动创建本地 Docker Postgres 容器
- `pnpm test:db` 作为真实 Postgres 测试入口，负责创建 / 准备容器、运行数据库相关测试，并在结束后清理测试容器

## 3. 建立 Postgres 基线

1. 安装依赖：`pnpm install`
2. 生成 Postgres migration：`pnpm db:generate`
3. 对目标环境执行 migration：`pnpm db:migrate`
4. 执行 bootstrap：`pnpm db:bootstrap`

说明：

- `pnpm db:bootstrap` 默认只校验并输出当前环境的 bootstrap 状态
- 若是上线前 greenfield 场景，且数据库内仍无管理员，可临时设置 `ALLOW_INITIAL_ADMIN_BOOTSTRAP=true`，并同时提供 `INITIAL_ADMIN_IDENTIFIER`、`INITIAL_ADMIN_DISPLAY_NAME`、`INITIAL_ADMIN_PASSWORD` 后再次执行 `pnpm db:bootstrap`
- 一旦已有管理员，或完成受控导入后，必须关闭 `ALLOW_INITIAL_ADMIN_BOOTSTRAP`

## 4. 非生产 seed

- dev：`pnpm db:seed:dev`
- staging：`pnpm db:seed:staging`
- production：禁止执行 seed

当前最小 seed 规则：

- dev / staging seed 只写入可识别、可重复覆盖的 non-production 占位数据
- seed 使用固定前缀 ID，可通过 reset / truncate / 删除这些固定记录清理
- seed 不负责创建管理员；首个管理员初始化与 seed 分离

## 5. 测试数据库准备与重置

数据库相关测试执行前，应保证 `test` 数据库具备以下条件：

1. Docker Postgres `test` 容器已运行且可连接；若未运行，先按约定命令启动
2. 已使用 `DATABASE_URL_TEST_UNPOOLED` 完成 schema migration
3. 已完成最小 bootstrap 或 fixture 准备
4. 当前库内不存在上一次测试遗留的脏数据、旧 schema 或不可重复使用的状态

推荐流程：

1. 若采用按需启动策略，先启动本地 Docker Postgres `test` 容器，并确认 `DATABASE_URL_TEST` / `DATABASE_URL_TEST_UNPOOLED` 指向本地测试库
2. 运行测试前执行测试数据库 prepare / reset
3. 再运行数据库相关单测、集成测试、契约测试
4. 测试结束后执行清理、重建、reset、stop container 或 remove container 中的受控策略之一，使 test 基线恢复干净

最小命令：

- 启动本地 test Postgres：`pnpm db:start:test`
- 重置 test database：`pnpm db:reset:test`
- 对 test database 执行 migration：`pnpm db:migrate:test`
- 准备本地 test database：`pnpm db:prepare:test`
- 运行本地真实数据库 smoke test：`pnpm test:db`
- 停止本地 test Postgres：`pnpm db:stop:test`

说明：数据库相关测试不得依赖 dev、staging 或 production 中的历史脏数据通过。

本地容器生命周期示例：

- 常驻容器路径：启动一次 Docker Postgres `test` 容器，后续每次测试前执行 prepare / reset，测试后按需保留容器，但不得跳过下一次测试前的干净基线恢复
- 按需容器路径：测试前启动 Docker Postgres `test` 容器并完成 prepare / reset，测试后执行 stop 或 remove；下一次测试仍需重新回到干净基线

补充：本地快速数据库单测可使用 PGlite，但正式 migration 验证、Postgres schema / migration 与部署验证仍必须走“本地 Docker Postgres / GitHub Actions Postgres service + Neon 验证层”路线。

CI 约束：GitHub Actions 中的 migration / integration / contract / db tests 应通过 Postgres service container 获取每次 run 的临时干净数据库，不依赖共享远程测试库。

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
2. 先运行 `.github/workflows/db-migrate.yml` 的 `staging` migration gate
3. 再执行 Vercel Preview 部署
4. 运行 `.github/workflows/deploy-smoke.yml`，以 `target=staging` 或命中白名单分支时的 `target=development` 做最小 smoke gate

说明：

- 普通 Preview 白名单分支不进入 production migration gate
- 当前阶段 deploy smoke 只覆盖最小可达性与公开接口校验；最终 readiness 阻断条件等待 #64 收敛后再接入

### production

1. 先运行 `.github/workflows/db-migrate.yml` 的 `production` migration gate（该 workflow 会先完成 staging migration job，再进入 production job）
2. `db-migrate.yml` 内显式执行 `pnpm db:migrate`
3. `db-migrate.yml` 内显式执行 `pnpm db:bootstrap`
4. 如当前环境尚无管理员，临时开启 `ALLOW_INITIAL_ADMIN_BOOTSTRAP=true` 并提供 `INITIAL_ADMIN_*` 后，再受控执行一次 `pnpm db:bootstrap`
5. 发布/确认 `main` 对应 Production 部署
6. 运行 `.github/workflows/deploy-smoke.yml`，以 `target=production` 执行最小 smoke gate

说明：

- Vercel build / start 不应隐式执行 production migration
- 当前阶段只收敛 migration / bootstrap / 最小 smoke 的顺序边界
- production readiness 的最终阻断语义仍等待 #64 明确后再接入
