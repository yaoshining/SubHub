# Neon Postgres + Vercel 运行时迁移 - 数据模型

## RuntimeEnvironment

**用途**: 表示应用当前所处的运行身份，用于决定数据库目标、部署门禁与初始化策略。

**字段**:
- `deploymentProvider`: 固定为 `vercel` 或 `local`
- `vercelEnvironment`: `production` | `preview` | `development` | `none`
- `gitBranch`: 当前部署对应分支名；本地可为空
- `resolvedTier`: `production` | `staging` | `development`
- `isPreviewDeployment`: boolean
- `requiresDirectMigrationGate`: boolean

**验证规则**:
- `main` 必须解析为 `production`
- `preview` 分支必须解析为 `staging`
- 其他命中仓库级 Preview 分支白名单的分支 `preview/*`、`feature/*`、`agent/*`、`copilot/*`、`fix/*`、`chore/*`、`renovate/*` 必须解析为 `development`
- 本地 development 必须解析为 `development`
- 不在仓库级 Preview 分支白名单内的 Preview 部署必须直接失败
- 若无法解析唯一 tier，系统必须失败而不是回退到默认数据库

## DatabaseTarget

**用途**: 描述一个 Neon 数据库目标及其连接边界。

**字段**:
- `tier`: `production` | `staging` | `development`
- `pooledUrl`
- `directUrl`
- `provider`: 固定为 `neon`
- `writeAllowed`: boolean
- `seedAllowed`: boolean

**验证规则**:
- 运行时请求只能使用 `pooledUrl`
- migration、DDL、数据搬迁、bootstrap 和 cutover 校验只能使用 `directUrl`
- `production` 的 `seedAllowed` 必须为 `false`

## PostgresBaseline

**用途**: 描述 Postgres 正式 schema 基线及其版本状态。

**字段**:
- `schemaSourcePath`: `src/server/storage/schema.ts`
- `migrationPath`: `src/server/storage/migrations/`
- `baselineVersion`
- `appliedAt`
- `driftStatus`: `clean` | `drifted` | `unknown`

**验证规则**:
- Postgres baseline 必须独立于 SQLite 历史 migration 建立
- drift 校验失败时不得继续 cutover

## LegacySqliteSource

**用途**: 表示 cutover 阶段的 SQLite 旧数据源。

**字段**:
- `path`
- `exists`
- `readOnly`
- `snapshotCreatedAt`
- `backupLocation`

**验证规则**:
- 仅在数据搬迁阶段使用
- 生产 cutover 前必须存在可恢复备份或快照

## DataMigrationScope

**用途**: 表示哪些对象必须迁移、条件迁移或不迁移。

**字段**:
- `requiredEntities`: `admin_users`、`admin_invitations`、`providers`、`provider_credentials`、`caller_keys`、`caller_key_rotations`、`admin_action_results`
- `conditionalEntities`: `subtitle_search_requests`、`subtitle_download_requests`
- `excludedEntities`: `active_admin_sessions`
- `retentionWindow`: 可选请求记录保留窗口

**验证规则**:
- `requiredEntities` 必须全部完成数量与语义校验
- `conditionalEntities` 必须显式记录“迁移”或“放弃”的决策
- `excludedEntities` 不得被误判为遗漏

## BootstrapState

**用途**: 表示一个环境是否已完成最小可运行初始化。

**字段**:
- `schemaReady`: boolean
- `bootstrapReady`: boolean
- `seedState`: `not_applicable` | `pending` | `applied`
- `adminInitializationState`: `migrated` | `required` | `completed`
- `lastValidatedAt`

**验证规则**:
- production 必须是 `seedState = not_applicable`
- staging / development 允许 `seedState = applied`
- 任一状态未完成时，实例不得标记为可用
- `adminInitializationState = required` 只表示当前仍处于无管理员的 greenfield 阶段；只有显式允许首个管理员初始化时，才允许转为 `completed`
- 当已存在管理员（无论来源于首个初始化还是受控导入）时，后续重复初始化必须被拒绝
- 当前阶段的 bootstrap 状态可以由受控脚本即时计算并输出，不强制要求另建持久化状态表

## ReleaseCutover

**用途**: 表示一次从 SQLite 到 Neon Postgres 的受控切换窗口。

**字段**:
- `targetTier`: 通常为 `production`
- `precheckStatus`: `pending` | `passed` | `failed`
- `schemaMigrationStatus`: `pending` | `passed` | `failed`
- `dataImportStatus`: `pending` | `passed` | `failed`
- `postValidationStatus`: `pending` | `passed` | `failed`
- `applicationPromotionStatus`: `pending` | `passed` | `blocked`
- `rollbackDecision`: `not_needed` | `required`

**验证规则**:
- 只有 `precheckStatus`、`schemaMigrationStatus`、`dataImportStatus` 和 `postValidationStatus` 全部通过时，才能允许应用进入 promotion
- 任一阶段失败都必须阻止环境被视为健康可用
