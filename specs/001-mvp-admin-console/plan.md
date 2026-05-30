# 实施计划: MVP 管理控制台与统一字幕出口

**分支**: `feat/001-mvp-admin-console` | **日期**: 2026-05-26 | **规格**: `specs/001-mvp-admin-console/spec.md`

**输入**: 来自 `specs/001-mvp-admin-console/spec.md` 的最新功能规格，以及 `specs/001-mvp-admin-console/data-model.md`、`specs/001-mvp-admin-console/database-design.md`、`specs/001-mvp-admin-console/contracts/api-contract.md`、`DESIGN.md`、`docs/layouts/admin-layout.md`、`docs/pages/*.md`、`design/main.pen`、`.github/copilot-instructions.md`

**说明**: 本计划用于后续 `speckit.tasks` 拆分任务。当前 feature 只覆盖 MVP 管理控制台、OpenSubtitles 首发 Provider、Provider 凭据池、下游调用方 Key、统一字幕查询/下载出口、Users 基础成员管理与只读系统设置总览；`docs/pages/access-control.md` 为后续 feature 参考，不进入本期实现范围。

## 摘要

本 feature 将 SubHub 从规划文档推进到一个可自托管、单实例、单维护者/小团队可用的最小闭环：管理员可初始化并登录控制台，配置 OpenSubtitles Provider 与多个上游凭据，创建和轮换下游调用方 Key，完成后台成员邀请、暂停/恢复与基础会话处置，并通过受控统一 API 完成字幕查询与下载。前端实现以 Next.js + TypeScript 为基线，后台页面严格对齐 `DESIGN.md`、`docs/layouts/admin-layout.md`、7 个 Active page spec 与 `design/main.pen`；后端以模块化服务边界实现认证、Provider 调度、凭据切换、调用方授权、基础成员管理、查询/下载网关和设置状态汇总。

API 变更贯穿本 feature，因此实现必须同步维护 `docs/api/openapi.yaml`、`orval.config.ts`、`src/lib/api/generated/`、`src/lib/api/` 和 `/docs/api` Scalar 展示入口。响应式、Lucide 图标一致性、UI review 与 code review 都是正式交付范围，不作为事后 polish。

## 设计上下文

**全局设计系统**: `DESIGN.md`

**共享布局规范**: `docs/layouts/admin-layout.md`

**相关页面规范**:
- `docs/pages/login.md` - `/login`，管理员初始化与日常登录入口
- `docs/pages/dashboard.md` - `/dashboard`，系统健康、未就绪与下一步入口
- `docs/pages/providers.md` - `/providers`，Provider 比较、分诊、OpenSubtitles 建档
- `docs/pages/provider-detail.md` - `/providers/:providerId`，运行策略与上游凭据池深配
- `docs/pages/api-keys.md` - `/api-keys`，下游调用方 Key 生命周期
- `docs/pages/users.md` - `/users`，后台成员、邀请、暂停/恢复与基础会话处置的 MVP 治理入口
- `docs/pages/settings.md` - `/settings`，只读系统状态确认与配置分流

**范围外参考**:
- `docs/pages/access-control.md` - 权限矩阵与审批护栏治理，当前状态为 Draft，不在本期实现；`settings` 页可保留后续能力入口，但不得提前实现复杂权限配置。

**已评审的设计输入**:
- `design/main.pen`：已包含 Dashboard、Login、Providers、Provider Detail、API Keys、Users、Settings 的深/浅主题与 Tablet/Mobile 设计稿；包含 `Empty States – Reference (Dark)`；包含设计变量 `--bg-canvas`、`--bg-surface`、`--bg-card`、`--border-default`、`--font-primary`、`--font-secondary`、`--font-muted`、`--accent`、`--success`、`--warning`、`--danger`、`--radius-*`、`--sidebar-width`。
- `design/main.pen → Assets / Icons / Lucide`：正式图标资产区。实现阶段新增可复用 Lucide 图标必须回写此区域，并与 `lucide-react` 组件名保持一致。
- `docs/layouts/admin-layout.md §5.8.1`：Providers、API Keys、Users 空状态卡片基线，分别使用 `cloud-off`、`key-round`、`users`。

