# 功能规格: provider 管理能力补齐基础版（多 provider 管理台视角）

**功能分支**: `005-provider-admin-baseline`

**创建日期**: 2026-06-30

**状态**: Draft

**输入**: 用户描述: "请为 SubHub 启动一个新的 spec，目标版本为 `v0.2.3`。当前 v0.2.2 已完成多 provider 搜索入口模型基础版与 Xunlei provider 后端接入，但管理台无法感知 Xunlei，也无法对已接入 provider 做启停与基础配置。v0.2.3 专门承接 provider 管理能力补齐基础版，让管理台对 OpenSubtitles / Xunlei 等已接入 provider 可见、可启停、可做基础配置与状态查看。同时必须严格区分 v0.2.2 / v0.2.3 / v0.3.0 三个版本的边界。"

## 功能身份与可追溯性 *(mandatory)*

- **Feature ID**: `005`
- **Spec 目录**: `specs/005-provider-admin-baseline/`
- **主分支**: `005-provider-admin-baseline`
- **主 Issue**: TBD（spec review 通过后再创建）
- **Task Issue 策略**: spec review 通过后再进入 `/speckit.plan` 与 `/speckit.tasks`，task issues 延后到 tasks 阶段统一创建（与 `specs/001-mvp-admin-console/` / `specs/004-multi-provider-search/` 同策略，避免在 spec 阶段过早拆分 issue）
- **对应 milestone**: `v0.2.3`（参考 `docs/releases/versioning.md`）
- **scope 标签倾向**: `scope:mvp`（`v0.2.3` 在 versioning.md 中已明确为该 milestone 的核心交付范围）
- **GitHub issue / PR 标签倾向**: issue 至少 `type:feature` + `area:provider` + `area:admin` + `priority:high` + `scope:mvp` + `stage:spec`；PR 在 issue 落地后继承并补充 `area:db`（若触达 migration）

## 版本边界声明 *(mandatory)*

本节为本次 spec 的硬约束。任何 plan / tasks / code 阶段出现与本节冲突的内容 MUST 先回到 spec 层修订。

### `v0.2.2` 已完成（不应在本 spec 中重复实现或扩展）

- 多 provider 聚合搜索入口模型（`SubtitleSearchInput` 聚合请求模型）。
- 迅雷字幕 provider 后端接入（基于 `https://api-shoulei-ssl.xunlei.com/oracle/subtitle`，最少消费 `query` + `languages`）。
- provider 适配层抽象（`provider-registry.ts` 轻量注册表，provider key → adapter 映射）。
- provider 结果归一化（`provider` 字段显式注入；原始字段保留在 `raw`）。
- 单 provider 失败隔离与 `partial` / `success` 响应语义。
- **关键边界**: `v0.2.2` 阶段迅雷 provider 走「不依赖新增 schema 的最小接入路径」：`providers` 表的 `type` enum 仍为 `["opensubtitles"]`，迅雷 provider 的元数据未持久化到 `providers` 表，由代码层 `provider-registry.ts` 硬编码；启用 / 禁用 / 限流 / 冷却仅由代码层配置 / feature flag 决定，不依赖数据库。

### `v0.2.3` 本次范围（本 spec 的唯一对象）

- **管理台层**:
  - provider 列表可见（同一页内承载 OpenSubtitles / Xunlei 等多 provider 实例，**统一 provider 模型**）。
  - provider 基础状态可见（`status` / `lastHealthStatus` / `lastErrorSummary` / `lastHealthCheckedAt` 等基础摘要）。
  - provider 启停（启用 / 禁用开关）。
  - provider 最小基础配置（`priority` / `weight` / `concurrencyLimit` / `cooldownSeconds` / `fallbackProviderId` 等已在 `Provider` 模型中存在但当前由代码层硬编码或未持久化的最小字段）。
  - provider 详情承接（已有 `provider-detail.md` 升级为多 provider 视角）。
- **数据层**:
  - 扩展 `providerTypes` enum: `["opensubtitles", "xunlei"]`。
  - 新增 migration，将 v0.2.2 由 code-layer 接入的 Xunlei provider 元数据持久化到 `providers` 表（保留 `name` / `type` / `status` / `priority` / `weight` / `concurrencyLimit` / `rotationEnabled` / `cooldownSeconds` / `fallbackProviderId` 等最小字段）。
  - 不引入新表；不破坏现有 `providers` / `provider_credentials` / `subtitle_search_requests` 表结构。
- **API 层**:
  - 在 `docs/api/openapi.yaml` 中扩展 provider 管理 API: 列出 provider、查看 provider 详情、启用 / 禁用 provider、保存 provider 基础配置。
  - 现有聚合字幕搜索 API 行为 MUST 不变（`v0.2.2` 边界）。
- **前端层**:
  - 扩展 `docs/pages/providers.md` 与 `docs/pages/provider-detail.md`，承载多 provider 视角；OpenSubtitles / Xunlei 共用同一组页面与组件。
  - 新建 Provider 实例: 保留 `create-provider-drawer` 的 OpenSubtitles 模板化创建流；Xunlei 的「新增 Provider」入口在 plan 阶段评估（详见 §3 用户故事 6 的边界）。
- **明确不做的事**:
  - 不进入字幕资产管理（缓存可见 / 编辑 / 转正 / 状态机）。
  - 不引入新 provider（subhd、字幕库等）；仅完成 OpenSubtitles + Xunlei 的管理台承接。
  - 不做 provider 高级调度（并行调用编排、超时预算、复杂评分、跨 provider 去重、自适应降级、熔断）。
  - 不做第三方 provider 注册中心 / 插件化框架。
  - 不做 AI 字幕处理 / 字幕内容治理。

### `v0.3.0` 未来范围（本 spec 必须显式排除）

- 字幕资产可见（缓存列表 / 详情 / 元数据）。
- 字幕编辑保存 / 转正 / 发布 / 下线。
- 字幕状态机（`pending` / `promoted` / `archived` / `rejected`）。
- 人工导入字幕（手动上传）。
- 字幕审计与基础权限。
- AI 审核 / 清洗 / 改写字幕由 `v0.4.0` 承接。

### 与 `v0.2.2` 的边界对比

| 维度 | `v0.2.2` | `v0.2.3`（本次） |
|------|----------|-----------------|
| 触达范围 | 后端聚合搜索 + provider adapter | 管理台 provider 列表 / 详情 / 启停 / 基础配置 |
| provider 元数据存储 | 仅 OpenSubtitles 走 `providers` 表，Xunlei 走 `provider-registry.ts` code-layer | OpenSubtitles 与 Xunlei 一律持久化到 `providers` 表，`providerTypes` enum 扩展为 `["opensubtitles","xunlei"]` |
| provider 启停 | 仅 code-layer / feature flag | 管理台 UI 可直接切换并持久化 |
| provider 配置 | code-layer 常量 | 管理台可编辑最小基础配置（priority / weight / concurrency / cooldown / fallback） |
| provider 状态可见性 | 不可见 | 可见（status / lastHealthStatus / lastErrorSummary 等） |
| 新增 schema | 不引入 | 引入 migration 扩展 enum + 补齐 Xunlei 行 |
| API 触达 | 仅聚合搜索 API | 新增 provider 管理 API；聚合搜索 API 不变 |

### 与 `v0.3.0` 的边界对比

