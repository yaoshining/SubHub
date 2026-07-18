# 功能规格: 字幕 API 验证工具（Subtitle API Validator）

**功能分支**: `006-subtitle-api-validator`

**创建日期**: 2026-07-14

**状态**: Draft

**输入**: 用户描述: "请为 SubHub 新建一个独立 spec，主题是‘字幕 API 验证工具（Subtitle API Validator）’。这是一个面向管理人员的内部工具页，用来快速验证各个字幕 provider 的搜索链路和下载链路是否正常；是独立 spec，不是对现有 spec 的补丁追加；版本号保持不变，不新开 milestone，不升级 semver；该功能并入当前正在推进的版本范围，仅作为当前版本内的增量能力；不要改写现有版本规划，只在新 spec 中说明 version unchanged / shipped within current release scope。"

## 功能身份与可追溯性 _(mandatory)_

- **Feature ID**: `006`
- **Spec 目录**: `specs/006-subtitle-api-validator/`
- **主分支**: `006-subtitle-api-validator`
- **主 Issue**: 当前未创建；待 spec review 通过后按本仓库 labels / milestone 规则创建
- **Task Issue 策略**: 当前仅完成 specify；待 spec review 通过后，再决定是否进入 `/speckit.plan` 与 `/speckit.tasks`，task issues 不在本阶段提前创建
- **版本归属**: **version unchanged / shipped within current release scope**
- **对应 milestone**: 不新开 milestone；沿用当前正在推进的版本范围
- **scope 标签倾向**: `scope:mvp`（属于当前版本内管理台运营能力补强，不单独升级版本）
- **GitHub issue / PR 标签倾向**: issue 至少 `type:feature` + `area:provider` + `area:admin` + `priority:high` + `scope:mvp` + `stage:spec`；如后续实现涉及 API 文档与管理端页面，可补 `area:api` / `area:ui`

## 版本与范围声明 _(mandatory)_

本 spec 是**独立新 spec**，不是对 `specs/005-provider-admin-baseline/` 或其他既有 spec 的补丁追加。

### 版本声明

- 本功能**不变更版本号**。
- 本功能**不新开 milestone**。
- 本功能**不升级 semver**。
- 本功能作为**当前正在推进版本范围内的增量能力**交付。
- 本 spec 仅在本文件内声明：**version unchanged / shipped within current release scope**。
- 本 spec **不得改写** `docs/releases/versioning.md` 中既有版本规划。

### 产品边界声明

- 本功能是 **admin-only 内部工具页**，用于验证 provider 搜索链路与下载链路是否正常。
- 本功能**不是**正式字幕搜索页，也**不是**正式字幕下载产品流。
- 本功能**不面向普通用户**，不进入用户主路径。
- 本功能**不替代**现有 provider 管理页、provider 启停页或正式字幕搜索 API；它是面向内部排障与运维校验的辅助能力。
- 本功能**不进入字幕资产管理**、字幕入库、字幕转正、缓存治理或 AI 处理范围。

## 设计上下文 _(mandatory)_

### 设计来源

- **全局设计系统**: `DESIGN.md`
- **页面规范**: 需要新增 admin 工具页 page spec；同时参考 `docs/pages/providers.md`、`docs/pages/provider-detail.md`、`docs/pages/access-control.md`
- **功能特定设计工件**: 无新增 mockup；契约与后端边界以现有 provider registry / gateway / adapter 结构为真源

### 设计范围

- **受影响页面**:
  - `docs/pages/providers.md`：仅需补充与验证工具页的导航/承接关系说明（若当前导航会暴露该工具入口）
  - `docs/pages/provider-detail.md`：仅需补充与验证工具页的职责边界说明（避免与配置页混淆）
- **新增页面**:
  - `docs/pages/subtitle-api-validator.md`（新建）
- **对设计系统的影响**: 无系统级设计规则变更；复用既有 shadcn/ui 组件与 admin layout 模式，不更新 `DESIGN.md`

### 设计约束