## 技术上下文

**语言/版本**: TypeScript；运行时目标为当前 Next.js LTS 可支持的 Node.js 版本。实现前应在 `package.json` 中固定 Next.js、React、TypeScript 与测试工具版本，避免隐式漂移。

**核心依赖**:
- 前端与全栈路由：Next.js + React + TypeScript
- UI：TailwindCSS + shadcn/ui；基础组件优先使用 Button、Input、Select、Table、Card、Badge、Tabs、Alert、Dialog、Drawer、AlertDialog、Switch、Accordion、Textarea、Separator、Toast/Sonner
- 图标：Lucide / `lucide-react`
- API 契约：OpenAPI 真源 `docs/api/openapi.yaml`；Orval 配置 `orval.config.ts`；生成代码 `src/lib/api/generated/`；手写 API 层 `src/lib/api/`；Scalar 文档入口 `/docs/api`
- 数据库：SQLite + Drizzle ORM + drizzle-kit；数据库落地设计以 `specs/001-mvp-admin-console/database-design.md` 为正式输入
- 后端模块：Next.js Route Handlers 或同等 Next.js server 边界；Provider adapter、credential pool、caller key auth、subtitle gateway、audit/action result logging 必须按模块隔离
- 首发 Provider：OpenSubtitles adapter

**存储**: 首版采用 SQLite + Drizzle ORM + drizzle-kit，持久化管理员账号、后台成员状态、成员邀请、后台会话、Provider、Provider 凭据、调用方 Key、轮换历史、查询/下载记录摘要、关键管理动作结果。数据库 schema、migration、访问入口、Drizzle 配置、表设计、索引、约束、敏感字段处理、迁移策略与未来 PostgreSQL 可迁移边界必须遵循 `specs/001-mvp-admin-console/database-design.md`；在未完成该数据库落地前，不得使用仅内存存储作为可交付实现。

**测试**:
- 单元测试：认证校验、基础成员管理、Provider 状态流转、凭据池选择/隔离、调用方 Key 校验、统一错误映射
- API/契约测试：登录/初始化、成员邀请、成员暂停/恢复、基础会话处置、Provider CRUD、Provider 凭据启停、调用方 Key 创建/轮换/停用、字幕查询/下载、未就绪/未授权错误
- 前端测试：关键页面状态、关键交互、受控 reveal/copy、未保存变更、空状态、错误状态、响应式行为
- 评审验证：UI review 对照 `DESIGN.md`、`docs/layouts/admin-layout.md`、page specs、`design/main.pen`；code review 对照 spec/plan/tasks 与 OpenAPI 链路

**目标平台**: 自托管 Web 应用，浏览器访问后台控制台，外部应用通过 HTTP API 调用统一字幕查询与下载。

**项目类型**: Next.js 全栈 Web 应用 + 对外 HTTP API 网关。

**性能目标**:
- 95% 合法字幕查询请求在 5 秒内返回统一结果集、明确无结果或明确失败状态。
- 当同一 Provider 下存在至少两个活跃凭据时，单个凭据失效后 100% 新请求不得继续分配到该失效凭据。
- 凭据切换不得造成长时间挂起；上游超时、429、认证失败必须尽快转换为可识别状态。
- 后台页面首屏必须先展示骨架/已知信息，再补充下钻读数，不因单个摘要失败整页空白。

