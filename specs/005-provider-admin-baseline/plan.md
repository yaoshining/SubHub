# v0.2.3 Provider Admin Baseline — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 将 Xunlei provider 元数据持久化到 `providers` 表，升级管理台为 multi-provider 视角（OpenSubtitles / Xunlei 共用同一组页面），补齐启停、基础配置编辑与状态查看能力，且不破坏 `v0.2.2` 聚合搜索行为。

**Architecture:** 扩展 `providerTypes` 常量数组 -> 新增 migration（DROP + RECREATE CHECK constraint + 插入 Xunlei 默认行）-> 后端 repository 扩展（status 过滤、config 更新、fallback 校验）-> gateway 消费 DB 元数据（废弃 Xunlei 硬编码路径）-> API 层复用既有路由结构 -> 前端组件按 `provider.type` 自适应渲染。

**Tech Stack:** Drizzle ORM + PostgreSQL + Neon; `providerTypes` 常量数组 + 对应 CHECK constraint; provider-registry 仅保留 adapter 映射; credential pool 按 type 决定是否跳过; OpenAPI / Orval / Scalar 契约链路; pglite + real Postgres 分层测试。

---

## 1. Summary / Scope

### 交付目标

在保留 `v0.2.2` 所有聚合搜索行为不变的前提下：

1. `providerTypes` 常量数组扩展为 `["opensubtitles","xunlei"]`
2. 新增 migration：DROP + RECREATE CHECK constraint + 插入 Xunlei 默认 provider 行 + 追加 `lastHealthCheckedAt` 列
3. provider-repository 扩展：filter by status, update status, update config, fallback 自引用/循环引用校验
4. subtitle-gateway 消费 `providers` 表的 `status`/`priority`/`weight` 等元数据，废弃 callXunlei 的硬编码路径
5. provider-registry 剥离元数据职责，仅保留 provider key -> adapter 映射
6. 管理台 API 在既有路由结构上增强：PATCH 配置保存 / enable / disable 按 type 自适应凭据校验
7. 前端组件按 `provider.type` 自适应：列表 type badge, 详情表单字段差异, credential pool 空态, Xunlei 不显示"新增 Xunlei"入口
8. docs/pages 升级为 multi-provider 视角
9. OpenAPI spec 同步扩展

---

## 2. Existing System Context

### 当前 v0.2.2 / v0.2.1 的 provider 管理现状

| 维度               | OpenSubtitles                                          | Xunlei                                                         |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| `providers` 表     | 有 1 行（bootstrap 创建或首次 create-drawer）          | 不存在                                                         |
| providerTypes enum | `["opensubtitles"]`                                    | 不在 enum 中                                                   |
| 凭据池             | 完整隔离/恢复                                          | 无凭据                                                         |
| gateway 调用路径   | callOpenSubtitles: 读 DB -> credential pool -> adapter | callXunlei: 硬编码 providerId, 不读 DB, 不经过 credential pool |
| 启停               | DB status + enableProvider/disableProvider             | 代码层无启停                                                   |
| 管理台可见         | 可见                                                   | 不可见                                                         |
| provider-registry  | 返回完整 adapter + metadata                            | 返回 adapter + 硬编码元数据                                    |

### 关键兼容性约束

1. **getProviderCandidates 过滤凭据**（`subtitle-gateway.ts ~line 102-110`）：当前 filter 要求 `availableCredentialCount > 0`。Xunlei 无凭据导致被过滤。**必须改为 type-aware：对无凭据的 provider 类型跳过凭据计数检查。**
2. **enableProvider 凭据检查**（`provider-service.ts ~line 98-141`）：当前检查 `availableCredentialCount > 0`。启用 Xunlei 会失败。**必须改为 type-aware 跳过。**
3. **callXunlei 硬编码路径**：当前 gateway ~line 260-298 不读 DB。**必须改为读 DB 路径。**
4. **迁移 002 SQL CHECK constraint**：`"providers_type_check" CHECK ("providers"."type" in ('opensubtitles'))`。**必须在新 migration 中 drop 并 recreate。**

## 3. UX / Page Structure Plan

### `/providers` 列表页结构升级

**当前状态：** 单列 OpenSubtitles provider 列表，带选中行右侧凭据池预览。

