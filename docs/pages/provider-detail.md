# Page Spec: Provider Detail

## Metadata

- **Page**: Provider Detail
- **Route / Entry Point**: `/providers/:providerId`
- **Status**: Active (v0.2.3 — Multi-Provider)
- **Last Updated**: 2026-07-01
- **Related Feature Specs**: `specs/005-provider-admin-baseline/spec.md`
- **Global Design Rules**: `DESIGN.md §14`
- **Cross-Page Dependencies**: `docs/pages/providers.md`、`docs/pages/create-provider.md`

## Goal

为管理员提供单个 Provider 实例的完整运营配置面，集中管理启停、调度策略、凭据池（或受限能力说明）与最近行为。要求：

1. OpenSubtitles 与 Xunlei 使用同一页面结构，但凭据池区必须 type-aware 整段替换
2. 启停是即时动作（不走 Save），调度策略编辑走独立 Save 按钮
3. 创建一个支持宽屏双栏、窄屏单栏的 responsive section stack

## Aesthetic Direction

本页应呈现“技术对象的精密维护感”，而不是通用设置页。

- 顶部 `Context Strip` 要像对象抬头，不是普通返回条。
- 左列 section 要形成从**状态判断 → 策略编辑 → 凭据/限制 → 行为证据**的线性叙事。
- 右侧 Inspector 更像“只读技术侧写”，强调时间、类型、风险门槛。
- 避免把四个 section 都做成同权重卡片堆叠；允许通过分隔线、留白和标题位置建立节奏。
- OpenSubtitles 与 Xunlei 的差异必须由**结构不同**来表达，不只靠一句说明文字。

## Layout

**Context Strip + Section Stack**（对应 `DESIGN.md §6.2.3`）。桌面 ≥ 1280px 显示右侧 Inspector。

```
+--ProviderContextStrip (全宽, surface-elevated, left border-l by status)---+
|  ← 返回列表                                               [刷新]          |
|  [OS/XL] Provider Name          ● Enabled               11 min 前更新     |
|          id: provider-abc123                                              |
|  ⚠ 含未保存变更（仅 dirty 时显示）                                       |
+----------------------------------------------------------------------------+
|  +--Section Stack (左 2/3) -------------------------------------------+  |
|  |                                                                     |  |
|  |  A. 启停与状态                                                     |  |
|  |     Status Switch [● ────] Enabled    [启用/禁用]                     |  |
|  |     Health: ● OK · 11 min ago   Last Error: 无                     |  |
|  |                                                                     |  |
|  |  B. 调度策略 [保存]                                                |  |
|  |     Priority [10] · Weight [1] · Concurrency [3] · Cooldown [30]   |  |
|  |     Fallback [— 选择 provider —▾]                                   |  |
|  |     ☐ Rotation Enabled (OS only; Xunlei 隐藏)                      |  |
|  |                                                                     |  |
|  |  C. 凭据池 / 受限说明 (type-aware)                                 |  |
|  |     OS → [Credential Table] / Xunlei → [RestrictedCapabilityCallout] |  |
|  |                                                                     |  |
|  |  D. 最近行为                                                       |  |
|  |     Timeline (源自 provider-activity.tsx 增强)                      |  |
|  +--------------------------------------------------------------------+  |
|  +--Inspector (右 1/3, ≥1280px only) --------------------------------+  |
|  |  健康摘要                                                          |  |
|  |  ● OK · 11 min ago   错误: 无                                      |  |
|  |                                                                     |  |
|  |  元信息                                                            |  |
|  |  创建: 2026-05-23  更新: 2026-06-30  Type: OpenSubtitles           |  |
|  |                                                                     |  |
|  |  危险区 (仅 status=disabled + 无凭据时)                           |  |
|  |  [🗑 删除 Provider]                                                |  |
|  +--------------------------------------------------------------------+  |
+----------------------------------------------------------------------------+
```

### 断点行为

| 断点 | Section Stack | Inspector | Save 按钮 |
|------|---------------|-----------|-----------|
| ≥ 1280px | 左 2/3 | 右 1/3 sticky | Section B 内联 |
| 1024–1279px | 全宽单栏 | 下沉到 Section D 之后 | Section B 内联 |
| 768–1023px | 全宽单栏 | 下沉到 Section D 之后；危险区移至 Section C 末尾 | Section B 内联 |
| < 768px | 全宽单栏 | 下沉到 Section D 之后 | `fixed bottom-0 inset-x-0` sticky |