**约束条件**:
- 响应式是正式交付范围。Desktop ≥1280px、Tablet 768-1279px、Mobile <768px 的行为必须按 `docs/layouts/admin-layout.md §6` 和页面级 Responsive Behavior 实现。
- 所有后台页使用共享 Admin Shell；登录页使用简化认证外壳。
- Provider 凭据与下游调用方 Key 必须在数据模型、API、UI 文案和表格中保持明确区分。
- API 变更必须同步 OpenAPI、Orval、生成 client/types、手写 API 适配层与 Scalar 文档入口。
- Lucide 是唯一默认图标系统；不得混用其他图标库。
- Users 页只承接 MVP 基础成员管理、邀请、暂停/恢复与基础会话处置，不承接完整身份治理中心、权限矩阵、审批工作流、审计导出或高级风控策略。
- `settings` 页只读确认与分流，不承接 Provider、API Key、用户或权限深配置。

**规模/范围**:
- 本 feature 交付 7 个后台页面与 1 组统一字幕出口 API。
- 首发上游 Provider 仅要求 OpenSubtitles。
- 不包含公开注册、多租户、完整 RBAC、权限矩阵、审批流、完整身份治理中心、高级风险分析/风控策略系统、审计导出、手动上传、高级缓存治理、统计分析或告警中心。

## 宪章检查

*门禁：必须在第 0 阶段研究前通过，并在第 1 阶段设计后复检。*

- **代码质量门禁**: 通过。实现任务必须补齐 format、lint、type-check、test 脚本并纳入 CI/PR 检查；当前仓库仅有 API placeholder scripts，属于实现前缺口。
- **必需测试策略**: 通过。测试范围覆盖登录访问控制、Provider 凭据切换、调用方 Key 授权、查询/下载主流程、设置状态汇总、前端关键状态与响应式。
- **UX/API 一致性约束**: 通过。统一返回成功、失败、无结果、未就绪、未授权状态；后台反馈必须指出失败对象与恢复路径。
- **性能预算与验证方法**: 通过。以查询 5 秒内返回明确状态、凭据失效不再分配、后台摘要局部失败不清空整页作为可验证目标。
- **可维护性/模块化方案**: 通过。Provider adapter、credential pool、caller key auth、subtitle gateway、admin services、API contracts、generated client、manual API layer 分离。
- **设计来源映射**: 通过。`DESIGN.md`、`docs/layouts/admin-layout.md`、7 个 Active page spec 与 `design/main.pen` 均纳入正式输入。
- **是否需要增补 `DESIGN.md`**: No。当前 feature 复用既有系统级设计语言；若实现发现跨页面新规则，必须先提出并更新 `DESIGN.md` 或 `docs/layouts/admin-layout.md`。
- **worktree 隔离**: 通过。当前 active feature 为 `specs/001-mvp-admin-console`，分支为 `feat/001-mvp-admin-console`。
- **可追溯关系**: 通过。Feature ID `001` 已映射到 spec 目录、分支与主追踪 issue `#3`。
- **issue 同步范围**: 通过。后续 `speckit.tasks` 与 issue 同步仅面向 `specs/001-mvp-admin-console`。

## 设计映射

### 适用全局规则

- `DESIGN.md §2`: 运维事实优先、信息密度高但不混乱、高风险动作可见可确认、控制台气质优先。
- `DESIGN.md §3`: 深色默认、浅色备选、主题跨页面持久化；主题切换唯一入口为 Sidebar Footer，使用 `Moon` / `Sun`。
- `DESIGN.md §4`: 产品界面正文使用 Inter；Space Grotesk 仅用于 SubHub wordmark。
- `DESIGN.md §6`: 页面布局与密度原则；响应式不改变产品结构。
- `DESIGN.md §7.2-§7.9`: Card、表单、Table/List、Badge/Chip、Inline Callout、导航、shadcn/ui 组件系统基线。
- `DESIGN.md §8`: 成功、失败、未就绪、未授权等状态反馈必须与文案共同表达。
- `DESIGN.md §9`: 数据展示与技术信息呈现必须可扫描、可追踪。
- `DESIGN.md §10`: 可访问性与交互底线。

### 共享布局规则