| 维度 | `v0.2.3`（本次） | `v0.3.0` |
|------|------------------|----------|
| 触达对象 | 上游字幕来源（provider 实例） | 字幕搜索结果（subtitle records / assets） |
| 核心动作 | 启停 provider、配置 provider 调度策略 | 导入 / 缓存 / 编辑 / 转正字幕资产 |
| 数据模型 | 扩展 `providers` 表 enum + 新增 Xunlei 行 | 字幕资产主表（`subtitle_assets` 等） |
| 状态机 | provider 状态（`enabled` / `disabled` / `needs_config` / `degraded`） | 字幕资产状态（`pending` / `promoted` / `archived` 等） |
| 页面 | `providers` / `provider-detail` | 字幕资产列表 / 详情 / 编辑 / 转正（独立 page spec） |

### "代码层接入 / 受限 provider" 模式的去留

- `v0.2.2` 期间曾以"Xunlei 走 code-layer 接入"作为「不引入 schema 变更」的妥协。
- **`v0.2.3` 起，该模式被取消**。OpenSubtitles / Xunlei 统一为同一套 provider 模型（同一张 `providers` 表、同一种 status 语义、同一种启停方式、同一种最小基础配置）。
- `v0.2.3` 不再保留"代码层接入、能力受限 provider"作为产品面特例；若某个 provider 的某个字段当前尚未实现（如 `rotationEnabled` 对 Xunlei 暂未实现），按正常的「未实现字段 / 只读字段」处理（不写入或不开放编辑），而不是把整个 provider 视作受限特例。
- 任何仍依赖 code-layer 行为的能力（如 Xunlei 当前无需 API Key），MUST 走正常的"该 provider 允许空凭据池"语义，而非通过 feature flag 表达。

## 设计上下文 *(mandatory)*

### 设计来源

- **全局设计系统**: `DESIGN.md`（本功能仅在「管理台」场景下触达，沿用既有 token / 组件规则）
- **页面规范**: `docs/pages/providers.md` / `docs/pages/provider-detail.md`（扩展为多 provider 视角）；不新增独立 page spec
- **功能特定设计工件**: 无新增 mockup；本 spec 在 plan 阶段评估是否需要在 Pencil 中追加多 provider 视角示意

### 设计范围

- **受影响页面**:
  - `docs/pages/providers.md`: 升级为多 provider 列表视角；provider 行承载 `type` 区分（OpenSubtitles / Xunlei）。
  - `docs/pages/provider-detail.md`: 升级为多 provider 详情视角；表单字段根据 `type` 适配（OpenSubtitles 有 token 池；Xunlei 当前无 token 池，pool 区域按"无凭据可配"的空状态处理）。
- **新增页面**: None
- **对设计系统的影响**: 无；不引入新 token、新组件、新视觉语言。复用既有 `Card` / `Table` / `Badge` / `Switch` / `Input` / `Select` / `Alert` 等 shadcn/ui 组件；`provider` 类型通过既有 `Badge variant="secondary"` 表达（与现有"Provider 类型标签"对齐）。

### 设计约束

- 实现 MUST 遵循 `DESIGN.md` 中的视觉语言、设计令牌、组件规则与交互基调。
- 页面级结构、模块层级与行为 MUST 遵循 `docs/pages/*.md` 中相关文件；本次 MUST 更新 `providers.md` 与 `provider-detail.md`，不得新建并行 page spec。
- 本规格 MUST 显式标注任何有意偏离既有设计规则的点（详见 §3 用户故事内的"页面例外"标注）。
- 仓库级全局约定（包管理器 `pnpm`、数据库测试分层 `mock / PGlite / Postgres / Neon`、运行时环境映射真源 `docs/runtime/environment-mapping.md`、版本约定真源 `docs/releases/versioning.md`、API 契约链路 `docs/api/openapi.yaml` + Orval + Scalar）以 `.github/copilot-instructions.md` 为真源，本 spec 不重复展开。
- API 契约变更 MUST 以 `docs/api/openapi.yaml` 为真源，并同步 `src/lib/api/generated/`。
- **provider 适配层 MUST 隔离在稳定接口之后**（沿用 `specs/004-multi-provider-search/spec.md` 宪章原则 VI），不得让 provider 元数据表结构泄漏到核心 API。
- **老调用方零改动**: 本次 MUST NOT 引入对现有聚合字幕搜索 API 的 breaking 变更；`v0.2.2` 风格的搜索请求行为 MUST 完全保持。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 管理员在管理台看到所有已接入 provider (Priority: P1)

管理员登录管理控制台，进入「Providers」页面，期望在该页面内一次性看到当前 SubHub 已接入的所有 provider 实例（OpenSubtitles 与 Xunlei），通过统一的列表展示口径理解每个 provider 的存在、类型与基础摘要，而不是去日志或数据库里查询 Xunlei 是否已接入。

**优先级原因**: 这是 `v0.2.3` 最核心的目标。`v0.2.2` 完成后，Xunlei 已在后端可调用，但管理台完全不可见 —— 管理员既无法知道 Xunlei 是否存在，也无法判断它当前是否被使用。该缺口若不补齐，运营层对 provider 健康与配置的感知仍处于盲区。

**独立测试**: 进入 `providers` 列表页，验证页面同时显示 OpenSubtitles 实例与至少一个 Xunlei 实例；每个实例行均展示 `name` / `type`（OpenSubtitles / Xunlei）/ `status` / 最近一次健康摘要 / 行动入口。

**验收场景**:

1. **Given** SubHub 已存在至少一个 OpenSubtitles 实例和一个 Xunlei 实例, **When** 管理员进入 `/providers`, **Then** 列表至少包含这两类 provider 的行，且每行展示 `type` 标签（如 `Badge variant="secondary"`）以区分。
2. **Given** OpenSubtitles 与 Xunlei 实例均已配置, **When** 管理员进入 `/providers`, **Then** 列表行的选中 / 池检查区 / 进入详情等动作均按当前选中 provider 类型自适应（OpenSubtitles 选中后右侧展示凭据池；Xunlei 选中后右侧展示「无凭据可配」空状态说明）。
3. **Given** 当前不存在任何 OpenSubtitles 实例（Xunlei 始终由 `v0.2.3` migration 预置，必存在）, **When** 管理员进入 `/providers`, **Then** 页面显示既有 empty state（沿用 `providers.md` 中"先添加首个 OpenSubtitles Provider"的空态文案），并允许通过新增抽屉新建 OpenSubtitles 实例；Xunlei 始终可见，其「无凭据可配」空态按 §3 用户故事 6 处理。

---

### 用户故事 2 - 管理员启用 / 禁用 provider (Priority: P1)

管理员在 provider 详情页或列表行内对某个 provider 实例执行启用 / 禁用操作。禁用后，SubHub 聚合搜索 SHOULD 不再调用该 provider（但 MUST 不破坏现有聚合行为）；启用后，该 provider MUST 重新参与聚合搜索调度（受其最小基础配置 `priority` / `weight` 等约束）。

**优先级原因**: 启停是 provider 管理台最基础的能力；如果只能"看见不能开关"，管理员面对 provider 故障或上游抖动仍只能通过修改代码或重启服务来缓解，运营体验不可接受。

**独立测试**: 在 provider 详情页对 Xunlei 执行禁用，调用聚合搜索接口验证 Xunlei 不再被调用（响应 `provider_failures[]` 中也不出现 Xunlei）；再启用 Xunlei，验证 Xunlei 重新被调用。

**验收场景**:

1. **Given** Xunlei provider 当前 `status=enabled`, **When** 管理员在详情页点击「禁用」并确认, **Then** `status` 切换为 `disabled` 且持久化到 `providers` 表；下次调用聚合搜索接口时 Xunlei 不参与。
2. **Given** Xunlei provider 当前 `status=disabled`, **When** 管理员在详情页点击「启用」并确认, **Then** `status` 切换为 `enabled` 且持久化；下次调用聚合搜索接口时 Xunlei 重新参与。
3. **Given** 管理员对当前选中 provider 执行启停, **When** 切换完成, **Then** 列表页与详情页对该 provider 的状态展示 MUST 同步刷新（不依赖手动刷新）。
4. **Given** OpenSubtitles 仅剩最后一个 `enabled` 实例被禁用, **When** 调用聚合搜索, **Then** 聚合搜索 MUST 返回明确错误（不静默返回空结果），与 `v0.2.2` 的"所有 provider 失败"语义保持一致。
5. **Given** 管理员对某 provider 执行启停, **When** 操作成功, **Then** 审计字段（`updatedAt`）更新；具体审计记录要求在 plan 阶段评估是否复用现有审计体系（默认沿用既有审计机制，不新增）。

---

### 用户故事 3 - 管理员查看 provider 基础状态 (Priority: P1)

管理员进入 provider 详情页或列表页选中某 provider 后，能在页面上看到该 provider 当前的基础状态（启用 / 禁用 / 待完善配置 / 降级）、最近一次健康状态摘要、最近一次错误摘要、最近一次健康检查时间等基础摘要，用于快速判断 provider 是否可服务、是否需要处置。

**优先级原因**: 状态可见是 provider 运营的最小闭环；如果只能启停、看不到状态，管理员在故障时仍无法判断"该 provider 是否已经被上游降级"或"是否需要立即停用"。

**独立测试**: 在 provider 详情页查看 provider 的 `lastHealthStatus` / `lastErrorSummary` / `lastHealthCheckedAt` 等字段，确认在调用一次聚合搜索后这些字段被更新。

**验收场景**:

1. **Given** SubHub 已持久化 provider 的 `lastHealthStatus` / `lastErrorSummary` / `lastHealthCheckedAt`, **When** 管理员进入 provider 详情页, **Then** 页面 MUST 显示这三个字段的最新值（时间采用既有 monospace 时间显示规范）。
2. **Given** provider 当前 `status=degraded`, **When** 管理员查看列表页, **Then** 该 provider 行 MUST 以既有降级状态视觉提示（与 `providers.md` 当前"降级、高风险和待完善配置 Provider 必须在列表中一眼可识别"规则一致）呈现，不允许被埋入二级信息。
3. **Given** provider 当前 `status=needs_config`, **When** 管理员查看列表页, **Then** 该 provider 行 MUST 显式标记"待完善配置"语义，不允许伪装为已完全稳定运行（沿用 `providers.md` 当前"Needs-config state"规则）。
4. **Given** 状态信息获取失败（如 DB 短暂不可用）, **When** 管理员查看 provider 详情, **Then** 页面 MUST 进入 Error state，沿用 `provider-detail.md` 当前错误反馈约定；不展示伪造的"绿色健康"状态。

---

### 用户故事 4 - 管理员编辑 provider 最小基础配置 (Priority: P1)

管理员在 provider 详情页可对 provider 的最小基础配置进行编辑并保存。最小基础配置包括: `priority`（优先级）/ `weight`（权重）/ `concurrencyLimit`（并发上限）/ `cooldownSeconds`（冷却秒数）/ `fallbackProviderId`（回退目标 provider id）/ `rotationEnabled`（是否启用轮换）等已有字段。保存后字段 MUST 持久化并对聚合搜索调度生效。

**优先级原因**: `v0.2.2` 期间这些字段仅在 OpenSubtitles 走 `providers` 表持久化（Xunlei 走 code-layer）。`v0.2.3` 完成后，OpenSubtitles 与 Xunlei 一律走数据库持久化路径；管理员才能在 UI 中调整这些字段而无需修改代码。

**独立测试**: 在 provider 详情页修改 Xunlei 的 `priority` 与 `weight`，保存后通过 DB 或 API 验证 `priority` / `weight` 已持久化；调用聚合搜索接口验证新值生效（如可观察 provider 调用顺序与权重行为）。

**验收场景**:

1. **Given** 管理员修改某 provider 的 `priority` / `weight` / `concurrencyLimit` / `cooldownSeconds` / `fallbackProviderId` / `rotationEnabled`, **When** 点击保存, **Then** 字段 MUST 持久化到 `providers` 表，且页面 MUST 显示"已保存"反馈（沿用 `provider-detail.md` 当前 Success state 规则）。
2. **Given** 管理员修改 `fallbackProviderId` 指向另一个 provider, **When** 当前 provider 调用失败时, **Then** 聚合搜索 MUST 尝试回退到指定 provider（具体回退行为 MUST 与 `v0.2.2` 既有 fallback 策略保持一致；不引入新的回退编排）。
3. **Given** 管理员设置 `fallbackProviderId` 指向不存在的 provider id, **When** 点击保存, **Then** 表单 MUST 显示"回退目标不存在"错误并阻止保存。
4. **Given** 管理员修改字段后未保存即离开页面, **When** 触发离开动作（返回列表 / 切换实例 / 刷新页面）, **Then** 页面 MUST 给出"存在未保存变更"提示（沿用 `provider-detail.md` 当前"Dirty / unsaved state"规则）。
5. **Given** 管理员对 Xunlei 编辑当前未实现的字段（如 OpenSubtitles 的 API Key 录入方式 Xunlei 不适用）, **When** 编辑该字段, **Then** 字段 MUST 按"未实现字段 / 只读字段"语义处理（不展示 / 标注只读 + 后续说明），而不是把整个 provider 视作受限特例。

---

### 用户故事 5 - 老管理台使用路径不被无端打断 (Priority: P1)

`v0.1.0` 已收口的 OpenSubtitles 管理台能力（创建 OpenSubtitles 实例、查看凭据池、隔离异常凭据、查看最近行为等） MUST 在 `v0.2.3` 后继续工作。现有 `/providers` 与 `/providers/:providerId` 路由 MUST 继续承担 OpenSubtitles 的运营配置职责，且行为不变；新增的 Xunlei 视角 MUST 不污染既有 OpenSubtitles 操作路径。

**优先级原因**: 兼容性是 `v0.2.x` 阶段硬约束，与 `specs/001-mvp-admin-console/spec.md` 与 `specs/003-subtitle-search-fields/spec.md` 同策略。任何对老路径的破坏性变化 MUST 被拒绝或显式获得确认。

**独立测试**: 用 `v0.1.0` 风格的 OpenSubtitles 创建流程走完整路径，验证现有 create-provider-drawer / provider-policy-form / provider-credential-table 等组件行为不变；新接入的 Xunlei 仅作为列表新增行与详情页新增实例的方式出现，不替换 OpenSubtitles 既有流程。

**验收场景**:

1. **Given** 管理员按现有流程创建 OpenSubtitles 实例, **When** 走 create-provider-drawer 提交, **Then** 行为 MUST 与 `v0.1.0` 一致；OpenSubtitles 实例默认 `type=opensubtitles`，与 `providers.md` 中"模板化创建 OpenSubtitles"的当前规则一致。
2. **Given** OpenSubtitles 实例已存在且 `enabled`, **When** 管理员进入其详情页, **Then** MUST 显示凭据池区域（Token / API Key 表格、隔离动作、新增凭据），与 `provider-detail.md` 当前 Token 池区一致；Xunlei 实例的详情页 MUST 不展示该区域（按"无凭据可配"空状态处理）。
3. **Given** 管理员对 OpenSubtitles 实例执行"隔离异常凭据"动作, **When** 确认, **Then** 该凭据 MUST 立即从活跃池中移出（与 `provider-detail.md` 当前 Token 池区"隔离操作"语义一致）；不因 `v0.2.3` 的多 provider 扩展而改变。
4. **Given** 既有 dashboard / settings / api-keys / users 等页面, **When** 管理员访问, **Then** MUST 不受 `v0.2.3` 影响；这些页面与 provider 管理无关，不触达。

---

### 用户故事 6 - 管理员理解 Xunlei 与 OpenSubtitles 的差异 (Priority: P2)

管理员在管理台中需要理解 Xunlei 与 OpenSubtitles 在「能否添加凭据 / 是否支持 token 池轮换 / 是否需要配置回退目标」等维度的差异。Xunlei 当前不需要 API Key（凭据池为空），管理员 MUST 能够在不阅读代码的前提下理解这一点；OpenSubtitles 必须保留现有凭据池体验。

**优先级原因**: 虽然不是阻塞性能力，但缺少差异表达会导致管理员误以为"两个 provider 一样、但 Xunlei 是坏的"，产生无效的支持工单与运营焦虑。

**独立测试**: 在 provider 详情页查看 OpenSubtitles 与 Xunlei 两个实例，验证 Xunlei 详情页凭据池区显示"无凭据可配"空状态说明，并明确说明"该 provider 当前不需要 API Key"；OpenSubtitles 详情页凭据池区显示正常 token 表格。

**验收场景**:

1. **Given** Xunlei provider 当前无需 API Key, **When** 管理员进入其详情页, **Then** 凭据池区 MUST 显示「该 provider 当前不需要 API Key」空状态（沿用既有 `Empty state` 视觉规则）。
2. **Given** OpenSubtitles provider 当前有活跃 token, **When** 管理员进入其详情页, **Then** 凭据池区 MUST 展示 token 表格，与 `v0.1.0` 行为一致。
3. **Given** Xunlei 与 OpenSubtitles 的差异维度（如凭据池需求、`fallbackProviderId` 适用性等）, **When** 管理员查看详情页, **Then** 页面 MUST 通过既有 Badge / Callout 组件以一致方式呈现（不引入新视觉语言）。
4. **Given** 管理员在详情页对 Xunlei 看到「新增凭据」按钮, **When** 进入, **Then** 按钮 MUST 不可见或显式禁用并说明"该 provider 不需要 API Key"，避免出现点击后空操作的糟糕体验。

**页面例外标注**: 用户故事 6 与 `provider-detail.md` 当前 Token 池区的「新增凭据」`Button` 默认存在规则不完全一致。本 spec 明确允许 Xunlei 实例的 Token 池区按 `provider.type` 自适应: 对无需 API Key 的 provider，「新增凭据」按钮 MUST 不可见或显式禁用并附说明。该例外 MUST 在 `docs/pages/provider-detail.md` 中以 `Allowed overrides` 形式记录。

---

### 边界场景

- **Provider 全失败**: 禁用 OpenSubtitles 与 Xunlei 后调用聚合搜索，聚合接口 MUST 返回明确错误（沿用 `v0.2.2` "所有 provider 失败 MUST 返回明确错误"语义），不静默返回空结果。
- **Xunlei provider 凭据缺失**: Xunlei 当前无需 API Key，禁用后 / 启用后凭据池区域 MUST 始终保持「无凭据可配」空状态，不出现"凭据缺失错误"。
- **provider 启停权限**: 非管理员用户 MUST NOT 可执行启停操作；只读用户可查看状态但不能修改。具体权限矩阵在 plan 阶段评估复用现有 RBAC（如有）。
- **`fallbackProviderId` 自引用**: 管理员设置 provider 的 `fallbackProviderId` 为自身，保存 MUST 被拒绝并提示"不能回退到自身"。
- **`fallbackProviderId` 循环引用**: A → B → A 的回退链保存 MUST 被拒绝并提示"回退目标形成循环"（避免调度死循环；具体校验策略在 plan 阶段敲定）。
- **`providerTypes` enum 兼容性**: 扩展 enum MUST 兼容现有 `providers` 表的已有 OpenSubtitles 行；migration MUST NOT 强制重写现有数据。
- **新增 Xunlei 实例**: `v0.2.3` 通过 migration 在 `providers` 表插入 Xunlei 默认行（接续 `v0.2.2` 由 code-layer 接入的 Xunlei provider，将其元数据持久化）；`v0.2.3` 不再依赖 code-layer 注册该 provider；UI 上"新增 Provider"入口 MAY 在 plan 阶段决定是否对 Xunlei 暴露（默认: 不暴露"新增 Xunlei"模板化入口，因 Xunlei 是单一实例 provider，不鼓励多实例）。
- **聚合搜索 API 兼容性**: `v0.2.3` MUST NOT 引入对聚合字幕搜索 API 的 breaking 变更；老调用方零改动。
- **Provider 元数据历史回溯**: v0.2.2 期间 Xunlei 的 code-layer 配置（baseUrl 等）作为 `v0.2.3` migration 的初始值持久化到 `providers` 表对应字段；若当前 `Provider` 模型不包含 `baseUrl` 字段，则 baseUrl 仍由 code-layer 维护（不破坏"统一 provider 模型"的边界 —— 因为 baseUrl 不属于"最小基础配置"中的管理员可调字段）。

## 需求 *(mandatory)*

### 功能需求

#### 数据层

- **FR-1**: 数据库 MUST 扩展 `providerTypes` enum 为 `["opensubtitles","xunlei"]`；migration MUST NOT 强制重写现有 OpenSubtitles 行；现有 `opensubtitles` 行 MUST 继续可服务。
- **FR-2**: 数据库 MUST 通过 migration 将 `v0.2.2` 由 code-layer 接入的 Xunlei provider 元数据持久化到 `providers` 表，至少包含: `name`（如 "Xunlei Default"）/ `type=xunlei` / `status`（默认 `enabled`，与 `v0.2.2` code-layer 行为一致）/ `priority` / `weight` / `concurrencyLimit` / `cooldownSeconds` / `rotationEnabled` / `fallbackProviderId`（默认 `null`）。
- **FR-3**: 本次 MUST NOT 引入新表；现有 `providers` / `provider_credentials` / `subtitle_search_requests` 表结构 MUST 保持不变（仅允许 enum 值集合扩展）。
- **FR-4**: 本次 MUST NOT 修改现有 OpenSubtitles provider 的数据；其 row MUST 维持 `v0.2.2` 结束时的字段值。

#### API 层

- **FR-5**: `docs/api/openapi.yaml` MUST 扩展 provider 管理 API，至少包含:
  - `GET /api/admin/providers`: 列出所有 provider 实例（含 OpenSubtitles / Xunlei），按 `type` / `name` 排序可选。
  - `GET /api/admin/providers/{providerId}`: 查看单个 provider 详情。
  - `PATCH /api/admin/providers/{providerId}`: 保存 provider 最小基础配置（`name` / `priority` / `weight` / `concurrencyLimit` / `cooldownSeconds` / `rotationEnabled` / `fallbackProviderId` / `status`）。
  - `POST /api/admin/providers/{providerId}/enable` 与 `POST /api/admin/providers/{providerId}/disable`: 启停 provider。