### 结构审美约束

- 顶部 Context Strip 必须是本页第一视觉锚点，承担“对象识别 + 状态判断 + 返回关系”三件事。
- Section 标题优先作为裸标题或轻容器标题，不要四个模块都做成同款厚卡片。
- Save 按钮必须和“调度策略”视觉绑定，不能漂浮成全局孤立主按钮。

## Module A: 启停与状态

**组件**：`Switch` + `ProviderStatusBadge` + `HealthBlock.detailed`。

**交互规则**：
- Switch 切换立即调 API（`POST .../enable` / `POST .../disable`），**无 dirty state**，不进 unsavedChanges。
- 切换前必须弹出 `AlertDialog` 确认。
  - 启用确认：「启用 {{ Type }} Provider？启用后该 provider 将立即参与聚合搜索调度。」
  - 禁用确认：「禁用 {{ Type }} Provider？禁用后聚合搜索将不再调用此 provider。相关凭据不会被删除，可随时重新启用。」
  - 禁用按钮 `variant="destructive"`；启用按钮 `variant="default"`。
- Health 与 Last Error 为只读展示。Health 显示 dot + 状态 + 时间；Error 显示无/截断 80 字 + tooltip。

## Module B: 调度策略（核心配置）

**组件**：`ProviderPolicyForm`（既有组件强化）。

**字段清单**：

| 字段 | OpenSubtitles | Xunlei |
|------|---------------|--------|
| Priority（优先级） | Input `type="number"` | 同左 |
| Weight（权重） | Input `type="number"` | 同左 |
| Concurrency Limit（并发上限） | Input `type="number"` | 同左 |
| Cooldown Seconds（冷却秒数） | Input `type="number"` | 同左 |
| Fallback Provider（回退目标） | Select（按 type 分组列出其他 provider） | 同左 |
| Rotation Enabled（凭据轮换） | Switch | ❌ 整行隐藏 |

**type-aware 规则**：
- `Rotation Enabled` 仅在 `type === 'opensubtitles'` 时渲染整行；`type === 'xunlei'` 时不渲染。
- Fallback 的 Select 选项不得包含自身（禁用 + tooltip）。

**Save 行为**：
- Save 按钮在 Section B 右上角，**仅对本 Section 的 dirty state 生效**。
- 保存成功 → Toast「调度策略已保存」+ dirty 徽章消失 + `updatedAt` 刷新。
- 保存失败 → Toast「保存失败」+ 表单保留 + 字段级 inline 错误。
- 字段级错误（如 fallback 自身/循环）加 `Alert variant="destructive"` 紧贴字段。

### 审美提升规则

- 表单应采用“基础信息 / 调度策略”两段式，而不是一组平铺数字输入。
- 数字字段宜以 2×2 或 3+1 的有节奏编排出现，避免一长排相同输入框。
- `Rotation Enabled` 作为布尔能力，视觉上应像策略开关，而不是普通字段。

## Module C: 凭据池 / 受限说明（type-aware 整段替换）

**核心规则**：OpenSubtitles 与 Xunlei 在此模块**必须使用完全不同的组件**，不得用同一组件加 if-else 隐藏。

### OpenSubtitles 分支

```
┌────────────────────────────────────────────────────────┐
│  凭据池 / Token 管理                          [+ 新增凭据]│
│  ──────────────────────────────────────────────────    │
│  ┌──────────┬──────────┬─────────┬─────────┬─────────┐│
│  │ Token 摘要│ 状态     │ 剩余额度│ 最近异常│ 操作    ││
│  ├──────────┼──────────┼─────────┼─────────┼─────────┤│
│  │ abcd...12 │ ● 活跃   │ 78%    │ —       │ [隔离]  ││
│  │ efgh...34 │ ⏸ 冷却中 │ —      │ 429     │ [隔离]  ││
│  │ ijkl...56 │ ⊘ 已隔离 │ —      │ auth    │ [恢复]  ││
│  └──────────┴──────────┴─────────┴─────────┴─────────┘│
│  ⚠ 1 个凭据处于冷却中                                   │
└────────────────────────────────────────────────────────┘
```

组件：`ProviderCredentialTable`（既有，增强状态 Badge 对齐 §6.2）。
- 无凭据时：`EmptyStateCard` scope=no-credentials, type=opensubtitles →「当前无活跃凭据，对外服务已中断，请添加至少一个 API Key。」