- Admin Shell 统一为 Sidebar、Topbar/Page Header、Main Content Area、可选 Secondary Panel。
- Sidebar 导航项和页面标题使用中文：仪表盘、服务商、API 密钥、用户、设置。
- Desktop 保留常驻 Sidebar；Tablet 可收窄或隐藏并由菜单按钮唤起；Mobile 使用 Drawer，导航后自动关闭。
- Page Header 在 Desktop 可并排标题/摘要/主操作；Tablet 可拆两行；Mobile 单列并收敛次级动作。
- 列表页 Desktop 使用完整列模型；Tablet 收敛低优先级列；Mobile 转卡片化或关键列 + 展开详情。
- 详情页 Desktop 可双栏；Tablet 次级栏下沉；Mobile 按核心信息、状态诊断、历史关联顺序单列堆叠。
- Dialog/Drawer 在窄屏下优先 Drawer 或全屏层；长表单不得塞入小 Modal。
- 页面根容器不得横向滚动；表格内部横向滚动必须局部且可预期。

### 页面级实现规则

- `/login`: 日常登录与首个管理员创建共用同一路由和同一主卡片；登录失败保留非敏感字段；已登录访问直接重定向；登录页不显示后台 Sidebar/Header。
- `/dashboard`: 不做深度编辑；未就绪状态优先展示；必须覆盖系统健康、队列压力、Provider 快照、缓存/覆盖信号、下一步动作。
- `/providers`: OpenSubtitles 模板化创建；列表负责比较和分诊；创建成功后自动选中新实例并给出继续配置 CTA；不得退化为简单开关列表。
- `/providers/:providerId`: 承接运行策略、Token 池、最近行为、Post-create 待补配置；未保存变更必须可见；隔离凭据需显式确认。
- `/api-keys`: 管理下游调用方 Key；完整明文只在新建/轮换后的受控窗口 reveal/copy；停用与轮换是不同动作；无活跃 Key 必须提示对外服务不可用。
- `/users`: MVP 聚焦谁能登录后台、邀请、暂停/恢复、风险会话；不得承接角色矩阵或审计导出。
- `/settings`: 只读状态确认与配置分流；不得承载保存动作、深配置表单或通用系统配置中心。

### 图标系统规则

- 前端图标必须来自 `lucide-react`，设计稿图标必须来自 Pencil `icon_font` 的 Lucide。
- 默认语义映射：菜单 `menu`、侧边栏切换 `panel-left`、设置 `settings`、成员 `users`、安全 `shield`、API Key `key-round`。
- 空状态：Providers 使用 `cloud-off`，API Keys 使用 `key-round`，Users 使用 `users`。
- 新正式引入且可复用的 Lucide 图标必须回写 `design/main.pen → Assets / Icons / Lucide`，并在 page spec、实现和 review 中保持命名一致。

### 计划中的文档变更

- **更新 `DESIGN.md`**: No。除非实现过程中出现跨页面新视觉或交互规则。
- **更新既有页面规范**: 默认 None。若实现需要偏离 page spec，必须先更新对应 `docs/pages/*.md` 并说明理由。
- **新建页面规范**: None。本 feature 已有 7 个 Active page spec。
- **API 契约文档**: 必须创建/更新 `docs/api/openapi.yaml`，并保持 `specs/001-mvp-admin-console/contracts/api-contract.md` 中的规划契约与正式 OpenAPI 同步。

## 项目结构

### 文档（本功能）

```text
specs/001-mvp-admin-console/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── database-design.md
├── quickstart.md
├── contracts/
│   └── api-contract.md
└── tasks.md
```

### 设计与规范（仓库根目录）

```text
DESIGN.md
design/
├── main.pen
└── images/
    ├── logo-dark.png
    └── logo-light.png
docs/
├── layouts/
│   └── admin-layout.md
└── pages/
    ├── login.md
    ├── dashboard.md
    ├── providers.md
    ├── provider-detail.md
    ├── api-keys.md
    ├── users.md
    ├── settings.md
    └── access-control.md
```