**升级后结构示意图：**

```
+---------------------------------------------------+
|  Providers                              [新增]    |
|  +-----------------------------------------------+
|  | [OpenSubtitles] OpenSubtitles              >   |
|  |   status: enabled | lastHealth: OK            |
|  |   priority: 10  weight: 1  concurrency: 3     |
|  +-----------------------------------------------+
|  | [Xunlei]        Xunlei                      >  |
|  |   status: enabled | lastHealth: unknown        |
|  |   priority: 5   weight: 1  concurrency: 1     |
|  +-----------------------------------------------+
|                                           +------+
|  选中 OpenSubtitles 右侧                  |令牌池 |
|                                           |[新增] |
|                                           |       |
|                                           +------+
|                                           +----------------+
|  选中 Xunlei 右侧                        | 无凭据可配      |
|                                           | 该 provider    |
|                                           | 不需要 API Key |
|                                           +----------------+
+---------------------------------------------------+
```

**关键变化：**

- 每行新增 `type` Badge（`Badge variant="secondary"`），文字为 `OpenSubtitles` / `Xunlei`
- 列表按 type 可筛选（Tab 切换或下拉筛选）：`All` / `OpenSubtitles` / `Xunlei`
- "新增"按钮仅触发 OpenSubtitles 创建流（create-provider-drawer）；不暴露"新增 Xunlei"入口
- 选中行后右侧面板按 type 自适应

### `/providers/:providerId` 详情页结构升级

**通用区域（所有 type 共享）：**

- 基本信息：`name`（只读）、`type`（只读 Badge）、`status`（可切换 Switch）
- 策略配置：`priority`、`weight`、`concurrencyLimit`、`cooldownSeconds`（均可编辑）
- `fallbackProviderId`：可选，校验自引用/循环引用
- 健康摘要：`lastHealthStatus`（只读）、`lastErrorSummary`（只读）、`lastHealthCheckedAt`（只读）

**Type 差异区域：**

| 字段/区域            | OpenSubtitles                 | Xunlei                                                  |
| -------------------- | ----------------------------- | ------------------------------------------------------- |
| `rotationEnabled`    | 可编辑                        | 不展示（对 Xunlei 无语义）                              |
| `fallbackProviderId` | 可选（可设为 Xunlei 或 null） | 可选（可设为 OpenSubtitles 或 null）                    |
| 凭据池面板           | 完整 CRUD                     | "无凭据可配"空态 + "该 provider 当前不需要 API Key"说明 |
| "新增凭据"按钮       | 可见                          | 不可见/显式禁用                                         |

**States 矩阵：**

| 状态                | 视觉表现                                    | gateway 行为                         | 管理台可操作       |
| ------------------- | ------------------------------------------- | ------------------------------------ | ------------------ |
| `enabled`           | 绿色 Switch ON                              | 参与调度                             | 可禁用，可编辑配置 |
| `disabled`          | 灰色 Switch OFF                             | 跳过                                 | 可启用，可编辑配置 |
| `degraded`          | 黄色/警告 Switch ON + 警告图标              | 参与调度（调用方可决定是否降级处理） | 可禁用，可编辑配置 |
| `needs_config`      | 红色/提示 Switch OFF + 配置提示             | 跳过，返回 needs_config 错误         | 不可启用，引导配置 |
| empty（无 OS 实例） | 空态页："先添加首个 OpenSubtitles Provider" | OS 不存在，Xunlei 正常               | 可见新增 OS 入口   |

> 注意：`needs_config` 在 v0.2.3 中由代码手动设置，不涉及自动化判定。`degraded` 由 gateway 的 `syncProviderFailureState` 设置在 provider 级别（当前只在 credential 级别，需扩展）。

### create-provider-drawer

**决策：保留 OpenSubtitles-only 创建流。不暴露"新增 Xunlei"入口。**

理由：

1. Xunlei 是单一实例 provider，migration 预置即可
2. UI 暴露"新增 Xunlei"会误导用户认为可以创建多实例
3. `providers` 表的 `(type, name)` unique 约束允许同名同 type 的多行，但 Xunlei 的多实例无实际用例
4. 若未来需要"恢复误删的 Xunlei"，应通过 DB 迁移或运维脚本，而非 UI 创建流

