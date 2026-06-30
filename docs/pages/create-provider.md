# Page Spec: Create Provider

## Metadata

- **Page**: Create Provider
- **Route / Entry Point**: Operated via `create-provider-drawer.tsx`(dialog, no dedicated route); entry from `/providers` page header
- **Status**: New (v0.2.3 — Multi-Provider)
- **Last Updated**: 2026-07-01
- **Related Feature Specs**: `specs/005-provider-admin-baseline/spec.md` FR-13 ~ FR-20
- **Global Design Rules**: `DESIGN.md §14`

## Goal

提供统一的「创建 Provider」流程，type-neutral（**不写死"创建 OpenSubtitles"**），先选 type 再填配置。

## Aesthetic Direction

本流程不是“弹窗表单”，而是一次**克制但明确的建档动作**。

- Step 1 要让用户明确感知“正在选择对象类型”，不能只是两个普通选择卡。
- Step 2 要像“首轮建档”，强调最少必填信息和后续去详情页继续深配的节奏。
- Drawer 内部必须形成明显的主次秩序：标题、对象摘要、表单、后续说明。
- Xunlei 的不可创建状态必须表达为“已有且受控”，而不是“灰掉不可点”这么简单。

## Design Constraints

- 列表页主入口按钮必须为「创建 Provider」，不得预设 type
- 创建流程第一步是先选择 provider type
- Xunlei 不允许通过 UI 重复创建（单实例、migration seeded）
- Xunlei 若有已有实例，必须表达「已接入 / 不可重复创建」
- OpenSubtitles 与 Xunlei 的第二页表单结构完全不同
- Base URL 不入库、不由 UI 配置

## Flow

**Two-Step Drawer**（不要新开页面；Drawer 基于 `create-provider-drawer.tsx` 既有组件改造）

```
Step 1: Select Type                    Step 2: 首轮建档（仅 OS）
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  ← 创建 Provider              │       │  ← 创建 Provider              │
│  ──────────────────────────── │       │  ──────────────────────────── │
│                              │       │                              │
│  ┌──────┐  ┌──────┐         │       │  Provider Name                │
│  │      │  │ 🔒   │         │       │  [____________________]       │
│  │ OS   │  │ XL   │         │       │                              │
│  │      │  │ 已接  │         │       │  Initial API Key              │
│  │ 下一步│  │ 入   │         │       │  [____________________]       │
│  └──────┘  └──────┘         │       │                              │
│                              │       │                              │
│  OpenSubtitles              │       │  调度初始值（可后续深配）      │
│  独立字幕源，需要上游凭据    │       │  Priority [10]  Weight [1]    │
│  认证，支持凭据池与健康检查  │       │  Concurrency [3] Cooldown[30] │
│                              │       │                              │
│  说明: 选中后进入首轮建档    │       │  ℹ 创建后继续前往详情页完成    │
│  先录入名称与首个 API Key    │       │    轮换、回退与凭据池维护      │
│                              │       │                              │
│                              │       │  [Back]  [Create Provider]    │
└──────────────────────────────┘       └──────────────────────────────┘
```

### Step 1: Type Selector

**组件**：`ProviderTypeSelector`（新增）。

结构：
```
typography: "选择 Provider 类型"（page-title）
subtitle:   "选择一个 provider 类型开始配置。不同 provider 类型有不同的配置项。"（muted）

Card Grid（2 columns, ≥640px 保持横向）
├── Card: OpenSubtitles (clickable, hover:border-primary)
│   ├── 左上: Type Badge "OpenSubtitles"
│   ├── 中部: Description "独立字幕源，支持凭据池、健康检查与后续轮换策略"
│   └── 底部: [下一步 →]
│   Effect: select → 高亮边框 + 底部 meta row 强化
└── Card: Xunlei (disabled or locked)
    ├── 左上: Type Badge "Xunlei" + 🔒 icon
    ├── 中部: Description "系统预置实例，当前不允许通过 UI 重复创建"
    └── 底部: "已接入 / 不可重复创建" (text-xs muted)
    Effect: cursor-not-allowed, no selection possible
```

**交互规则**：
- 点击 OS Card → 高亮边框 `border-primary` + Step 2 出现（淡入动画 `fadeIn 200ms`）
- 点击 Xunlei Card → 无选中效果
- 如果 `hasExistingXunlei === true`，Xunlei Card 下方显示 `Alert variant="info"`：「已有 Xunlei 实例在运行。Xunlei 为预置 provider，单实例不可重复创建。如需重新接入请联系运维。」
- Step 1 画面必须保留一个**已选对象摘要卡**位置，用于承接进入 Step 2 前的上下文连续性。

