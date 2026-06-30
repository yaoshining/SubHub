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
Step 1: Select Type                    Step 2: 填写配置（仅 OS）
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  ← 创建 Provider              │       │  ← 创建 Provider              │
│  ──────────────────────────── │       │  ──────────────────────────── │
│                              │       │                              │
│  ┌──────┐  ┌──────┐         │       │  Provider Name                │
│  │      │  │ 🔒   │         │       │  [____________________]       │
│  │ OS   │  │ XL   │         │       │                              │
│  │      │  │ 已接  │         │       │  OpenSubtitles Username       │
│  │ 选择  │  │ 入   │         │       │  [____________________]       │
│  └──────┘  └──────┘         │       │  OpenSubtitles Password       │
│                              │       │  [____________________]       │
│  OpenSubtitles              │       │                              │
│  独立字幕源，需要 API Key    │       │  Priority                     │
│  认证，支持多 Token 管理    │       │  [_____]                      │
│  和健康检查                 │       │  Weight                       │
│                              │       │  [1]                         │
│  说明: ℹ 选择后下一步        │       │  Concurrency Limit            │
│  填写 API Key 与初始配置    │       │  [3]                         │
│                              │       │  Cooldown [30]  Rotation ☐   │
│                              │       │  Fallback [— 选择 —▾]        │
│                              │       │                              │
│                              │       │  [取消]  [创建]               │
└──────────────────────────────┘       └──────────────────────────────┘
```

### Step 1: Type Selector

**组件**：`ProviderTypeSelector`（新增）。

结构：
```
typography: "选择 Provider 类型"（page-title）
subtitle:   "选择一个 provider 类型开始配置。不同 provider 类型有不同的配置项。"（muted）

Card Grid（2 columns, ≥640px 变水平）
├── Card: OpenSubtitles (clickable, hover:border-primary)
│   ├── 左上: Type Badge "OpenSubtitles"
│   ├── 中部: Description "独立字幕源，需要 API Key 认证……"
│   └── 底部: [下一步 →] (默认出现)
│   Effect: select → 高亮边框, 展开 next btn
└── Card: Xunlei (disabled or locked)
    ├── 左上: Type Badge "Xunlei" + 🔒 icon
    ├── 中部: Description "下载加速源，由系统预置实例……"
    └── 底部: "已接入 / 不可重复创建" (text-xs muted)
    Effect: cursor-not-allowed, no selection possible
```

**交互规则**：
- 点击 OS Card → 高亮边框 `border-primary` + Step 2 出现（淡入动画 `fadeIn 200ms`）
- 点击 Xunlei Card → 无选中效果
- 如果 `hasExistingXunlei === true`，Xunlei Card 下方显示 `Alert variant="info"`：「已有 Xunlei 实例在运行。Xunlei 为预置 provider，单实例不可重复创建。如需重新接入请联系运维。」

**空态 / 无 provider type 可选时**（极端情况）→ `EmptyStateCard` scope=no-types：「暂无可创建的 provider 类型，请联系系统管理员」。

### Step 2: Instance Form（仅 OpenSubtitles 路径）

复用 Step 1 Drawer 的右半 / 下一屏。同一 Drawer 内 transition（不关闭、不跳转）。

**字段清单**：

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| Provider Name | Input | ✅ | 2–45 字符 |
| OS Username | Input | ✅ | |
| OS Password | Input `type="password"` | ✅ | |
| Priority | Input `number` | 默认 10 | |
| Weight | Input `number` | 默认 1 | |
| Concurrency | Input `number` | 默认 3 | |
| Cooldown (s) | Input `number` | 默认 30 | |
| Rotation Enabled | Switch | 默认 off | |
| Fallback | Select | 可选 | 选项列表不含自身 |

**表单区划**（`Separator` 分隔）：

```
Basic Info（基础信息）
  Provider Name
  OS Username + OS Password

Scheduling（调度策略）
  Priority  Weight  Concurrency  Cooldown  Rotation  Fallback
```

**交互规则**：
- 所有校验在点击「创建」时一次性触发
- 字段级错误：`label + msg` inline style，红色描边
- 创建中：Button loading spinner + 所有输入 disabled
- 创建成功：Drawer 关闭 + Toast「Provider 已创建」+ 列表页刷新
- 创建失败：Toast「创建失败」+ Drawer 保留 + 表单保留 + 全局错误 Alert
- 基本信息字段在各 provider type 间不共享；调度策略字段共享

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