### 列表空态说明

- **场景：** 存在 OpenSubtitles provider 和 Xunlei provider -> 正常列表
- **场景：** OpenSubtitles 被删除（bootstrap 未运行），Xunlei 存在 -> 列表显示 Xunlei，空态文案为"尚未添加 OpenSubtitles Provider，请创建一个"
- **场景：** Xunlei 不存在（migration 未运行或回滚）-> 不应发生，migration 保证始终存在
- **场景：** 两者皆不存在 -> 显示"先添加首个 Provider"空态，并允许新增 OpenSubtitles

---

## 4. Data Model Plan

### providerTypes 扩展（text + CHECK constraint，非原生 Postgres enum）

当前 `schema.ts` 中 `providers.type` 的定义为：

```typescript
// schema.ts:218
type: text("type", { enum: providerTypes }).notNull(),
// schema.ts:240 — CHECK constraint 由 drizzle 的 { enum: } 选项生成
```

对应的 migration 002 SQL：

```sql
CONSTRAINT "providers_type_check" CHECK ("providers"."type" IN ('opensubtitles'))
```

这是 **Drizzle `text({ enum })` + CHECK constraint 模式**，不是原生 Postgres `CREATE TYPE ... AS ENUM`。因此 migration 方案不涉及 `ALTER TYPE`。

**变更方式：**

```diff
- export const providerTypes = ["opensubtitles"] as const;
+ export const providerTypes = ["opensubtitles", "xunlei"] as const;
```

Drizzle 检测到 `providerTypes` 常量数组变更后，生成的 migration 会对 CHECK constraint 做 **DROP + RECREATE**，而非操作原生 enum。若 drizzle-kit generate 的输出不精确，则手写 migration SQL。

### Migration 方向

**新 migration 文件：** `src/server/storage/migrations/003_provider_admin_baseline.ts`

**DDL 步骤（按顺序，均在事务内执行 — 与现有 migration 002 模式一致）：**

```sql
-- 1. 删除旧 CHECK constraint (仅允许 'opensubtitles')
ALTER TABLE "providers" DROP CONSTRAINT IF EXISTS "providers_type_check";

-- 2. 重建 CHECK constraint（允许 'opensubtitles' + 'xunlei'）
ALTER TABLE "providers" ADD CONSTRAINT "providers_type_check" CHECK ("providers"."type" IN ('opensubtitles', 'xunlei'));

-- 3. [范围决策 — 见 §8 确认项 #6] 添加 lastHealthCheckedAt 列
-- ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "last_health_checked_at" timestamp with time zone;

-- 4. 插入 Xunlei 默认行
INSERT INTO "providers" ("name", "type", "status", "priority", "weight", "concurrency_limit", "rotation_enabled", "cooldown_seconds", "fallback_provider_id")
VALUES ('Xunlei', 'xunlei', 'enabled', 5, 1, 1, false, 0, NULL)
ON CONFLICT ("name", "type") DO NOTHING;

-- 5. 为新行设置 last_health_status 默认值
UPDATE "providers" SET "last_health_status" = 'unknown', "last_error_summary" = NULL
WHERE "type" = 'xunlei' AND "last_health_status" IS NULL;
```

> **实现方式推荐：** 由于现有 migration 002 是手写 SQL 文件（非 drizzle-kit generate），建议 003 也采用手写 SQL migration 以精确控制 DDL 顺序，避免 drizzle-kit generate 输出不必要的 DDL（如 column reorder）。

**风险与幂等性：**

| 风险                          | 缓解                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| DROP CONSTRAINT 若不存在      | `IF EXISTS` 确保幂等                                                  |
| ADD CONSTRAINT 在旧行上失败   | 旧行 type 均为 'opensubtitles'，在新约束集合中，成功                  |
| 重复运行 migration            | `IF EXISTS` (constraint) + `ON CONFLICT DO NOTHING` (insert) 确保幂等 |
| constraint 名称必须与现有一致 | `providers_type_check` — 与 migration 002 名称对齐                    |

### Xunlei 默认 provider 行定义