**空态 / 无 provider type 可选时**（极端情况）→ `EmptyStateCard` scope=no-types：「暂无可创建的 provider 类型，请联系系统管理员」。

### Step 2: Initial Instance Form（仅 OpenSubtitles 路径）

复用 Step 1 Drawer 的右半 / 下一屏。同一 Drawer 内 transition（不关闭、不跳转）。

**字段清单**：

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| Provider Name | Input | ✅ | 2–45 字符 |
| Initial API Key | Input `type="password"` | ✅ | 首个上游凭据 |
| Priority | Input `number` | 默认 10 | |
| Weight | Input `number` | 默认 1 | |
| Concurrency | Input `number` | 默认 3 | |
| Cooldown (s) | Input `number` | 默认 30 | |

**表单区划**（`Separator` 分隔）：

```
Selected Provider（对象摘要）
  OpenSubtitles / Full admin capability / credentials supported

Basic Info（基础信息）
  Provider Name
  Initial API Key

Scheduling Defaults（初始调度值）
  Priority  Weight  Concurrency  Cooldown

Next Steps（后续说明）
  创建后前往详情页继续配置 Rotation / Fallback / Credential Pool
```

**交互规则**：
- 所有校验在点击「创建」时一次性触发
- 字段级错误：`label + msg` inline style，红色描边
- 创建中：Button loading spinner + 所有输入 disabled
- 创建成功：Drawer 关闭 + Toast「Provider 已创建」+ 列表页刷新
- 创建失败：Toast「创建失败」+ Drawer 保留 + 表单保留 + 全局错误 Alert
- 基本信息字段在各 provider type 间不共享；调度策略字段共享
- Step 2 必须存在一个对象摘要区，明确用户当前正在创建的是哪个 provider 类型。

### Step 2 审美约束

- 不得把 Step 2 做成一张普通长表单；必须分成“对象摘要 / 基础信息 / 初始调度值 / 后续说明”四层。
- `Initial API Key` 是本步最关键输入，视觉上要比数值类字段更突出。
- 数值字段是“初始值”，语气必须比基础信息更轻，不应与核心建档输入抢层级。
- Footer 主按钮必须是 `Create Provider`，次按钮是 `Back`，避免继续出现“取消 / 创建”这一类普通弹窗语气。

## Xunlei Already Provisioned 场景

当用户访问创建入口时，若后端返回 `hasExistingXunlei: true`：

- Step 1 Xunlei Card: `disabled` + `cursor-not-allowed` + locked icon
- Card 下方: `Alert variant="info"`：「当前已有 Xunlei 实例运行中，Xunlei 为预置 provider，不支持通过此界面额外创建。」
- OS Card: 不受影响
- 若**所有** provider type 均已 provisioned（技术上不可能但有此情况的安全路径）→ `EmptyStateCard` scope=all-provisioned：「所有 provider 类型已就绪，无需创建新实例。如有新增类型需求，请查阅 provider 接入文档。」

## 类型选择器状态表

| 状态 | Xunlei Card | OS Card | 说明 |
|------|-------------|---------|------|
| Boot（初始） | 可选（默认） | 可选 | 无 pre-selected |
| OS Selected | 可选（不联动） | 高亮 + Step 2 | |
| Xunlei Clicked | Alert 弹提示 | 不变 | 不允许选中 |
| Loading | Spinner 覆盖 | Spinner 覆盖 | 从后端请求 type |
| OS Created | 不变 | 不可重新选中 | Drawer 关闭 |
| Error | fallback 显示 | fallback 显示 | 创建失败 |

## Page-Specific Design Rules

- **Relevant global rules**: `DESIGN.md §14`
- **Allowed overrides**:
  - 只有 OS 需要第二步表单；Xunlei 路径不存在第二步
  - 调度策略字段在 OS 创建时与 detail 页重复，但此处作为初始值设置（detail 页可后改）
- **Forbidden deviations**:
  - ❌ 不得把 Base URL 作为字段暴露
  - ❌ 不得在 OS 创建过程中创建 Xunlei 实例
  - ❌ 不得在 create flow 中做凭据管理（那是 detail page 的职责）
  - ❌ 不得在触发创建后重新选择 type