- **FR-6**: 现有聚合字幕搜索 API（`POST /api/subtitles/search`、`GET /api/subtitles/download`） MUST NOT 受 `v0.2.3` 影响；行为 MUST 与 `v0.2.2` 完全一致。
- **FR-7**: provider 管理 API MUST 复用现有 admin 鉴权与会话校验（沿用 `v0.1.0` 管理控制台鉴权）；非管理员请求 MUST 返回 403。
- **FR-8**: provider 管理 API 的错误响应 MUST 复用现有 `ErrorResponse` schema；新增 4xx / 5xx 错误 MUST 沿用既有错误格式约定。
- **FR-9**: API 契约变更 MUST 同步更新 `docs/api/openapi.yaml`、`src/lib/api/generated/`、route Zod schema 与相关测试。

#### 后端逻辑

- **FR-10**: provider 启用 / 禁用 MUST 持久化到 `providers.status` 字段；聚合搜索 MUST 仅调度 `status=enabled` 的 provider（与 `v0.2.2` "已启用"过滤语义一致）。
- **FR-11**: 聚合搜索 MUST 优先消费 `providers` 表中的 provider 元数据（`status` / `priority` / `weight` / `concurrencyLimit` / `cooldownSeconds` / `fallbackProviderId` / `rotationEnabled`）；code-layer `provider-registry.ts` 仅保留 provider key → adapter 映射，不参与 provider 元数据决策。
- **FR-12**: 当 `provider.status` 为 `disabled` 时，gateway MUST 跳过该 provider；该 provider MUST NOT 出现在聚合搜索响应中，也不 MUST NOT 出现在 `provider_failures[]` 中（不是失败，是被跳过）。
- **FR-13**: 当 `provider.status` 为 `needs_config` 或 `degraded` 时，gateway MUST 沿用 `v0.2.2` 当前行为（具体行为在 plan 阶段评估并确认）；默认: `needs_config` 跳过、`degraded` 仍参与但记录到 `provider_failures[]`。
- **FR-14**: provider 元数据 fallback: `v0.2.3` 期间若 `providers` 表中某 provider 行缺少数值字段（如 `rotationEnabled`），gateway MUST 沿用既有 `v0.2.2` code-layer 默认值；不允许因 fallback 导致 provider 不可服务。
- **FR-15**: provider 详情 API MUST 暴露 `lastHealthStatus` / `lastErrorSummary` / `lastHealthCheckedAt` 字段；具体写入策略（手动写入 vs 搜索调用后回写）在 plan 阶段评估并确认（默认: 聚合搜索调用后由 gateway 回写；调度后台 worker 不在 `v0.2.3` 范围）。

#### 前端 / 页面

- **FR-16**: `docs/pages/providers.md` MUST 升级为多 provider 视角: 列表行 MUST 展示 `type` 标签（OpenSubtitles / Xunlei）；选中 / 池检查区 / 进入详情等动作 MUST 按当前选中 provider 类型自适应（OpenSubtitles 选中后右侧展示凭据池；Xunlei 选中后右侧展示「无凭据可配」空状态）。
- **FR-17**: `docs/pages/provider-detail.md` MUST 升级为多 provider 视角: 表单字段根据 `provider.type` 自适应；OpenSubtitles 显示凭据池区域；Xunlei 显示「无凭据可配」空状态 + 「该 provider 当前不需要 API Key」说明。
- **FR-18**: provider 列表行 MUST 支持按 `type` 筛选（全部 / OpenSubtitles / Xunlei）；筛选 MUST 即时生效，不打断当前选择。
- **FR-19**: provider 启停 MUST 在列表行与详情页均可执行；详情页保存动作与启停动作 MUST 区分（启停是直接动作，无 dirty state；保存是 dirty state 收口动作）。
- **FR-20**: provider 编辑表单 MUST 显式标记"未保存变更"（沿用 `provider-detail.md` 当前 Dirty / unsaved state 规则），并在离开页面 / 切换实例 / 刷新页面时给出提醒。
- **FR-21**: provider 状态展示 MUST 复用既有 Badge / Alert 视觉规则；`degraded` / `needs_config` / `disabled` 状态 MUST 在列表页一眼可识别（沿用 `providers.md` 当前"降级、高风险和待完善配置 Provider 必须在列表中一眼可识别"规则）。
- **FR-22**: 本次 MUST NOT 引入新的视觉语言、新 token、新组件；复用既有 shadcn/ui 组件（Card / Table / Badge / Switch / Input / Select / Alert / Button / Separator 等）。
- **FR-23**: 现有 OpenSubtitles 的 create-provider-drawer MUST 保留；本次 MUST NOT 在 OpenSubtitles 创建流程中引入 breaking 变更（沿用用户故事 5 兼容性约束）。
- **FR-24**: 「新增 Provider」入口在 plan 阶段评估: 默认对 OpenSubtitles 保留模板化创建入口；对 Xunlei 默认不暴露"新增 Xunlei"模板化入口（Xunlei 是单一实例 provider，不鼓励多实例；具体 UX 在 plan 阶段敲定）。

#### 兼容性 / 一致性

- **FR-25**: 本次 MUST NOT 引入对现有聚合字幕搜索 API 的 breaking 变更；老调用方零改动。
- **FR-26**: provider 元数据持久化 MUST NOT 改变 `v0.2.2` 期间的聚合行为；具体来说: `v0.2.2` 期间由 code-layer 接入的 Xunlei provider 行为 MUST 与 `v0.2.3` migration 后行为一致（默认值与 code-layer 常量对齐）。
- **FR-27**: provider 元数据 fallback 路径 MUST NOT 改变 provider 在聚合搜索中的可服务性；任何 fallback MUST 显式记录并在 plan 阶段评估（默认: 在 plan 阶段敲定 fallback 表与策略）。

### 非功能需求 *(mandatory)*

- **NFR-001 (代码质量)**: Feature MUST 通过 `pnpm lint` 与 `pnpm typecheck` 门禁；改动完成后 MUST 先执行 `pnpm format:write`。本次改动 MUST NOT 在 `package.json` / `pnpm-workspace.yaml` / 测试断言中引入 `corepack pnpm` 类环境 workaround。
- **NFR-002 (测试)**:
  - **单元测试**: 覆盖 provider 元数据仓库层（filter by status、update status、update config、enum 兼容性）、gateway 对 disabled provider 的跳过逻辑、回退目标校验（自引用 / 循环引用）。
  - **契约测试**: 覆盖 `GET /api/admin/providers`、`GET /api/admin/providers/{providerId}`、`PATCH /api/admin/providers/{providerId}`、`POST /api/admin/providers/{providerId}/enable`、`POST /api/admin/providers/{providerId}/disable` 的 request / response schema、错误响应。
  - **集成测试**: 覆盖多 provider 并存路径与 `v0.2.3` 后 provider 启用 / 禁用对聚合搜索的影响；遵循 `.github/copilot-instructions.md` 数据库测试分层: `mock / no-db` 用于纯逻辑快速单测，`PGlite` 用于少量 repository 基础行为测试 + 少量 service 层数据库逻辑测试，`real Postgres` 用于正式数据库测试（migration 验证、enum 兼容性、`v0.2.2` 数据兼容）；`Neon staging` 用于环境验证。本次 MUST NOT 因 PGlite 接入方便而删除 / 弱化 / 绕过真实 Postgres test database 或 CI Postgres service。