| 字段                  | 默认值               | 理由                             |
| --------------------- | -------------------- | -------------------------------- |
| `name`                | `'Xunlei'`           | 与 provider-registry.ts key 对应 |
| `type`                | `'xunlei'`           | 新 enum 值                       |
| `status`              | `'enabled'`          | 保持与 v0.2.2 行为一致           |
| `priority`            | `5`                  | 中等优先级，低于 OS（10）        |
| `weight`              | `1`                  | 标准权重                         |
| `concurrencyLimit`    | `1`                  | Xunlei 并发限制较低              |
| `rotationEnabled`     | `false`              | Xunlei 无凭据可轮换              |
| `cooldownSeconds`     | `0`                  | 默认无冷却                       |
| `fallbackProviderId`  | `NULL`               | 无默认 fallback                  |
| `lastHealthStatus`    | `'unknown'`          | 尚未执行健康检查                 |
| `lastErrorSummary`    | `NULL`               | 尚无错误                         |
| `lastHealthCheckedAt` | `NULL`（若确认纳入） | 范围决策项 — 见 §8 确认项 #6     |

### 对现有 OpenSubtitles 行的兼容性

- **不修改**任何现有 OpenSubtitles 行
- `lastHealthCheckedAt` 新列为 NULL -- 对 OS 现有行，下次健康检查写回时填充
- 现有 `(name, type)` unique 约束不受影响（Xunlei 行不冲突）

### baseUrl 不落入 DB

**决策：`baseUrl` 不持久化到 `providers` 表。**

理由：

1. `baseUrl` 属于环境配置而非 provider 实例配置
2. 若放入 DB，每个实例都需 baseUrl 字段，增加 migration 复杂度且极少编辑
3. 边界清晰：DB 存放"运行时策略元数据"，代码/环境存放"基础设施地址"
4. 若未来需要管理台可编辑 baseUrl，作为独立 feature 讨论

**边界保持方式：** adapter 内部从环境变量或常量读取 baseUrl，不从 provider 元数据对象消费。

---

## 5. API / Backend Plan

### Provider 列表 API

**现有：** `GET /api/admin/providers` -- 已存在，返回所有 provider 含凭据计数。

**增强点：**

- 支持 `?type=opensubtitles|xunlei` 筛选
- 支持 `?status=enabled|disabled|degraded|needs_config` 筛选
- 返回列表包含 `type` Badge 所需字段

### Provider 详情 API

**现有：** `GET /api/admin/providers/{providerId}` -- 已存在。

**增强点：**

- 确保 Xunlei 的 `credentials` 返回空数组 `[]`
- 返回 `lastHealthCheckedAt`（新字段）

### 启用/禁用 API

**现有：** `POST .../enable` / `disable` -- 已存在。

**需修复的问题：**

```typescript
// enableProvider 当前逻辑 -- 需改为 type-aware
async function enableProvider(providerId: string) {
  const provider = await providerRepository.findById(providerId);
  // 当且仅当 provider.type 需要凭据时才检查
  if (credentialPool.hasCredentials(provider.type)) {
    if ((await credentialPool.countByProvider(providerId)) <= 0) {
      throw new Error("Provider needs at least one credential");
    }
  }
  return providerRepository.updateStatus(providerId, "enabled");
}
```

### 基础配置保存 API

**现有：** `PATCH /api/admin/providers/{providerId}` -- 已存在。

**增强点：**

- PATCH schema 增加 `status` 可选字段
- 对 Xunlei provider 的 PATCH 请求中若包含 `rotationEnabled`，后端静默忽略并返回实际值

### Gateway 消费 DB 元数据

**核心改造：**

```typescript
// getProviderCandidates 改造前：p.availableCredentialCount > 0 (Xunlei 被过滤)
// 改造后：
const candidates = providers.filter((p) => {
  const isActive = p.status === "enabled" || p.status === "degraded";
  if (!isActive) return false;
  if (p.type === "xunlei") return true; // 跳过凭据检查
  return p.availableCredentialCount > 0;
});
```

**callXunlei 改造：** 废弃硬编码路径，改为读 DB 路径：通过 `getProviderCandidates('xunlei')` 获取 provider 元数据后调用 adapter。

### Provider-Registry 职责边界

| 当前职责                     | 保留/移除 | 说明       |
| ---------------------------- | --------- | ---------- |
| provider key -> adapter 映射 | 保留      | 核心职责   |
| Xunlei 元数据常量            | 移除      | 已移至 DB  |
| OpenSubtitles 元数据         | 移除      | 保持一致性 |