### Xunlei 分支

```
┌────────────────────────────────────────────────────────┐
│  凭据池                                    🔒 不适用    │
│  ──────────────────────────────────────────────────    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ℹ Xunlei 不需要 API Key                          │  │
│  │                                                    │  │
│  │  此 provider 调用上游官方接口，认证由网关层处理。    │  │
│  │  当前版本下不维护凭据池结构，因此:                  │  │
│  │   · 不显示「新增凭据」按钮                          │  │
│  │   · 不显示凭据列表                                  │  │
│  │   · Rotation / 隔离 / 恢复等动作不适用              │  │
│  │                                                    │  │
│  │  [了解 Xunlei 适配层 →]                             │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

组件：`RestrictedCapabilityCallout`（见 `DESIGN.md §14.5`）。

### 审美提升规则

- OpenSubtitles 分支要体现“可操作池”的密度和秩序感。
- Xunlei 分支要体现“受限但清楚”的平静感，不得做成报错样式或残缺空白。
- 该模块是本页最强的 type-aware 证据，必须一眼看出不是同一类对象。

## Module D: 最近行为

**组件**：`ProviderActivity`（既有，升级为 Timeline 形态）。

**结构**：

```
最近行为                            时间范围: [近 24h ▾]
──── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
● 12:14:32   OK      凭据 abcd...12 调用成功
● 12:14:28   FAIL    凭据 efgh...34 触发 429 → 冷却
● 12:13:55   SWITCH  凭据轮换 abcd...12 ← efgh...34
● 12:13:01   HEALTH  health-check pass
[查看完整日志 →]
```

- 时间列 `font-mono text-xs`，固定宽度 `w-24`
- 事件类型 Badge：OK→success / FAIL→destructive / SWITCH→info / HEALTH→muted
- 单行点击展开内联详情

## Right Inspector（仅 ≥ 1280px）

**结构**：

```
健康摘要
──── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
● OK · 11 min ago
错误: 无

元信息
──── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
创建: 2026-05-23 14:01
更新: 2026-06-30 09:12
Type: OpenSubtitles
Status: Enabled

危险区 (仅 status=disabled + 凭据=0)
──── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
[🗑 删除 Provider]
```

**type-aware 危险区**：
- OpenSubtitles：按钮仅 `status=disabled` 且 `availableCredentialCount === 0` 时启用；其余 disabled + tooltip「仅在停用且无活跃凭据时可删除」。
- Xunlei：**不显示删除按钮**；显示文字「Xunlei 实例由 migration 预置，请联系运维删除。」

### Inspector 审美约束

- Inspector 内部优先用标题、数据行、分隔线组织信息，不建议再嵌套多个次级卡片。
- 时间、类型、状态等技术元信息要更像“设备铭牌”，可用 `font-mono` 辅助局部信息，但不能让整栏过度代码化。
- 危险区只能在满足条件时出现，避免页面长期处于“危险提示过载”。

## Interaction Rules

1. 所有编辑操作围绕"当前 Provider 实例"上下文，不与全局凭据混用。
2. 保存前允许连续调整多个字段，但必须用 dirty 徽章提示未保存。
3. 存在未保存变更时，返回列表/切换实例/刷新页面必须给出确认（`AlertDialog`）。
4. 隔离异常凭据是显式动作，执行后立即从活跃池移出（不进 dirty state）。
5. 若某 provider 当前无活跃凭据，Section C 顶部优先提示风险。

## Page-Specific Design Rules

- **Relevant global rules**: `DESIGN.md §14`
- **Allowed overrides**:
  - Section B 的 Save 按钮按 section 局部 dirty，非全局 dirty（与 `provider-detail.md` 前版本的"全局未保存变更指示"略有差异；此处选择更细粒度方案）。
  - Xunlei 的 Credential Pool 区整段替换为 `RestrictedCapabilityCallout`，与 OpenSubtitles 结构完全不同。
- **Forbidden deviations**:
  - ❌ 不得把 Provider 凭据与下游调用方 Key 混在一张表里
  - ❌ 不得把异常隔离设计成隐式自动消失
  - ❌ 不得用同一组件硬塞 OS 与 Xunlei 的凭据区差异
  - ❌ 不得在 Xunlei 详情页渲染「新增凭据」按钮
