# 实施计划: 字幕 API 验证工具（Subtitle API Validator）

**分支**: `006-subtitle-api-validator` | **日期**: 2026-07-14 | **规格**: `specs/006-subtitle-api-validator/spec.md`

**输入**: 来自 `specs/006-subtitle-api-validator/spec.md` 的功能规格

**说明**: 本文件由 `/speckit.plan` 生成并填充；当前阶段只完成 plan，不生成 tasks。

## 摘要

本功能交付一个仅管理员可访问的 Subtitle API Validator 页面，用于在不影响正式字幕搜索 API 行为的前提下，快速验证单个 provider 的搜索链路与下载链路是否正常。方案采用 admin-only validator facade：前端新增 `/admin/subtitle-api-validator` 诊断工作台，后端新增 `/api/admin/subtitle-validator/*` 路由与服务端映射层，底层复用现有 provider registry / repository / adapter / download 能力，并将空结果、超时、provider error、下载失败与权限拒绝明确区分为独立诊断状态。

## 设计上下文

**全局设计系统**: `DESIGN.md`

**相关页面规范**:

- `docs/pages/subtitle-api-validator.md`
- `docs/pages/providers.md`
- `docs/pages/provider-detail.md`
- `docs/layouts/admin-layout.md`

**已评审的设计输入**:

- `design/main.pen` 中 `v0.2.3 / Subtitle API Validator – Default / Selected Provider / Searching / Search Success / Empty Results / Search Error / Download Success / Download Error` 的深浅主题 16 个 frame
- `specs/006-subtitle-api-validator/spec.md`

## 技术上下文

**语言/版本**: TypeScript 6.x；React 19；Next.js 16 App Router

**核心依赖**: Next.js、React、Zod、lucide-react、sonner、TailwindCSS、shadcn/ui、Orval、Drizzle ORM

**存储**: PostgreSQL / Neon 为正式数据库；PGlite 用于快速数据库单测层；本功能默认不新增长期业务持久化实体

**测试**: Vitest + Testing Library；contract tests；integration tests；必要时 PGlite 支撑 admin API / repository 快速数据库测试

**目标平台**: SubHub 管理后台 Web 页面（桌面优先，小屏降级可用）

**项目类型**: 单体 Web 应用（Next.js 全栈，App Router + server routes）

**性能目标**: 页面信息架构支持管理员 3 秒内看清 provider 状态、10 秒内完成一次搜索验证、20 秒内定位一次明显链路问题

**约束条件**: admin-only；不得暴露 provider secret / token；不得改变正式 `src/app/api/subtitles/*` caller-key 行为；必须支持 provider-aware 参数映射；必须优先复用现有 provider 调用架构

**规模/范围**: 1 个新 admin 工具页，3 个新 admin API 路由，1 个 validator 服务 facade，若干页面级组合件，覆盖 unit / contract / UI / integration 四层测试

## 宪章检查

_门禁：必须在第 0 阶段研究前通过，并在第 1 阶段设计后复检。_

- 已定义代码质量门禁：`pnpm format:write`、`pnpm lint`、`pnpm typecheck`，且需在交付前执行。
- 已定义必需测试策略：unit（参数映射 / 状态归类）、contract（admin validator API）、UI（工作台状态）、integration（验证闭环 + 正式 API 不受影响）。
- 已定义对外行为的 UX/API 一致性约束：validator 仅服务 admin 诊断语义；正式 `subtitles` caller-key API 契约与行为保持不变。
- 已定义可度量性能预算与验证方法：重点验证状态反馈可见性、请求耗时摘要与快速定位路径，而非追求吞吐量指标。
- 已记录面向长期可维护性的简洁化/模块化方案：新增 admin validator facade，避免把诊断语义直接压进正式搜索 / 下载路由。
- 已识别设计来源（`DESIGN.md` + `docs/pages/subtitle-api-validator.md` + `design/main.pen`），并映射到功能范围。
- 计划已声明无需对 `DESIGN.md` 增补系统级规则；若实现暴露跨页面新规则，再回到设计真源确认。
- 已明确 worktree 隔离：当前 worktree 仅对应 active feature `006-subtitle-api-validator`。
- 已明确可追溯关系：feature id `006` 映射到 `specs/006-subtitle-api-validator/`、分支 `006-subtitle-api-validator` 与后续主 issue。
- 已明确 issue 同步范围：若后续生成 task issues，仅允许同步 `specs/006-subtitle-api-validator/` 范围，不跨 spec 混批。