### Credential Pool 差异处理

| 操作                       | OpenSubtitles | Xunlei     |
| -------------------------- | ------------- | ---------- |
| `selectProviderCredential` | 正常选择      | 不调用     |
| `markCredentialFailure`    | 正常标记      | 不调用     |
| `markCredentialSuccess`    | 正常标记      | 不调用     |
| 凭据列表                   | 返回凭据行    | 返回空数组 |

> 实现方式：在 credential-pool.ts 中新增 `hasCredentials(providerType)` 方法。

---

## 6. Compatibility Plan

### 对 v0.2.2 聚合搜索 API 的兼容性

| 维度                | v0.2.2 行为          | v0.2.3 行为 | 兼容性                 |
| ------------------- | -------------------- | ----------- | ---------------------- |
| 搜索请求体          | SubtitleSearchInput  | 不变        | 完全兼容               |
| 搜索响应体          | success/partial 语义 | 不变        | 完全兼容               |
| provider_failures[] | 含 OS + Xunlei 信息  | 不变        | 完全兼容               |
| provider 字段       | provider key 字符串  | 不变        | 完全兼容               |
| Xunlei 搜索行为     | 硬编码调用           | DB 驱动调用 | 行为一致（初期值相同） |
| disabled Xunlei     | 始终调用             | 跳过        | 行为变化，但此为新功能 |
| 排序/权重           | 代码层常量           | DB 持久化值 | 初期值相同             |

**保证方式：**

1. Xunlei migration 默认值与 v0.2.2 代码层常量完全对齐
2. gateway 改造后首次运行行为不变
3. disabled provider 跳过是新行为，不影响 v0.2.2 的"一切启用"场景
4. 集成测试验证新旧路径输出一致

### 对既有 OpenSubtitles 管理台流程的兼容性

| 流程          | v0.1.0/v0.2.0 行为     | v0.2.3 行为               | 兼容性               |
| ------------- | ---------------------- | ------------------------- | -------------------- |
| provider 列表 | 单列 OS                | 双列 OS + Xunlei          | 新增行不影响 OS      |
| provider 详情 | OS 字段 + 凭据池       | OS 字段 + 凭据池 + 新字段 | 新字段不影响既有流程 |
| 启用 OS       | 检查凭据 -> enable     | 检查凭据 -> enable        | 完全不变             |
| 配置 OS       | 编辑 priority 等       | 同左 + 可选 status        | 向后兼容             |
| 新增 OS       | create-provider-drawer | 同左                      | 完全不变             |

## 7. Testing Strategy

### 测试分层总览

| 层                       | 工具                              | 覆盖范围                                                                     | 阶段  |
| ------------------------ | --------------------------------- | ---------------------------------------------------------------------------- | ----- |
| 单元测试                 | vitest + mock                     | provider-repository 方法、credential-pool type-aware、service enable/disable | tasks |
| 契约测试                 | vitest + supertest                | admin-providers API contract                                                 | tasks |
| 集成测试 (PGlite)        | vitest + drizzle-pglite           | repository CRUD、type-aware 过滤、status 更新、fallback 校验                 | tasks |
| 集成测试 (real Postgres) | vitest + @neondatabase/serverless | migration DDL、enum 扩展、CHECK constraint 重建、Xunlei 行插入               | tasks |
| E2E/UI 状态              | vitest + testing-library          | provider 列表 type badge、字段自适应、空态/禁态渲染                          | tasks |

### 单元测试覆盖范围

1. **provider-service.test.ts**
   - enableProvider: OS type 凭据>0 成功; OS type 凭据<=0 抛出; Xunlei type 凭据=0 但成功
   - disableProvider: 两种 type 均成功
   - updateConfig: Xunlei type 时 rotationEnabled 被静默忽略

2. **credential-pool.test.ts**
   - `hasCredentials('opensubtitles')` -> true（有凭据）/ false（无凭据）
   - `hasCredentials('xunlei')` -> false（始终）
   - `selectProviderCredential`：OS type 正常选择；Xunlei type 返回 null