- 实现 MUST 遵循 `DESIGN.md` 中的视觉语言、组件规则、反馈样式与管理台层级。
- 页面级结构与行为 MUST 写入 `docs/pages/subtitle-api-validator.md`，不得只留在实现中。
- 本功能 MUST 与正式字幕搜索能力明确区隔：名称、文案、入口、状态提示都不得让管理员误认为这是正式业务搜索页。
- 本功能 MUST 仅复用现有 provider registry / gateway / provider adapter 能力，不得新造一套完全平行的 provider 调用架构。
- 本功能若新增 API 契约，MUST 以 `docs/api/openapi.yaml` 为真源，并与 `src/lib/api/generated/` 分开维护生成代码与手写封装。
- 仓库级全局约定（`pnpm`、数据库测试分层、运行时环境映射、版本约定、API 契约链路）以 `.github/copilot-instructions.md` 为真源，本 spec 不重复展开。

## 用户场景与测试 _(mandatory)_

### 用户故事 1 - 管理员查看当前可验证的 provider 列表 (Priority: P1)

管理员进入一个专门的「Subtitle API Validator」页面，希望立即看到当前系统内可用于验证的 provider 列表，并明确区分每个 provider 当前是启用、禁用还是受限状态，以便选择目标 provider 开始链路排查。

**优先级原因**: 这是整个工具页的入口。如果管理员看不到系统当前有哪些 provider、哪些可用、哪些受限，就无法开展后续的搜索验证或下载验证。

**独立测试**: 打开验证工具页，验证页面能够列出系统当前 provider，并展示其名称、类型、当前状态与最小说明；已禁用/受限 provider 仍可见，但要有清晰状态标识。

**验收场景**:

1. **Given** 系统中存在多个 provider（如 OpenSubtitles、Xunlei）, **When** 管理员进入 `/admin/subtitle-api-validator`, **Then** 页面 MUST 展示当前 provider 列表，并显示每个 provider 的 `name` / `type` / `status`。
2. **Given** 某个 provider 当前为 `disabled` 或受限状态, **When** 管理员查看列表, **Then** 该 provider 仍 MUST 可见，但状态标记与说明 MUST 明确显示其不是正常启用状态。
3. **Given** 当前 provider 列表加载失败, **When** 管理员进入页面, **Then** 页面 MUST 展示明确错误反馈与重试入口，而不是空白页。

---

### 用户故事 2 - 管理员按 provider 发起搜索验证 (Priority: P1)

管理员选择某个 provider，输入搜索条件，并直接在页面中发起搜索请求，希望快速判断该 provider 的搜索链路是否可用、是否返回结果、是否超时、是否因为参数或上游异常失败。

**优先级原因**: 搜索链路验证是本工具的核心目标之一；没有这一步，管理员无法确认 provider 的基础可搜索能力是否正常。

**独立测试**: 选择一个 provider，输入关键词后提交；页面能展示结果、空结果、超时、参数错误或 provider 错误中的任一明确状态。

**验收场景**:

1. **Given** 管理员已选择某个 provider 且输入合法关键词, **When** 点击「搜索验证」, **Then** 页面 MUST 发起 provider-aware 搜索请求，并在结果区展示返回结果或空结果状态。
2. **Given** provider 搜索请求超时, **When** 请求结束, **Then** 页面 MUST 显示明确的超时反馈，并保留当前输入参数供管理员调整后重试。
3. **Given** 输入参数非法或缺少 provider 所需字段, **When** 管理员提交搜索, **Then** 页面 MUST 返回明确参数错误，不得伪装成空结果。
4. **Given** provider 上游返回异常, **When** 请求结束, **Then** 页面 MUST 展示 provider 级错误反馈，说明这是验证失败而不是正式业务搜索失败。

---

### 用户故事 3 - 管理员对搜索结果执行下载验证 (Priority: P1)

管理员在搜索结果中选中某条字幕结果，希望直接验证其下载链路是否可用：可以直接在浏览器触发下载，也可以先验证下载 URL 是否可访问，从而快速判断 provider 的下载能力是否正常。

**优先级原因**: 单有搜索成功不足以说明 provider 真正可用；下载链路是字幕能力闭环的关键一环，也是最常见的排障点。

**独立测试**: 针对某条结果执行下载验证，页面能明确展示下载成功、链接有效、链接无效、缺少下载地址、provider 返回异常等状态。

**验收场景**:

1. **Given** 搜索结果中存在可下载项, **When** 管理员点击「下载验证」或「验证下载 URL」, **Then** 页面 MUST 执行对应动作，并展示成功或失败反馈。
2. **Given** 某条结果没有可用下载地址, **When** 管理员尝试下载验证, **Then** 页面 MUST 明确提示“无下载地址可验证”，不得触发无意义请求。
3. **Given** provider 返回了下载地址但目标资源不可访问, **When** 管理员执行下载 URL 验证, **Then** 页面 MUST 明确展示链接无效或访问失败状态。
4. **Given** 下载验证成功, **When** 浏览器触发下载或 URL 校验通过, **Then** 页面 MUST 展示成功反馈，并保留该结果项的验证状态。

---

### 用户故事 4 - 管理员理解 provider 参数边界与错误上下文 (Priority: P1)

管理员面对不同 provider 时，希望知道哪些参数是通用基础参数，哪些参数是该 provider 的扩展参数，以及当请求失败时能看到足够的上下文来判断是参数问题、provider 问题还是网络问题。

**优先级原因**: 该工具不要求所有 provider 完全统一字段模型；如果不把通用参数与 provider 扩展参数边界讲清楚，验证工具会制造额外歧义。

**独立测试**: 切换不同 provider，观察输入区与说明区是否按 provider-aware 模式变化，并在失败时显示明确错误类别。

**验收场景**:

1. **Given** 管理员在验证工具页切换 provider, **When** 切换到另一 provider, **Then** 页面 MUST 保留基础通用参数区，并按该 provider 展示或隐藏扩展参数区。
2. **Given** provider 只支持关键词搜索, **When** 管理员查看输入区, **Then** 页面 MUST 至少展示关键词作为基础参数，并说明其他参数不适用或未配置。
3. **Given** provider 需要额外扩展参数, **When** 管理员查看说明区, **Then** 页面 MUST 明确这些参数属于 provider 扩展参数，而不是系统统一业务字段。
4. **Given** 请求失败, **When** 页面展示错误, **Then** 错误反馈 MUST 区分参数非法、空结果、超时、provider 上游错误、下载验证失败等不同状态。

---

### 边界场景

- **空 provider 列表**：若当前系统没有任何可列出的 provider，页面 MUST 明确说明无可验证对象，并引导管理员回到 provider 管理页检查配置，而不是展示不可操作表单。
- **已禁用 provider 仍允许验证**：管理员可以显式选择已禁用或受限 provider 做排障验证，但页面 MUST 持续显示该 provider 的当前状态，避免误判为已恢复线上可用。
- **provider 字段模型不一致**：页面请求层可以接收一组参数，再按 provider 自身需要提取并调用上游；不强求所有 provider 只收敛到同一个最小字段集。
- **搜索成功但下载失败**：页面 MUST 将搜索链路成功与下载链路失败分开展示，不得把两者混为单一“失败”。
- **URL 验证成功但浏览器下载失败**：页面 MUST 允许把“下载 URL 可访问”与“浏览器触发下载”视为两种不同验证动作并分别反馈。
- **provider 返回异常结构**：页面 MUST 展示“provider 返回异常”或“结果解析失败”之类的明确错误，而不是空白结果区。
- **非管理员访问**：必须返回明确权限拒绝，不暴露工具页面内容。

## 需求 _(mandatory)_

### 功能需求

#### 页面定位与访问控制

- **FR-1**: 系统 MUST 提供一个 **admin-only** 的内部工具页，用于验证字幕 provider 的搜索链路与下载链路。
- **FR-2**: 该页面 MUST 与正式字幕搜索能力明确区分，在页面标题、说明文案、导航命名与反馈语义上明确这是“验证工具”而不是正式业务搜索页。
- **FR-3**: 非管理员用户 MUST NOT 访问该页面；未授权访问 MUST 返回 403 或等价的明确拒绝状态。
- **FR-4**: 该工具页 MUST NOT 改变普通用户流程，也 MUST NOT 作为正式字幕搜索或下载入口被普通用户消费。

#### 页面结构

- **FR-5**: 页面 MUST 包含以下结构区块：
  - API / provider 列表区
  - 当前 provider 说明区
  - 搜索参数输入区
  - 搜索结果展示区
  - 下载验证操作区
  - 请求状态 / 错误反馈区
- **FR-6**: 页面 MUST 允许管理员从列表中选择一个 provider 作为当前验证对象，并在说明区展示该 provider 的名称、类型、状态、用途边界与必要说明。
- **FR-7**: 页面在 provider 切换时 MUST 清晰更新当前 provider 的说明、参数区与结果上下文；不得让管理员误把上一个 provider 的结果当作当前 provider 结果。