### 预期源码结构（实现阶段创建）

```text
src/
├── app/
│   ├── (admin)/
│   │   ├── dashboard/page.tsx
│   │   ├── providers/page.tsx
│   │   ├── providers/[providerId]/page.tsx
│   │   ├── api-keys/page.tsx
│   │   ├── users/page.tsx
│   │   ├── settings/page.tsx
│   │   └── layout.tsx
│   ├── login/page.tsx
│   ├── api/
│   │   ├── admin/...
│   │   ├── subtitles/search/route.ts
│   │   ├── subtitles/download/route.ts
│   │   └── docs/route.ts 或 docs/api/page.tsx
│   └── docs/api/page.tsx
├── components/
│   ├── admin/
│   │   ├── admin-shell.tsx
│   │   ├── sidebar.tsx
│   │   ├── page-header.tsx
│   │   ├── responsive-drawer.tsx
│   │   └── empty-state-card.tsx
│   └── ui/
│       └── shadcn/ui components
├── lib/
│   ├── api/
│   │   ├── generated/
│   │   └── index.ts
│   ├── auth/
│   ├── providers/
│   ├── subtitles/
│   ├── caller-keys/
│   ├── settings/
│   └── audit/
└── server/
    ├── storage/
    │   ├── schema.ts
    │   ├── client.ts
    │   └── migrations/
    └── config/
tests/
├── unit/
├── integration/
├── contract/
└── ui/
docs/
└── api/
    └── openapi.yaml
orval.config.ts
drizzle.config.ts
```

**结构决策**: 采用 Next.js 全栈单体结构，前端页面、Route Handlers、服务模块和 API 契约同仓维护。生成 API client/types 与手写 API 适配层必须分开：`src/lib/api/generated/` 不手改，`src/lib/api/` 只承载手写封装和业务适配。

## 前后端边界与协作链路

### 后端任务范围

- 管理员初始化、登录、会话校验、受保护路由/API 鉴权。
- Provider 实体、OpenSubtitles adapter、Provider 启停、运行状态、Token/Provider API Key 凭据池、自动切换、冷却、隔离与恢复。
- 下游调用方 Key 创建、受控明文展示窗口、轮换、停用、授权校验、调用方标识与状态追踪。
- Users 基础成员管理：成员列表、成员邀请、成员暂停/恢复、后台会话摘要与基础会话处置；不得扩展为完整身份治理、权限矩阵、审批或高级风控。
- 统一字幕查询与下载 API：标准化请求/响应、Provider 调度、无结果/失败/未就绪/未授权错误映射。
- Settings 状态聚合：环境、版本、首个管理员状态、Provider 可用性、调用方 Key 可用性、统一出口就绪度。
- 关键管理动作结果记录：Provider 启停、凭据隔离/恢复、调用方 Key 停用/轮换、成员邀请、成员暂停/恢复、基础会话处置、登录/初始化结果。

### 前端任务范围

- 搭建 Next.js + TypeScript + TailwindCSS + shadcn/ui + lucide-react 基础工程。
- 实现 Admin Shell、Sidebar、Topbar/Page Header、Main Content、Secondary Panel、响应式 Drawer、主题切换、空状态卡片。
- 实现 7 个页面及其 key states、loading、empty、error、permission、success、post-create、dirty/unsaved、reveal window、基础会话处置等状态。
- 使用 OpenAPI/Orval 生成 client/types，并通过 `src/lib/api/` 手写层接入页面。
- 实现 Mobile/Tablet/Desktop 断点行为，确保页面根无横向滚动、表格局部横向滚动可控、移动端高风险动作仍可达。
- 保持 Lucide 图标命名一致，并在引入新图标时同步设计稿资产。

### 需要并行协作的任务