- **NFR-003 (UX 一致性)**: provider 管理 UI MUST 保持统一错误结构；新增 4xx / 5xx 错误 MUST 复用现有 `ErrorResponse` schema；provider 状态展示 MUST 沿用既有 Badge / Alert 视觉规则。
- **NFR-004 (性能)**: provider 列表 API `GET /api/admin/providers` 在 100 条 provider 行规模下 p95 延迟 SHOULD 不高于 300ms；provider 详情 API `GET /api/admin/providers/{providerId}` p95 延迟 SHOULD 不高于 200ms。具体阈值在 plan 阶段以 baseline 数据为依据确定。
- **NFR-005 (设计保真)**: 本次 MUST 更新 `docs/pages/providers.md` 与 `docs/pages/provider-detail.md`；MUST NOT 修改 `DESIGN.md`（无系统级设计规则变更）。
- **NFR-006 (并行隔离)**: Feature MUST 在 `005-provider-admin-baseline` 分支 / worktree 内独立推进；不与其他 active feature 混批；`.specify/feature.json` MUST 指向 `specs/005-provider-admin-baseline/`。
- **NFR-007 (Issue 同步范围)**: Issue 同步 MUST 仅面向 `specs/005-provider-admin-baseline/`，且 MUST NOT 跨多个 spec 混批任务。Issue 标签 MUST 至少包含 `type:feature` + `area:provider` + `area:admin` + `priority:high` + `scope:mvp` + `stage:spec`；migration 相关任务 issue 需额外加 `area:db`。具体标签在 `taskstoissues` 阶段按仓库 issue / PR 规则收口。
- **NFR-008 (可维护性)**: provider 元数据仓库层 MUST 与 provider 适配层清晰分离；`subtitle-gateway.ts` MUST 不直接感知 `providerTypes` enum 内部细节，仅消费 `provider.status` / `priority` / `weight` / 等聚合字段；provider 适配 MUST 隔离在稳定接口之后（宪章原则 VI）。
- **NFR-009 (运行时环境映射)**: 本次不触达运行时环境映射（`docs/runtime/environment-mapping.md` 无变更）；Preview 分支白名单与 `preview -> staging` / `preview -> dev` 映射规则不变。

### 关键实体 *(mandatory)*

#### `Provider`（已存在，本次扩展）

**用途**: 上游字幕来源实例。`v0.2.2` 期间已有 OpenSubtitles 行；本次扩展为多 provider 视角，新增 Xunlei 行。

**字段**（沿用既有 `Provider` 模型，本次仅扩展 enum 取值与最小基础配置可编辑范围）:

- `id`: 稳定唯一标识
- `name`: provider 实例名称（可编辑）
- `type`: 本次扩展为 `["opensubtitles","xunlei"]`
- `status`: `enabled` | `disabled` | `needs_config` | `degraded`（可编辑 `enabled` / `disabled`；`needs_config` / `degraded` 由系统设置）
- `priority`（可编辑）
- `weight`（可编辑）
- `concurrencyLimit`（可编辑）
- `rotationEnabled`（可编辑）
- `cooldownSeconds`（可编辑）
- `fallbackProviderId`（可编辑，需校验自引用与循环引用）
- `lastHealthStatus`
- `lastErrorSummary`
- `lastHealthCheckedAt`
- `createdAt`
- `updatedAt`

**验证规则**:

- `type` 变更 MUST NOT 允许（provider 实例创建后 `type` 不可变）；编辑表单 MUST NOT 暴露 `type` 字段。
- `status` 在管理台 UI 上 MUST 仅允许 `enabled` / `disabled` 切换；`needs_config` / `degraded` 由系统写入。
- `fallbackProviderId` MUST 满足: 非自引用、非循环引用、目标 provider 存在。
- 新建 Provider 必须显式区分 OpenSubtitles 模板化创建 vs code-layer 注册（Xunlei 默认由 migration 写入，不通过 UI 模板化创建）。

**状态转换**:

- `enabled -> disabled`: 管理员在管理台显式禁用
- `disabled -> enabled`: 管理员在管理台显式启用
- `needs_config -> enabled`: 管理员完成基础配置后由系统判定（具体策略在 plan 阶段评估，默认: 表单保存且关键字段完整时自动切换为 `enabled`）
- `* -> degraded`: 由系统写入（聚合搜索调用后根据连续失败 / 5xx 比例判定；具体策略在 plan 阶段评估）

#### `ProviderCredential`（已存在，本次不触达）

**用途**: 上游字幕来源的凭据（如 OpenSubtitles 的 API Key / Token）。本次 MUST NOT 触达该表结构；Xunlei 当前不需要凭据，不写入该表。

#### `ProviderHealthSnapshot`（可选，本次评估）

**用途**: provider 最近的健康状态快照。本次评估是否需要在 `providers` 表上扩展 `lastHealthStatus` / `lastErrorSummary` / `lastHealthCheckedAt` 字段（默认: 复用既有字段，不新增表）。

**字段**（若评估为复用既有字段）:

- `lastHealthStatus`: 聚合搜索调用后回写
- `lastErrorSummary`: 聚合搜索调用后回写
- `lastHealthCheckedAt`: 聚合搜索调用后回写

**验证规则**:

- 字段由系统写入，不通过 UI 直接编辑
- 字段更新 MUST 与 provider 启停 / 配置编辑动作解耦

## 提议的 provider 元数据扩展方向 *(mandatory)*

### migration 方向

1. **扩展 `providerTypes` enum**:
   - 当前: `["opensubtitles"]`
   - 目标: `["opensubtitles", "xunlei"]`
   - 兼容性: 现有 OpenSubtitles 行 MUST 保持 `type=opensubtitles` 不变。
2. **插入 Xunlei 默认 provider 行**:
   - `name`: 由 plan 阶段敲定（默认: "Xunlei Default"）
   - `type`: `xunlei`
   - `status`: `enabled`（与 `v0.2.2` 期间 code-layer 默认行为一致）
   - `priority` / `weight` / `concurrencyLimit` / `cooldownSeconds` / `rotationEnabled` / `fallbackProviderId`: 默认 `null`，gateway 在缺失时 fallback 到 `v0.2.2` code-layer 默认值（具体 fallback 表在 plan 阶段敲定）
3. **不修改 OpenSubtitles 现有行**: `v0.2.2` 结束时的 OpenSubtitles provider 行 MUST 维持原值。

### provider 元数据 fallback 表（方向，非最终）

| 字段 | OpenSubtitles fallback | Xunlei fallback |
|------|------------------------|-----------------|
| `priority` | `0` | `0` |
| `weight` | `1` | `1` |
| `concurrencyLimit` | `v0.2.2` OpenSubtitles 凭据池默认值 | `v0.2.2` Xunlei code-layer 默认值（具体值在 plan 阶段敲定，默认沿用 `v0.2.2` 行为） |
| `cooldownSeconds` | `v0.2.2` OpenSubtitles 默认值 | `v0.2.2` Xunlei code-layer 默认值 |
| `rotationEnabled` | `true` | `false`（Xunlei 当前无凭据，无需轮换） |
| `fallbackProviderId` | `null` | `null` |

> 上表为方向性约定；plan 阶段 MUST 给出确切值，并 MUST 与 `v0.2.2` 实际行为 100% 对齐（migration 后行为 MUST 与 `v0.2.2` 期间聚合搜索行为一致）。