#### Provider 范围与调用边界

- **FR-8**: 页面 MUST 列出系统当前可用的 provider 视图；默认来源应复用现有 provider registry / provider 管理能力，而不是新造静态清单。
- **FR-9**: 页面 MUST 允许管理员显式选择已禁用或受限 provider 进行排障验证，但 MUST 明确显示其当前状态，并不得将这类验证结果误解为“已恢复正式服务”。
- **FR-10**: 本工具页 MUST NOT 强求所有 provider 共用完全一致的字段模型。
- **FR-11**: 页面请求层 MUST 支持“接收一组参数，再按 provider 自身需要提取并调用上游接口”的 provider-aware 参数映射模式。
- **FR-12**: spec MUST 明确：聚合校验页**不强求**通用业务字段进一步收敛到更小统一集，而是允许 provider-aware 参数映射。
- **FR-13**: 本工具 SHOULD 优先复用现有 gateway / adapter 的搜索与下载能力；如因内部验证场景需要新增轻量 admin facade，也 MUST 以现有 provider adapter 为底层调用真源。

#### 搜索能力

- **FR-14**: 搜索验证 MUST 至少支持关键词搜索。
- **FR-15**: 页面 MUST 区分“基础通用参数”与“provider 扩展参数”：
  - 基础通用参数至少包括关键词（query / keyword）
  - provider 扩展参数仅在该 provider 支持且验证场景需要时展示
- **FR-16**: 当 provider 支持更多字段时，页面 MUST 支持按 provider 展示附加参数区，而不是把所有扩展字段塞进统一表单。
- **FR-17**: 搜索请求成功后，页面 MUST 在结果区直接展示返回结果，至少包含用于下载验证所需的标识信息、展示名称与 provider 来源上下文。
- **FR-18**: 页面 MUST 对以下状态提供明确反馈：成功、有结果、成功但空结果、参数非法、请求超时、provider 错误、结果解析异常。
- **FR-19**: 空结果 MUST 被视为一种独立、可理解状态，而不是与错误状态混淆。

#### 下载验证

- **FR-20**: 搜索结果项上 MUST 可执行“下载验证”操作。
- **FR-21**: 管理员 MUST 能在浏览器中直接触发下载，或执行“验证下载 URL 是否有效”的轻量校验动作。
- **FR-22**: 下载验证 MUST 明确区分以下状态：下载成功、下载失败、无下载地址、下载 URL 无效、provider 返回异常。
- **FR-23**: 下载验证是**链路验证**，不是正式字幕入库流程；页面与 API 行为 MUST 不触发正式入库、缓存转正或业务持久化副作用，除非后续明确批准。
- **FR-24**: 当搜索结果没有可用于下载的地址或标识时，页面 MUST 直接提示当前结果不可验证下载，而不是盲目发起请求。

#### 安全、日志与边界

- **FR-25**: 页面与后端接口 MUST NOT 暴露 provider 凭据、secret、token 原文到前端页面。
- **FR-26**: 若 provider 需要凭据或受保护配置，前端仅能看到最小必要的状态摘要，不得看到 secret 值本身。
- **FR-27**: 本功能 MUST NOT 新增与正式业务深度耦合的持久化逻辑；默认不新增“验证结果长期存档”之类的新表或重持久化流程。
- **FR-28**: 如需要日志或审计，本次仅定义最小必要范围：记录谁、在何时、对哪个 provider 发起了哪类验证动作，以及验证是成功还是失败；不得默认扩大为完整审计中心。
- **FR-29**: 错误反馈中 MUST 可暴露足够的调试上下文（例如 provider 名称、动作类型、错误类别、可读错误摘要），但 MUST NOT 泄漏凭据、secret、上游敏感响应原文。

#### 与现有系统关系

- **FR-30**: 本工具 MUST 尽量复用当前 provider registry / gateway / provider adapter 能力，不得新造一套完全平行的 provider 调用架构。
- **FR-31**: 本工具 MUST 与现有 provider 管理台、provider 启停、provider 配置能力明确分工：
  - provider 管理台负责配置、启停、状态治理
  - validator 页面负责临时验证搜索链路与下载链路
- **FR-32**: validator 页面 SHOULD 能从 provider 管理上下文承接 provider 状态信息，但 MUST 不承担修改 provider 配置的主职责。
- **FR-33**: 本工具的引入 MUST NOT 改变正式搜索 API 的既有行为；不得因为 validator 页面而修改普通业务搜索契约或返回语义。