## 设计映射

### 适用规则

- **全局规则**: `DESIGN.md` 中 `2. 产品定位与界面原则`、`6.2 页面布局模式`、`6.3 密度原则`、`7.1 按钮`、`7.2 卡片与面板`、`7.5 状态标签、Badge、Chip`、`7.6 Inline Callout 与 Notice`、`7.8 导航`、`7.9 组件系统基线`、`8. 状态与反馈规则`、`9. 数据展示与技术信息呈现`
- **页面规则**: `docs/pages/subtitle-api-validator.md` 中 `Information Architecture`、`Layout`、`Modules / Sections`、`Key States`、`Interaction Rules`、`Component Inventory`、`Component Patterns (shadcn/ui)`
- **视觉第一真源**: `design/main.pen` 中 Subtitle API Validator 的 16 个 canonical frames；样式、气质、布局细节、状态层次优先服从设计稿

### 计划中的文档变更

- **更新 `DESIGN.md`**: No；当前功能复用既有 admin console 规则，不新造系统级设计语言
- **更新既有页面规范**: `docs/pages/subtitle-api-validator.md`（仅当实现补足设计稿已明确但页面规范未写出的细边界时）；`docs/pages/providers.md` / `docs/pages/provider-detail.md` 仅在导航或职责边界需同步时更新
- **新建页面规范**: None（`docs/pages/subtitle-api-validator.md` 已存在）

## 项目结构

### 文档（本功能）

```text
specs/006-subtitle-api-validator/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### 设计文档（仓库根目录）

```text
DESIGN.md
docs/
├── layouts/
│   └── admin-layout.md
└── pages/
    ├── providers.md
    ├── provider-detail.md
    └── subtitle-api-validator.md
design/
└── main.pen
```

### 源码（仓库根目录）

```text
src/
├── app/
│   ├── (admin)/
│   │   ├── providers/
│   │   └── subtitle-api-validator/
│   └── api/
│       ├── admin/
│       │   ├── providers/
│       │   └── subtitle-validator/
│       └── subtitles/
├── components/
│   ├── admin/
│   ├── providers/
│   └── ui/
├── lib/
│   ├── api/
│   │   ├── generated/
│   │   ├── providers.ts
│   │   └── subtitle-validator.ts
│   └── errors.ts
└── server/
    ├── api/
    ├── providers/
    ├── services/
    ├── storage/
    └── subtitles/

tests/
├── contract/
├── helpers/
├── integration/
└── ui/
```

**结构决策**: 保持现有 Next.js 单体项目结构；新增页面放在 `src/app/(admin)/subtitle-api-validator/`，新增 admin API 放在 `src/app/api/admin/subtitle-validator/`，核心 validator 逻辑落在 `src/server/subtitles/`，页面级组合件放在 `src/components/providers/`，以复用现有 provider 管理上下文而非另建平行模块。

## 设计保真实施策略

- 样式看 `design/main.pen`，结构 / 状态边界看 `docs/pages/subtitle-api-validator.md`，功能边界看 `specs/006-subtitle-api-validator/spec.md`。
- 实施过程中不得为了实现方便弱化设计稿已经表达的状态层次、信息密度、控制台气质或布局意图。
- 若实现暴露页面级差异，必须在同一 feature 中更新 `docs/pages/subtitle-api-validator.md`。
- 若实现暴露跨页面新规则，才允许回写 `DESIGN.md`；当前计划默认不触发。
- 一旦出现设计稿与页面规范在信息架构、关键交互、状态语义上的冲突，必须暂停并向用户确认，不自行折中。

## 复杂度追踪

> 当前无宪章门禁例外；本节留空。