- API 契约优先：后端定义/更新 `docs/api/openapi.yaml`，前端通过 `api:client` 生成类型后接入页面；任何字段变化不得绕过契约。
- 页面实现与服务实现并行：前端可先基于契约和 mock 状态实现页面骨架，但交付前必须切换到真实 API client。
- UI review 与 code review 并行收敛：UI review 对照设计真源和响应式；code review 对照 spec/plan/tasks、测试与 API 链路。

### 明确排除

- `access-control` 页面实现、权限矩阵、审批护栏、完整 RBAC。
- 完整身份治理中心、高级风险分析/风控策略系统、审计导出。
- 多租户、公开注册、SSO/2FA 可用主流程。
- 多 Provider 通用接入模型、Custom Adapter、Base URL 自定义。
- 手动上传、缓存治理、高级统计分析、告警中心。

## API 契约链路

本 feature 涉及接口新增和响应结构定义，必须纳入完整 API 契约链路：

- OpenAPI 真源：`docs/api/openapi.yaml`
- Orval 配置：`orval.config.ts`
- 生成 client/types：`src/lib/api/generated/`
- 手写 API 层：`src/lib/api/`
- 文档入口：`/docs/api`（Scalar）
- 相关脚本：`api:spec`、`api:client`、`api:docs`，可选 `api:check`

### 必须同步的接口范围

- 认证/初始化：bootstrap status、create first admin、login、logout、session/me。
- 管理端 Provider：list/create/get/update/enable/disable。
- Provider 凭据：list/create/isolate/restore/status。
- Dashboard/Settings 摘要：readiness、health、system status、deployment/version reads。
- 下游调用方 Key：list/create/rotate/suspend/reveal window、usage summary。
- 用户管理：members、invitations、suspend/restore、basic session remediation 的 MVP 接口。
- 对外字幕 API：search subtitles、download subtitle。

### 错误与状态约束

- 未认证后台请求返回可识别 authentication error。
- 下游调用方 Key 无效/停用返回可识别 authorization failure，不得返回业务成功。
- 无启用 Provider 或无活跃下游 Key 返回 service not ready。
- 上游无字幕返回 no results，与上游失败分离。
- 上游请求失败、超时、429、凭据失效必须映射为稳定错误结构，并记录最近异常。

## Phase 0: 研究结论

详见 `specs/001-mvp-admin-console/research.md`。本计划已消除技术上下文中的待澄清项；剩余不确定性作为实现风险与任务依赖处理，而不是未决需求。

核心结论：
- Next.js 全栈单体是当前仓库最小可交付路径。
- `docs/layouts/admin-layout.md` 是共享布局正式基线。
- OpenAPI/Orval/Scalar 链路必须在首批 API 实现中落地。
- SQLite + Drizzle ORM + drizzle-kit 是当前 MVP 的正式数据库方案；schema、migration、client、Drizzle 配置、索引、约束、敏感数据处理和未来 PostgreSQL 可迁移规则以 `specs/001-mvp-admin-console/database-design.md` 为准。
- `design/main.pen` 已覆盖本 feature 主要页面与响应式画板，设计先行缺口不阻塞计划，但实现偏离必须回写文档。

## Phase 1: 设计与契约产物

- 数据模型：`specs/001-mvp-admin-console/data-model.md`
- 数据库落地设计：`specs/001-mvp-admin-console/database-design.md`
- API 契约规划：`specs/001-mvp-admin-console/contracts/api-contract.md`
- 快速验证说明：`specs/001-mvp-admin-console/quickstart.md`
- Agent context：`.github/copilot-instructions.md` 的 Spec Kit plan 引用必须指向本文件。

## Phase 2: 后续 tasks 拆分建议

后续 `speckit.tasks` 应按以下可交付切片拆分，每个切片包含测试与 review 项：