### 非功能需求 _(mandatory)_

- **NFR-001 (代码质量)**: 后续实现 MUST 通过 `pnpm lint` 与 `pnpm typecheck` 门禁；改动完成后 MUST 先执行 `pnpm format:write`。
- **NFR-002 (测试)**: 后续实现 MUST 包含：
  - 单元测试：provider-aware 参数映射、状态归类、下载验证动作分支
  - 契约测试：admin validator API 的请求/响应与错误格式
  - 集成测试：provider 列表展示、搜索验证、下载验证、权限拒绝、与正式搜索 API 隔离
- **NFR-003 (UX 一致性)**: 页面 MUST 沿用既有 admin UI 的错误提示、loading、empty、permission denied 反馈模式；不得引入与管理台其他页面冲突的独立交互语言。
- **NFR-004 (性能)**: 在 provider 数量有限的管理场景下，页面首屏列出 provider 的加载 SHOULD 保持轻量；单次验证请求的反馈必须优先体现“请求中 / 已完成 / 超时 / 失败”的可观测性，而不是只追求无感异步。
- **NFR-005 (设计保真)**: 本功能 SHOULD 新建 `docs/pages/subtitle-api-validator.md`，并按需补充 `docs/pages/providers.md` / `docs/pages/provider-detail.md` 的职责边界说明；`DESIGN.md` 默认不变。
- **NFR-006 (并行隔离)**: Feature MUST 在 `006-subtitle-api-validator` 分支 / worktree 内独立推进；不与其他 active feature 混批。
- **NFR-007 (Issue 同步范围)**: Issue 同步 MUST 仅面向 `specs/006-subtitle-api-validator/`，且 MUST NOT 跨多个 spec 混批任务。
- **NFR-008 (安全边界)**: 验证工具的请求链路 MUST 保持服务端代理/受控调用边界，不得把 provider secret 直接下发前端后再由浏览器直连上游 provider。

### 关键实体 _(如功能涉及数据请填写)_

本功能默认不新增新的长期持久化实体；以下为接口与页面层的核心概念实体：

- **ValidatorProviderSummary**: 验证工具页中的 provider 摘要对象，至少包含 `id`、`name`、`type`、`status`、最小说明信息，以及是否允许验证的上下文提示。
- **ValidatorSearchRequest**: 管理员在验证工具页提交的一次搜索验证请求，包含基础通用参数与 provider 扩展参数。
- **ValidatorSearchResultItem**: 某 provider 返回并展示在验证页上的单条结果，至少包含展示名称、provider 来源、下载验证所需标识或地址。
- **ValidatorDownloadCheckResult**: 一次下载验证动作的结果摘要，至少包含动作类型（浏览器下载 / URL 校验）、成功或失败状态、可读错误原因。
- **ValidatorAuditEvent（可选，最小化）**: 若后续落地最小日志/审计，仅记录验证动作摘要，不引入复杂业务持久化。

## 页面结构提议 _(mandatory)_

### 页面定位

本页面是一个**管理台内部诊断工具页**，其目标是帮助管理员快速判断：

1. 当前有哪些 provider 可用于验证
2. 某个 provider 的搜索链路是否正常
3. 某条结果的下载链路是否正常
4. 问题更像出在参数、provider、网络还是下载目标

该页面不是用户搜索页，也不是 provider 配置页，而是位于两者之间的**诊断桥梁**。

### 页面区块

推荐采用“左侧 Provider Rail + 右侧 Validation Workbench”的双栏诊断工作台，而不是单页长滚动表单。这样可以把 provider 状态常驻在左侧，把当前验证任务集中在右侧，减少排障时的滚动与上下文丢失。

1. **页头与定位说明区**
   - 展示页面标题、副标题、admin-only / 内部诊断标签
   - 明确“仅用于验证链路，不影响正式用户流量”
   - 提供回到 provider 管理上下文的承接入口
2. **Provider Rail（左侧 Provider 列表区）**
   - 展示当前系统 provider 列表
   - 显示状态、类型、健康摘要、是否支持下载验证
   - 支持快速切换当前 provider，并持续显示 disabled / restricted 状态
3. **Provider Overview / Capability Panel（当前 provider 说明区）**
   - 展示当前 provider 用途边界、状态、支持的搜索维度与限制说明
   - 明确当前 provider 是否启用、是否受限、是否仅用于排障验证