3. **subtitle-gateway.test.ts**
   - getProviderCandidates: OS + Xunlei 并存且启用 -> 两者均在候选列表
   - getProviderCandidates: Xunlei disabled -> 仅 OS 在候选列表
   - getProviderCandidates: Xunlei enabled + 0 凭据 -> Xunlei 在候选列表
   - getProviderCandidates: OS enabled + 0 凭据 -> OS 不在候选列表
   - callXunlei: 从 DB 读取 provider 元数据而非硬编码

### 契约测试覆盖范围

**新增：** `tests/contract/admin-providers.contract.test.ts`

- `GET /api/admin/providers` -> 200 + provider 数组含 type 字段
- `GET /api/admin/providers?type=xunlei` -> 200 + 仅 Xunlei provider
- `GET /api/admin/providers/{xunleiId}` -> 200 + 含 type + credentials=[]

### PGlite 可覆盖范围

- provider-repository: findByProviderType, findByStatus, updateStatus, updateConfig, validateFallbackTarget（自引用抛异常、循环引用抛异常）
- credential-pool 的 hasCredentials + selectProviderCredential
- schema 定义的一致性（columns 通过 drizzle 解析与 PGlite 同步）

### Real Postgres 必须覆盖范围

**这些测试不能在 PGlite 中验证，必须用真实 Postgres（Neon 或本地）：**

1. **Migration DDL 验证 — CHECK constraint DROP + RECREATE**
   - 旧 `providers_type_check` constraint 被 drop 后，新 constraint 覆盖 `'opensubtitles', 'xunlei'`
   - 新 constraint 允许旧行（`type='opensubtitles'`）、新行（`type='xunlei'`）
   - 重复运行 migration 幂等（`IF EXISTS` 确保）

2. **CHECK constraint 实际验证**
   - INSERT provider with `type='subhd'` -> 被 constraint 拒绝
   - INSERT provider with `type='xunlei'` -> 成功
   - INSERT provider with `type='opensubtitles'` -> 成功

3. **Xunlei 行插入**
   - migration 运行后 Xunlei 行存在于 `providers` 表
   - `ON CONFLICT (name, type) DO NOTHING` 对重复运行幂等

4. **[条件] 若纳入 `lastHealthCheckedAt` —— 列追加验证**
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 成功
   - 新列默认 NULL，不影响现有数据行

### Migration 风险控制

1. **不在 pglite 上验证 migration** — pglite 不支持真实 Postgres 的 DDL 语义（如 CHECK constraint 在事务内/外的细微差别）。
2. **生产 migration 步骤**：全部在事务内执行（与现有 migration 002 模式一致）。
3. **验证方式**：在 staging 数据库（真实 Postgres）上先用 `BEGIN; ... ROLLBACK;` 验证完整 DDL 序列。
4. **特殊注意**：本 migration 不涉及 `ALTER TYPE`（因为 `providers.type` 是 `text` + CHECK，非原生 enum），因此 **没有** 事务外执行的要求。

---

## 8. Risks / Open Questions

### 已决决策（本 plan 已明确）

| 问题                                | 决策                                                                | 理由                                 |
| ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| Xunlei 是否允许多实例               | 不允许多实例。单一实例                                              | 无实际用例；migration 预置即可       |
| Xunlei 是否暴露"新增"入口           | 不暴露。create-drawer 保持 OS-only                                  | 若未来需要恢复，走运维脚本           |
| 哪些字段对 Xunlei 为只读/不展示     | `rotationEnabled` 不展示；`name`、`type` 全局只读；健康字段全局只读 | rotationEnabled 对无凭据无语义       |
| `baseUrl` 是否进入 DB               | 不进入 DB                                                           | 属于环境配置                         |
| `rotationEnabled` 对 Xunlei 语义    | 无语义 -- UI 不展示，PATCH 静默忽略                                 | 无凭据池，轮换不适用                 |
| `fallbackProviderId` 对 Xunlei 语义 | 有效 -- OS 可 fallback 到 Xunlei；Xunlei 可 fallback 到 OS          | Xunlei 优先级较低，fallback 场景有限 |
| 健康状态写回方式                    | gateway 增强 `syncProviderFailureState`：搜索完成后写回 provider 表 | 当前仅在 credential 级别记录         |
| OS 创建时 type 限制                 | 保留 `z.literal("opensubtitles")`                                   | 与"不暴露新增 Xunlei"一致            |
| 聚合搜索 API 向后兼容               | 完全兼容                                                            | 见 6                                 |
| gateway credential 检查             | type-aware 跳过                                                     | 见 5                                 |