### 「代码层接入 / 受限 provider」模式的去留（再次强调）

- `v0.2.3` 起，"代码层接入 / 受限 provider"作为产品面特例被取消。
- `v0.2.3` 仅保留"provider key → adapter 映射"由 code-layer 维护（这是必要技术边界，不是产品面特例）；provider 元数据一律持久化到 `providers` 表。
- 任何"未实现字段 / 只读字段"按统一规则处理: 表单 MUST 不展示该字段或显式标注为只读 + 后续说明；不允许通过"该 provider 受限"作为整例屏蔽。

## 验收标准 *(mandatory)*

### 必满足验收

- **AC-1**: `pnpm db:migrate` 后，`providers` 表新增 Xunlei 行（`type=xunlei`，`status=enabled`），OpenSubtitles 现有行 MUST 保持不变。
- **AC-2**: 聚合搜索 API（`POST /api/subtitles/search`）在 `v0.2.3` 后行为 MUST 与 `v0.2.2` 完全一致；老调用方零改动。
- **AC-3**: 管理台 `/providers` 列表页 MUST 同时展示 OpenSubtitles 与 Xunlei provider 行；每行 MUST 含 `type` 标签。
- **AC-4**: 管理台 `/providers/:providerId` 详情页 MUST 支持启用 / 禁用 provider；状态变更 MUST 持久化且聚合搜索 MUST 立即生效（受下次调用影响）。
- **AC-5**: 管理台 `/providers/:providerId` 详情页 MUST 支持编辑最小基础配置（`priority` / `weight` / `concurrencyLimit` / `cooldownSeconds` / `rotationEnabled` / `fallbackProviderId`）；保存 MUST 走 dirty state 提示与确认离开提醒。
- **AC-6**: `fallbackProviderId` 自引用 MUST 被拒绝保存；循环引用 MUST 被拒绝保存；目标 provider 不存在 MUST 被拒绝保存。
- **AC-7**: OpenSubtitles 现有管理路径（创建 OpenSubtitles、查看凭据池、隔离异常凭据等） MUST 不受 `v0.2.3` 影响。
- **AC-8**: provider 列表与详情 API MUST 暴露 `lastHealthStatus` / `lastErrorSummary` / `lastHealthCheckedAt` 字段；聚合搜索调用后 MUST 回写这些字段。
- **AC-9**: `pnpm lint` / `pnpm typecheck` / `pnpm test` MUST 全部通过；`pnpm format:write` MUST 在提交前执行。
- **AC-10**: OpenAPI（`docs/api/openapi.yaml`）/ generated client（`src/lib/api/generated/`）/ contract tests / unit tests / integration tests MUST 100% 同步覆盖 provider 管理 API。
- **AC-11**: PGlite 单测覆盖 provider 元数据仓库层基础行为；real Postgres test database 覆盖 migration 验证、enum 兼容性、`v0.2.2` 数据兼容性；Neon staging 用于环境与发布验证。
- **AC-12**: 本次 MUST NOT 引入新视觉语言、新 token、新组件；`DESIGN.md` 不变；`docs/pages/providers.md` 与 `docs/pages/provider-detail.md` MUST 同步更新。

## 成功标准 *(mandatory)*

### 可度量结果

- **SC-001**: 管理员进入 `/providers` 后 MUST 在一次页面加载内看到所有已接入 provider（OpenSubtitles + Xunlei），无需切换路由或刷新。
- **SC-002**: 管理员执行 provider 启停后 MUST 在列表页与详情页均能看到状态变更（不依赖手动刷新），且下一次聚合搜索调用 MUST 反映新状态。
- **SC-003**: 管理员编辑最小基础配置后 MUST 在 1 秒内看到"已保存"反馈（不依赖手动刷新）。
- **SC-004**: 老调用方（`v0.2.1` / `v0.2.2` 风格请求） MUST 零改动继续工作；聚合搜索 API 行为 100% 向后兼容。
- **SC-005**: provider 列表 API 在 100 条 provider 行规模下 p95 延迟 SHOULD 不高于 300ms；provider 详情 API p95 延迟 SHOULD 不高于 200ms。
- **SC-006**: `v0.2.2` 期间由 code-layer 接入的 Xunlei provider 在 `v0.2.3` migration 后的聚合搜索行为 MUST 与 `v0.2.2` 期间行为一致（默认值与 code-layer 常量对齐）。
- **SC-007**: OpenAPI / generated client / contract tests / unit tests / integration tests MUST 100% 同步覆盖 provider 管理 API 与 provider 元数据持久化路径。

## 假设

- 调用方以现有 `v0.2.1` / `v0.2.2` 风格为主，老调用方不需要迁移。
- OpenSubtitles provider 的现有 `v0.1.0` / `v0.2.0` / `v0.2.2` 实现稳定，`v0.2.3` 不重写 OpenSubtitles adapter，仅按需做最小改动以适配 provider 元数据持久化与多视角管理台。
- 迅雷字幕 provider 接口 `https://api-shoulei-ssl.xunlei.com/oracle/subtitle` 在 `v0.2.3` 后仍按 `v0.2.2` 的 `name + languages` 形态工作；adapter 与 provider-registry 路径不变。
- `v0.2.3` 不引入新数据库表；仅扩展 enum 取值集合与补齐 Xunlei 行。
- 现有 admin 鉴权与会话校验机制（`v0.1.0`）继续承担 provider 管理 API 的鉴权；不引入新权限矩阵。
- Xunlei 是单一实例 provider；`v0.2.3` 默认不在 UI 暴露"新增 Xunlei"模板化入口；具体 UX 在 plan 阶段敲定。
- `providerTypes` enum 扩展不影响其他依赖该 enum 的代码路径；具体兼容性在 plan 阶段敲定。
- 仓库级全局约定（包管理器 `pnpm`、数据库测试分层 `mock / PGlite / Postgres / Neon`、运行时环境映射真源 `docs/runtime/environment-mapping.md`、版本约定真源 `docs/releases/versioning.md`、API 契约链路 `docs/api/openapi.yaml` + Orval + Scalar）以 `.github/copilot-instructions.md` 为真源。

## 范围外后续工作 *(mandatory)*

以下内容明确不在 `v0.2.3` 范围内，留作后续版本或独立 feature:

- 字幕资产管理（缓存可见 / 编辑 / 转正 / 状态机）——由 `v0.3.0` 承接。
- 人工导入字幕（手动上传）——由 `v0.3.0` 承接。
- AI 字幕处理（AI 审核 / 清洗 / 改写）——由 `v0.4.0` 承接。
- provider 高级调度（并行调用编排、超时预算、复杂评分、跨 provider 去重、自适应降级、熔断）。
- 第三方 provider 注册中心 / 插件化 provider 框架。
- 新 provider 接入（subhd、字幕库、第三方字幕聚合 API 等）。
- provider 调度后台 worker（健康检查主动巡检、连续失败降级判定自动化等）。
- 字段改名（`season` → `season_number` / `language` → `languages` 等）的 breaking 升级。
- Xunlei 凭据池（Xunlei 当前无需 API Key；如未来需要凭据池，需独立 spec）。

## 首批实现范围建议 *(mandatory)*

### 范围内（`v0.2.3` 首批落地）

1. **数据库 migration**:
   - 扩展 `providerTypes` enum 为 `["opensubtitles","xunlei"]`。
   - 新增 Xunlei provider 行（默认值与 `v0.2.2` code-layer 行为对齐）。
   - 不修改 OpenSubtitles 现有行。