4. **Diagnostic Snapshot（诊断摘要区）**
   - 展示最近一次或当前一次验证的 provider、动作类型、请求时间、耗时、状态、错误类别
   - 作为管理员判断“链路是否健康”的高可见性摘要
5. **Search Composer（搜索参数输入与操作区）**
   - 基础通用参数区（至少关键词）
   - provider 扩展参数区（按当前 provider 动态渲染）
   - 包含验证搜索、重置、示例参数等操作入口
6. **Search Results Console（搜索结果展示区）**
   - 展示请求成功后的高密度结果列表
   - 区分有结果、空结果与异常结果
   - 每条结果保留 provider 来源与下载验证所需上下文
7. **Download Validation Area（下载验证操作区）**
   - 针对结果项执行浏览器下载或 URL 有效性校验
   - 显示最近一次下载验证反馈，并区分两类动作的语义
8. **Request Status / Error Feedback（请求状态 / 错误反馈区）**
   - 呈现 loading、success、empty、timeout、provider error、invalid params、download failed 等状态
   - 错误反馈除状态外还应给出下一步建议，但不得暴露敏感凭据

### 参数模型边界

- **基础通用参数**: 首批至少包含关键词。
- **provider 扩展参数**: 仅在当前 provider 支持时展示，例如语言、媒体类型、ID、额外路由字段等。
- **边界原则**: validator 页面不要求把所有 provider 的能力压缩到统一最小业务字段集，而是允许 provider-aware 参数映射：页面收集一组输入，服务端按 provider 的实际能力提取需要字段并发起调用。
- **交互原则**: 基础参数区应保持稳定，provider 切换时把变化集中在扩展参数区与说明区，避免整页大跳变。
- **结果呈现原则**: 结果列表优先展示标题、语言、来源、下载可验证性等核心字段；provider 特有或低频字段进入展开区，而不是默认全部摊开。

## 验收标准 _(mandatory)_

### 必满足验收

- **AC-1**: 管理员进入 validator 页面后，MUST 能看到当前系统 provider 列表。
- **AC-2**: 管理员 MUST 能选择任一 provider 作为当前验证对象；已禁用/受限 provider 仍可被显式选择用于排障，但其状态 MUST 清晰可见。
- **AC-3**: 管理员 MUST 能输入搜索条件并触发搜索验证；页面 MUST 返回结果或明确错误，而不是静默失败。
- **AC-4**: 搜索验证至少支持关键词搜索；如 provider 支持更多字段，页面 MUST 能展示扩展参数。
- **AC-5**: 页面 MUST 清晰区分搜索成功、有结果、成功但空结果、参数非法、超时、provider 错误。
- **AC-6**: 管理员 MUST 能从搜索结果项触发下载验证。
- **AC-7**: 下载验证 MUST 清晰区分成功、失败、无下载地址、下载 URL 无效、provider 返回异常。
- **AC-8**: validator 页面 MUST 明确说明其为链路验证工具，不触发正式字幕入库流程。
- **AC-9**: validator 功能的引入 MUST NOT 影响正式搜索 API 的既有行为与返回语义。
- **AC-10**: 非管理员访问 validator 页面或其后端接口时，MUST 得到明确拒绝。
- **AC-11**: 页面与接口 MUST NOT 暴露 provider secret、token、凭据原文。

## 成功标准 _(mandatory)_

### 可度量结果

- **SC-001**: 管理员在一次进入页面后，能在同一页内完成“选 provider → 搜索验证 → 下载验证”的完整诊断闭环，无需切换到正式搜索页。
- **SC-002**: 当 provider 搜索或下载链路异常时，管理员能在首轮验证中区分出至少是“空结果 / 参数错误 / 超时 / provider 错误 / 下载失败”中的哪一类问题。
- **SC-003**: 已禁用或受限 provider 的验证结果不会被误解为正式线上可用状态；页面持续显示状态上下文。
- **SC-004**: validator 功能上线后，正式搜索 API 行为保持向后兼容，不因内部验证工具引入 breaking 变更。
- **SC-005**: 页面信息架构应支持管理员在 3 秒内看清当前 provider 状态、10 秒内完成一次搜索验证、20 秒内定位一次明显链路问题。

## 假设