### 留待 Design/Tasks 阶段细化的问题

| 问题                                       | 当前结论                                  | 需 tasks 细化                |
| ------------------------------------------ | ----------------------------------------- | ---------------------------- |
| dead credential 检测触发 provider degraded | gateway syncProviderFailureState 增强范围 | 确定触发条件                 |
| migration 回滚策略                         | 手动删除 Xunlei 行 + revert enum          | deployment runbook 中记录    |
| 前端筛选组件具体实现                       | Tab 切换或下拉筛选                        | tasks 阶段决定               |
| PATCH 静默忽略 vs 返回 400                 | 推荐静默忽略                              | tasks 阶段在 schema 中标注   |
| 健康检查写回时机                           | gateway 搜索后处理                        | 是否在 search() 末尾统一执行 |

### 风险清单

| 风险                                                   | 影响                             | 缓解措施                                                             |
| ------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------- |
| CHECK constraint DROP + RECREATE 未对齐 Drizzle schema | migration 重复运行产生 diff 报警 | 手写 migration SQL 确保精确控制；运行 `drizzle-kit check` 验证一致性 |
| Xunlei ON CONFLICT 插入失败                            | migration 失败                   | ON CONFLICT DO NOTHING 确保幂等                                      |
| 现有 provider 行 cascade 问题                          | 删除 OS 时级联删除 credential    | 验证现有 FK 约束                                                     |
| PGlite 无法覆盖真实 Postgres DDL                       | migration 风险仅生产发现         | Real Postgres 集成测试作为 CI 门禁                                   |
| enableProvider 凭据检查未按 type 修复                  | 启用 Xunlei 永远失败             | 单元测试覆盖；code review 必查                                       |
| getProviderCandidates 遗漏 Xunlei                      | Xunlei 永远不会被调度            | 集成测试验证                                                         |

---

## 附录：进入 tasks 前必须先确认的决策清单

以下决策需要在 tasks 阶段开始前由 reviewer 最终确认。**建议在 plan review 对话中逐条确认后，再进入 tasks 生成。**

1. **[确认] Xunlei 是单一实例 provider，不允许多实例，UI 不暴露"新增 Xunlei"入口**
   - plan 已按照此假设设计。若 reviewer 不同意，需重写 create-provider-drawer + migration。

2. **[确认] `rotationEnabled` 对 Xunlei 不展示，PATCH 请求中静默忽略**
   - 若 reviewer 认为应展示但不能编辑（只读 false），需调整。

3. **[确认] `baseUrl` 不进入 DB，保持环境变量/常量方式**
   - 若 reviewer 认为应进 DB，需追加 migration 列 + 前端编辑 UI。

4. **[确认] 聚合搜索 API 完全向后兼容，不做任何格式变更**
   - 若 reviewer 认为可以接受微调，需明确增加内容。

5. **[确认] gateway `getProviderCandidates` 凭据检查按 type 跳过（Xunlei 不检查凭据）**
   - 这是 v0.2.3 能正常工作的前提。

6. **[待确认] `lastHealthCheckedAt` 是否纳入 v0.2.3 的 schema 扩张**
   - **若纳入：** 追加列 `last_health_checked_at timestamp with time zone` 到 `providers` 表、OpenAPI `Provider` schema、admin detail API 返回体。health 写回逻辑纳入 tasks。这是一个明确的 schema 扩张，需 reviewer 确认在 scope 内。
   - **若不纳入：** migration 不含此列。网关仅写回 `lastHealthStatus`/`lastErrorSummary`，不记录检查时间。健康时间戳留到后续版本。
   - **建议：** 若认为 v0.2.3 的"基础状态可见"不包括时间戳，则暂不纳入；若认为启停/健康摘要中有时间戳更完整，则纳入。plan 已按两种路径预留 DDL 注释。

7. **[确认] create-provider-drawer type selector 为 `opensubtitles` 只读固定值**
   - 不在 UI 上暴露可选 provider type 下拉框。