1. 工程基础与质量门禁：Next.js/TypeScript/Tailwind/shadcn/lucide、format/lint/type-check/test、CI、基础目录。
2. API 契约链路：`docs/api/openapi.yaml`、`orval.config.ts`、`api:*` scripts、Scalar `/docs/api`、生成 client/types。
3. 存储与领域模型：按 `specs/001-mvp-admin-console/database-design.md` 落地 SQLite + Drizzle ORM + drizzle-kit，覆盖 `src/server/storage/schema.ts`、`src/server/storage/migrations/`、`src/server/storage/client.ts`、`drizzle.config.ts`，并实现管理员、后台成员、成员邀请、后台会话、Provider、Provider 凭据、调用方 Key、查询/下载记录、动作结果日志的表、索引、约束、敏感字段处理和 migration。
4. 认证闭环：初始化首个管理员、登录、会话、受保护后台页/API、未认证重定向。
5. Provider 与凭据池后端：OpenSubtitles adapter、Provider CRUD、凭据状态、自动切换、隔离/恢复、最近异常。
6. 下游调用方 Key 后端：创建、受控明文窗口、轮换、停用、授权校验、最近使用。
7. 统一字幕出口：查询、下载、无结果、未就绪、未授权、上游失败映射。
8. 共享 Admin Shell：Sidebar、Topbar、主题、响应式 Drawer、空状态卡片、Lucide 图标基线。
9. 页面实现：Login、Dashboard、Providers、Provider Detail、API Keys、Users、Settings，各自覆盖 key states 与 page spec。
10. 响应式与设计保真：Desktop/Tablet/Mobile 骨架、页面级特例、设计稿对照、图标资产回写。
11. 测试与评审：前端状态/交互/响应式测试、后端状态/API/契约测试、UI review、code review、OpenAPI/Scalar/client 一致性检查。

## 设计保真实施策略

- 实现前先确认每页对应 page spec 的 Modules、Key States、Component Patterns、Responsive Behavior。
- 基础组件优先 shadcn/ui；确需自定义基础组件时，先在 page spec 记录原因。
- 页面实现中不得引入未声明的页面级布局偏离；发现共享布局问题时优先更新 `docs/layouts/admin-layout.md`。
- 设计稿中已有 Desktop/Tablet/Mobile 画板的页面，UI review 必须抽样对照对应断点。
- 空状态统一复用 `EmptyStateCard`，结构与 token 对齐 `docs/layouts/admin-layout.md §5.8.1`。
- 图标 review 检查 `lucide-react` 组件名、page spec 命名、`design/main.pen` 资产命名三方一致。

## 测试与评审策略

### 前端测试

- Login：bootstrap、login、submitting、error、redirect、未认证访问保护。
- Dashboard：未就绪优先、局部摘要失败保留已知信息、下一步跳转。
- Providers：空状态、创建抽屉、创建成功 banner、选中 Provider、移动端按钮顺序。
- Provider Detail：post-create alert、dirty/unsaved、保存中、隔离凭据确认、移动端 Accordion。
- API Keys：空状态、no-selection、reveal window、copy、rotate、suspend、筛选后选中项保留。
- Users：成员列表、邀请、暂停/恢复、基础会话处置状态、移动端批量操作收敛。
- Settings：只读状态、分流入口、未就绪原因、部署读数失败局部错误。
- 响应式：Desktop/Tablet/Mobile 下 Sidebar、Header、列表/详情/表单转换；页面根不得横向滚动。

### 后端与 API 测试

- 管理员初始化与登录访问控制。
- Provider 凭据池选择：活跃、冷却、隔离、超额、最近异常。
- 调用方 Key 授权：有效、无效、停用、轮换后旧 Key 失效。
- 字幕查询/下载：成功、无结果、无 Provider、无活跃 Key、上游失败、下载不可用。
- Settings readiness：Provider、调用方 Key、管理员初始化、统一出口状态的组合。
- OpenAPI 契约测试：实现路径、请求参数、响应结构、错误码与 `docs/api/openapi.yaml` 一致。