- 当前系统已存在可枚举的 provider registry 或 provider 管理能力，可为 validator 页面提供 provider 列表与状态上下文。
- 当前系统已有搜索与下载相关的 provider adapter / gateway 能力；validator 页面优先复用它们，而不是从零实现上游调用。
- 部分 provider 的参数模型天然不一致；当前阶段允许 provider-aware 映射，而不追求统一字段完全收敛。
- 下载验证在多数情况下可通过已有下载链路或 URL 校验能力完成；若浏览器直触发下载受限，仍应至少支持服务端受控校验 URL 可达性。
- 当前版本内允许新增一个 admin 内部工具页，但不改变版本号与 milestone 规划。

## 范围外后续工作 _(mandatory)_

以下内容明确不在本 spec 首批范围内：

- 正式字幕搜索页改版或替换
- 普通用户可访问的 provider 诊断能力
- 字幕结果入库、缓存转正、字幕资产管理
- 下载结果长期留档、历史报表、复杂审计中心
- 新的 provider 插件化框架或独立 provider 调度系统
- 对 provider 配置、启停、凭据池的主配置流程重写
- 以 validator 为入口的批量健康巡检、自动巡检 worker、定时探活任务

## 首批实现范围建议 _(mandatory)_

### 范围内（本 spec 首批落地）

1. **admin validator 页面**
   - 新增独立页面与 page spec
   - 展示 provider 列表、当前 provider 说明、搜索输入、结果区、下载验证区、状态反馈区
2. **最小验证 API / 服务层**
   - 列出 provider
   - 提交单 provider 搜索验证
   - 对单条结果执行下载验证或 URL 校验
3. **provider-aware 参数映射**
   - 至少支持关键词
   - 支持按 provider 渲染扩展参数
4. **权限与安全边界**
   - 仅管理员访问
   - 不泄漏 secret
5. **最小日志/反馈**
   - 仅提供必要请求状态与可读错误摘要

### 范围外（本 spec 不做）

- 新版本号 / 新 milestone / 改写版本规划
- 正式业务搜索契约改版
- 新 provider 接入
- provider 高级调度与自动巡检
- 复杂持久化验证历史与报表

## 需要改动的模块范围 _(mandatory)_

### 后端核心改动（方向性）

- `src/server/providers/`：优先复用现有 adapter / registry，不重造调用架构
- `src/server/subtitles/`：如需 validator facade，应建立在现有 gateway 之上
- `src/app/api/admin/` 或等价 admin API 路由：提供 provider 列表、搜索验证、下载验证接口
- `docs/api/openapi.yaml`：若 validator 接口纳入正式内部契约，需要同步补充

### 前端核心改动（方向性）

- `src/app/(admin)/...`：新增 validator 页面路由
- `src/components/providers/` 或 `src/components/admin/`：新增/扩展 validator 页面相关组件
- 保持与现有 provider 管理台组件体系一致，不自造平行 UI 语言

### 页面规范

- 新建 `docs/pages/subtitle-api-validator.md`
- 视实现关系补充 `docs/pages/providers.md` 与 `docs/pages/provider-detail.md` 的职责边界说明

### 测试改动

- provider 列表与权限测试
- 搜索验证状态测试
- 下载验证状态测试
- 与正式搜索 API 隔离的回归测试

## 推荐拆分方式（如后续决定拆分）

若后续实现评估发现工作量过大，建议优先按以下方式拆分，但**当前仍以一个完整 spec 收口**：

1. **子范围 A：Provider 列表 + 搜索验证**
   - 先完成 admin 页面、provider 选择、关键词搜索验证、状态反馈
2. **子范围 B：下载验证能力**
   - 在已有结果区上补充浏览器下载与 URL 校验动作
3. **子范围 C：最小日志 / 审计补充**
   - 仅在确有需要时追加最小化审计记录

拆分原则：优先保证“可选 provider 并完成搜索链路验证”的最小闭环，再补下载验证与附加运营信息。

## 页面规范更新

- **需更新的既有页面规范**:
  - `docs/pages/providers.md`：按需补充与 validator 页的职责边界说明
  - `docs/pages/provider-detail.md`：按需补充与 validator 页的分工说明
- **需新建的页面规范**:
  - `docs/pages/subtitle-api-validator.md`
- **是否需要更新 `DESIGN.md`**: No（复用既有管理台设计规则与 shadcn/ui 组件模式）