2. **API 扩展**:
   - `GET /api/admin/providers` 列表 API。
   - `GET /api/admin/providers/{providerId}` 详情 API。
   - `PATCH /api/admin/providers/{providerId}` 配置保存 API。
   - `POST /api/admin/providers/{providerId}/enable` / `disable` 启停 API。
3. **后端逻辑**:
   - provider 元数据仓库层扩展（filter by status / type / 更新 status / 更新 config）。
   - gateway 调度改造: 消费 `providers` 表的 `status` / `priority` / `weight` 等聚合字段；disabled provider 跳过。
   - 回退目标校验（自引用 / 循环引用）。
4. **前端 / 页面**:
   - 更新 `docs/pages/providers.md`: 多 provider 视角。
   - 更新 `docs/pages/provider-detail.md`: 多 provider 视角；OpenSubtitles / Xunlei 自适应。
   - 更新现有组件: `provider-list.tsx` / `provider-policy-form.tsx` / `provider-pool-inspector.tsx` 等组件按 `provider.type` 自适应（不重写既有组件，按需扩展）。
5. **OpenAPI / generated / tests 同步**:
   - `docs/api/openapi.yaml` 同步新增 provider 管理 API。
   - `src/lib/api/generated/` 由 Orval 重新生成。
   - contract tests / unit tests / integration tests 同步覆盖。
6. **配置与凭据**:
   - OpenSubtitles 凭据池行为保持独立（沿用 `v0.2.2` 边界）。
   - Xunlei 不接入凭据池（按"无凭据可配"空状态处理）。

### 范围外（`v0.2.3` 不做）

- 字幕资产相关（手动上传 / 缓存查看 / 编辑 / 转正 / 状态机）。
- AI 字幕处理。
- 新 provider 接入。
- provider 高级调度（并行 / 熔断 / 评分 / 跨 provider 去重 / 自适应降级）。
- 字段改名（`season` → `season_number` 等）的 breaking 升级。
- 第三方 provider 注册中心 / 插件化 provider 框架。

## 需要改动的模块范围 *(mandatory)*

### 后端核心改动

- `src/server/storage/schema.ts`:
  - `providerTypes` enum 扩展为 `["opensubtitles","xunlei"]`。
  - 不修改其他表结构。
- `src/server/storage/migrations/`（新增）:
  - 新增 migration: 扩展 enum + 插入 Xunlei 默认行。
  - 不修改已有 migration。
- `src/server/providers/provider-repository.ts`:
  - 扩展仓库层方法: filter by status、update status、update config、validation fallback target。
- `src/server/subtitles/subtitle-gateway.ts`:
  - 消费 `providers` 表的 `status` / `priority` / `weight` / 等聚合字段。
  - disabled provider 跳过；needs_config / degraded 行为在 plan 阶段敲定。
  - 保留 `v0.2.2` code-layer `provider-registry.ts` 路径（仅用于 provider key → adapter 映射，不参与元数据决策）。
- `src/server/providers/provider-registry.ts`:
  - 仅保留 provider key → adapter 映射；移除元数据相关 code-layer 常量（迁移至 `providers` 表）。
- `src/server/providers/opensubtitles-adapter.ts`:
  - 不重写，仅按需做最小改动以适配 provider 元数据持久化与多视角管理台。
- `src/server/providers/xunlei-adapter.ts`:
  - 不重写，沿用 `v0.2.2` 实现。
- `src/server/api/`（新增管理端点）:
  - `GET /api/admin/providers`
  - `GET /api/admin/providers/{providerId}`
  - `PATCH /api/admin/providers/{providerId}`
  - `POST /api/admin/providers/{providerId}/enable`
  - `POST /api/admin/providers/{providerId}/disable`

### 前端核心改动

- `src/app/(admin)/providers/page.tsx`:
  - 多 provider 列表视角。
- `src/app/(admin)/providers/[providerId]/page.tsx`:
  - 多 provider 详情视角。
- `src/components/providers/provider-list.tsx`:
  - 按 `type` 自适应；新增 `type` Badge；筛选按 `type` 工作。
- `src/components/providers/provider-policy-form.tsx`:
  - 按 `type` 自适应（OpenSubtitles 暴露所有字段；Xunlei 暴露最小基础配置 + "无凭据可配"说明）。
- `src/components/providers/provider-pool-inspector.tsx`:
  - OpenSubtitles 显示凭据池；Xunlei 显示「无凭据可配」空状态 + 「该 provider 当前不需要 API Key」说明。
- `src/components/providers/provider-credential-table.tsx`:
  - OpenSubtitles 完整功能；Xunlei 不渲染（按"无凭据可配"空状态处理）。
- `src/components/providers/create-provider-drawer.tsx`:
  - 保留 OpenSubtitles 模板化创建流；不引入 Xunlei 创建入口（默认）。
- `src/components/providers/provider-utils.tsx`:
  - 扩展 type-aware helper。

### 页面规范

- `docs/pages/providers.md`: 升级为多 provider 视角；新增 `Allowed overrides` 标注（如 Xunlei 不暴露"新增 Xunlei"模板化入口）。
- `docs/pages/provider-detail.md`: 升级为多 provider 视角；OpenSubtitles / Xunlei 自适应规则；新增 `Allowed overrides` 标注（如 Xunlei 不展示凭据池区域、「新增凭据」按钮 MUST 不可见或显式禁用）。

### API 契约链路（仓库级约定）

- `docs/api/openapi.yaml`: provider 管理 API + provider 元数据持久化字段。
- `src/lib/api/generated/`: 由 Orval 重新生成。
- `src/lib/api/`: 手写封装层（如需）。
- API 文档展示: `/docs/api`（Scalar）。

### 测试改动

- `tests/contract/admin-providers.contract.test.ts`（新增）:
  - 覆盖 provider 管理 API（list / get / patch / enable / disable）。
- `tests/unit/server/providers/provider-repository.test.ts`:
  - 覆盖 enum 兼容性、status 过滤、config 更新、fallback target 校验。
- `tests/unit/server/subtitles/subtitle-gateway.test.ts`:
  - 覆盖 disabled provider 跳过、needs_config / degraded 行为。
- `tests/integration/`:
  - 覆盖多 provider 并存路径与 `v0.2.3` 后 provider 启停对聚合搜索的影响；遵循 `.github/copilot-instructions.md` 数据库测试分层。

### 文档改动

- `docs/api/openapi.yaml`: 见上。
- `specs/005-provider-admin-baseline/plan.md`（待 `speckit.plan` 阶段生成）: 设计细节与决策记录。
- `specs/005-provider-admin-baseline/contracts/`（待 `speckit.plan` 阶段生成）: provider 管理 API 契约文件。
- `docs/pages/providers.md` / `docs/pages/provider-detail.md`: 见上。

## 页面规范更新

- **需更新的既有页面规范**:
  - `docs/pages/providers.md`: 升级为多 provider 视角；新增 `Allowed overrides` 标注。
  - `docs/pages/provider-detail.md`: 升级为多 provider 视角；OpenSubtitles / Xunlei 自适应规则；新增 `Allowed overrides` 标注（如 Xunlei 不展示凭据池区域、「新增凭据」按钮 MUST 不可见或显式禁用）。
- **需新建的页面规范**: None
- **是否需要更新 `DESIGN.md`**: No（无系统级设计规则变更；复用既有 token / 组件规则）