### 交付前评审

- UI review 必须使用 `SubHub 界面评审` 或等价流程，对照 `DESIGN.md`、`docs/layouts/admin-layout.md`、page specs、`design/main.pen`。
- Code review 必须使用 `SubHub 代码评审代理` 或等价流程，重点检查行为正确性、状态流转、测试缺口、API 契约链路、响应式与 Lucide 一致性。
- 涉 API 改动的 review 必须同时检查实现、OpenAPI、Scalar 展示、Orval 生成 client/types、手写 API 层。

## 风险与依赖

| 风险/依赖 | 当前状态 | 计划处理 |
|---|---|---|
| page spec 完整性 | 7 个交付页面均 Active；`access-control` Draft 且范围外 | 后续 tasks 只拆 7 个 Active 页面；`access-control` 仅作为 Settings 分流参考 |
| 共享布局文档稳定性 | `docs/layouts/admin-layout.md` 已完成并定义响应式骨架 | 作为正式实现基线；实现偏离必须回写布局文档或 page spec |
| 设计稿定稿程度 | `design/main.pen` 已有主要页面、深/浅主题、Tablet/Mobile 与空状态参考 | 不阻塞实现；UI review 必须对照，新增图标需回写资产区 |
| Next.js 源码未落地 | 当前仓库尚无 `src/` 应用代码 | tasks 第一阶段必须创建工程基础和质量门禁 |
| OpenAPI/Orval/Scalar 链路未落地 | 当前仅有 `package.json` placeholder scripts，缺少 `docs/api/openapi.yaml`、`orval.config.ts`、`src/lib/api/generated/` | API 契约链路作为前置任务；任何 API 实现必须同步契约和生成 client |
| 持久化方案未固定 | spec 未指定数据库 | tasks 必须先选择自托管友好的持久化方案并补 quickstart；不得以内存存储交付 |
| OpenSubtitles 真实 API 细节 | 需要实现阶段核对认证、限流、错误语义 | Adapter 层隔离；契约只暴露 SubHub 统一语义，不泄漏上游差异 |
| 用户管理边界 | Users 页 page spec 包含邀请/会话风险，但完整权限矩阵范围外 | MVP 仅实现登录成员、邀请状态、暂停/恢复、风险会话摘要；复杂 RBAC 后置 |
| 性能验证数据 | 当前无实现基准 | tasks 中加入查询延迟、凭据切换和上游失败超时验证 |

## 复杂度追踪

| 例外项 | 必要原因 | 为何拒绝更简单方案 |
|---|---|---|
| OpenAPI + Orval + Scalar 链路必须首期落地 | 本 feature 同时交付管理端 API 与对外字幕 API，契约漂移会直接影响前端和外部调用方 | 只写 Route Handler 或手写 fetch 类型会导致实现、文档、生成 client 不一致，违反仓库 API 契约约定 |
| 7 个页面同时进入 MVP | spec 已明确当前 feature 交付 Login、Dashboard、Providers、Provider Detail、API Keys、Users、Settings，且这些页面共同构成单维护者运营闭环 | 只实现 Provider/API Key 页面会缺少登录保护、系统就绪判断、成员入口和设置分流，无法满足 spec 的独立验收场景 |
| 响应式作为正式范围 | `NFR-008` 和共享布局规范已将 Mobile/Tablet/Desktop 行为列为 MUST | 将响应式留作 polish 会导致后续页面结构返工，并违反 page spec 与 UI review 基线 |

## 宪章复检（Phase 1 后）

- 质量门禁、测试、UX/API 一致性、性能预算、模块化、设计真源、worktree 隔离、可追溯与 issue 同步范围均已在计划和配套产物中明确。
- 无未解决的需求澄清项。
- 当前阻塞不在需求层，而在实现层前置任务：工程基础、持久化方案、OpenAPI/Orval/Scalar 链路需要先落地。
