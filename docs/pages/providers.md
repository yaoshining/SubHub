# Page Spec: Providers

## Metadata

- **Page**: Providers
- **Route / Entry Point**: `/providers`
- **Status**: Active (v0.2.3 — Multi-Provider)
- **Last Updated**: 2026-07-01
- **Related Feature Specs**: `specs/005-provider-admin-baseline/spec.md`
- **Global Design Rules**: `DESIGN.md §14`
- **Cross-Page Dependencies**: `docs/pages/provider-detail.md`、`docs/pages/create-provider.md`

## Goal

让管理员在一页内完成所有 provider（OpenSubtitles / Xunlei）的**扫描、分诊与承接**：2 秒内知道哪些 provider 出问题、凭据池是否健康、以及是否需要进入详情深配或创建新 provider。

核心设计矛盾：OpenSubtitles 与 Xunlei 共用同一组页面，但能力不等价。页面必须做到"一眼可辨差异，不因统一而混淆"。

## Aesthetic Direction

本页不是普通的 CRUD 列表，而是**运维驾驶舱**。在不突破 `DESIGN.md` 既有字体、图标和 token 约束的前提下，页面审美必须主动规避“平均化后台模板感”。

- 采用**非对称主次结构**：顶部必须有一个主导性的全局状态区，不得只是 4 个同权重统计卡平铺。
- 视觉气质以**冷静中性底 + 单一电蓝强调**为主；不要混入第二套品牌强调色。
- 列表行要像“可操作对象”而不是“表格替代品”：type identity、状态、健康、动作必须形成明确纵深。
- Inspector 是“当前选中对象的上下文舞台”，不是右侧随手塞信息的附属栏。
- 卡片只在承担层级和承接职责时使用；避免把每一块文字都再包一层弱卡片。

## Layout

**非对称三段式控制台布局**（对应 `DESIGN.md §6.2.2 列表治理页`），桌面 1280+ 三栏并列：

```
+--Operational Pulse Strip (全宽, sticky top)-------------------------------+
| Providers  当前 4 个实例；1 个需要立即处理                 [创建 Provider]   |
| 全局脉冲: 降级 1 · 待完善 0 · 停用 0     类型: [全部▾]  状态: [全部▾]       |
|                                                   [搜索 Provider...]      |
+----------------------------------------------------------------------------+
|  +--Master List (左 2/3) -----------------------------------------------+  |
|  | [OS] OpenSubtitles Main Pool            ● Enabled  Health: ● OK       |  |
|  |       id: provider-abc123               12 min ago                    |  |
|  |       Pool: 8 active · 1 cooling · 0 quarantined   [禁用] [详情 →]   |  |
|  | [XL] Xunlei (官方接口)                   ● Enabled  Health: ● Unknown |  |
|  |       id: provider-xyz789               尚未检查                      |  |
|  |       Pool: 无凭据可配（不需要 API Key）  [禁用] [详情 →]              |  |
|  +--------------------------------------------------------------------+  |
|  +--Inspector (右 1/3) ------------------------------------------------+  |
|  |  当前选中:                                                           |  |
|  |  OS OpenSubtitles Main Pool / XL Xunlei (type-aware)                |  |
|  |  ...凭据池摘要 / 受限说明...                                          |  |
|  |  [进入配置详情 →]                                                    |  |
|  +--------------------------------------------------------------------+  |
+----------------------------------------------------------------------------+
```

### 断点行为

| 断点        | Summary Strip                                | Master List   | Inspector               | Create Drawer          |
| ----------- | -------------------------------------------- | ------------- | ----------------------- | ---------------------- |
| ≥ 1280px    | 水平单行，SummaryTile 水平铺开 + 筛选 + 按钮 | 左 2/3 卡片行 | 右 1/3 sticky           | Drawer 居中 `max-w-xl` |
| 1024–1279px | 水平单行                                     | 全宽          | 下沉到 List 下方        | Drawer `max-w-xl` 居中 |
| 768–1023px  | 2×2 网格，筛选和按钮换行                     | 全宽单列      | 点击触发的 Bottom Sheet | Drawer 90vw 居右       |
| < 768px     | 单列堆叠                                     | 全宽单列      | Bottom Sheet            | Drawer 全屏            |

## Module 1: Operational Pulse Strip（顶部状态条）

**目的**：在 2 秒内传达全局状态，并承载筛选/搜索/创建入口。

**结构**：1 个主导性的 `Operational Pulse` 面板 + 3 个紧凑状态 Tile + Type Tabs + 搜索输入 + 主按钮。

### Operational Pulse 主面板

主面板必须明显大于其余状态块，承担页面第一视觉焦点。

- 左侧：`Providers` 标题、当前实例总数、系统摘要句
- 右侧：主按钮 `创建 Provider`
- 第二行：一组可点击状态 chips（`已启用 / 降级 / 待完善 / 停用`）
- 文案风格必须短、硬、可操作，例如：
  - `当前 4 个实例；1 个需要立即处理`
  - `Xunlei 已接入，无需凭据池；OpenSubtitles 需重点关注池健康`

### Compact Status Tile 矩阵

| Tile                    | Token       | 内容                        | 可点击                 |
| ----------------------- | ----------- | --------------------------- | ---------------------- |
| Enabled                 | success     | `已启用 N`                  | 是 → 筛选切到 enabled  |
| Degraded                | warning     | `降级 N`（0 时 muted）      | 是 → 筛选切到 degraded |
| Disabled / Needs-config | destructive | `停用 N / 待完善 N`（复合） | 是 → 筛选切到 disabled |

- 点击 Tile ⇒ 全局状态筛选切换到对应值；当前激活 Tile 用 `border-strong` 强化。
- 这些 Tile 必须是**紧凑补充信息**，不能和主面板抢视觉权重。
- 视觉：`surface-elevated` 容器 + `text-xl font-semibold` 数字 + `text-[11px]` label + 顶部 2px 状态线。

### 筛选与搜索

- Type Tabs：`全部 / OpenSubtitles / Xunlei`（`Tabs` 组件，非 `Select`）
- Status Segmented Control：`全部 / Enabled / Degraded / Needs-config / Disabled`（`Select` 或 segmented，建议 `Select` 减少空间占用）
- Search Input：Lucide `Search` + placeholder `搜索 Provider 名称或 ID`；输入即时过滤
- 组合规则：type + status + keyword 三者 AND；结果数显示在列表顶部 `N 条结果`

### 主按钮

- 文案：**「创建 Provider」**（禁止写"创建 OpenSubtitles"）
- 位置：Summary Strip 右端
- 点击：打开 Create Provider Drawer（详见 `docs/pages/create-provider.md`）

### 审美约束

- 不得把顶部区做成 4 个等宽、等高、等语气的信息盒子。
- 顶部标题区必须存在一句“运营判断句”，而不只是数值罗列。
- 搜索、筛选、主按钮要形成右侧一条干净操作带，避免散落。

## Module 2: Master List（中央主区）

**布局**：使用**卡片行（Card-based rows）**而非传统 Table。理由：每行承载 6 类信息（type identity / name+id / status / health / pool / actions），Table 列会被压扁。

### 单行结构（四层信息）

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌────┐                                                                ↕ │
│  │ OS │  OpenSubtitles Main Pool        ● Enabled     Health: ● OK      │
│  │    │  id: provider-abc123                        12 min ago          │
│  └────┘  Pool: 8 active · 1 cooling · 0 quarantined [禁用] [详情 →]      │
└──────────────────────────────────────────────────────────────────────────┘
```

**四层信息分解**：

| 层                        | 位置       | 内容                                                                                             | 样式                                                                                         |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Layer 1 — Type            | 左端 48×48 | `ProviderTypeBlock`：OS=蓝底白字"OS"；XL=橙底白字"XL"+右下 Lock 图标                             | `rounded-md`，底部 4px status-color 状态条                                                   |
| Layer 2 — Identity        | 左中       | 名称（主）+ ID（副）                                                                             | 名称 `text-base font-medium`；ID `text-xs font-mono text-muted-foreground`，单行省略+tooltip |
| Layer 3 — Status & Health | 右中上     | `ProviderStatusBadge` + `HealthBlock.compact`                                                    | `gap-2` 垂直堆叠                                                                             |
| Layer 4 — Pool & Actions  | 右下       | OpenSubtitles：`PoolSizeIndicator`；Xunlei：固定文案「无凭据可配」；动作：[禁用/启用] + [详情 →] | 辅助行 `text-xs text-muted-foreground`                                                       |

### 行级审美提升规则

- 行容器要优先依靠**左侧 type block、纵向间距和底部动作线**建立层次，不靠重阴影。
- 名称与 ID 要形成一主一副的节奏，ID 不能和状态抢视觉层级。
- `详情 →` 必须比 `启用/禁用` 更安静；真正的高风险动作只能有一个视觉高点。
- Xunlei 行不能长得像“坏掉的 OpenSubtitles 行”，要像“能力不同的另一类对象”。

### 行内动作

- "禁用"按钮：`Button variant="ghost" size="sm"` + destructive hover — 仅 status=enabled/degraded 时显示
- "启用"按钮：`Button variant="default" size="sm"` — 仅 status=disabled/needs_config 时显示
- "详情 →"按钮：`Button variant="outline" size="sm"` — 始终显示

### 选中态

- 行背景 → `surface-elevated`
- 左侧 3px `border-l` 使用 `border-strong`
- 键盘：↑/↓ 切换选中、Enter 进入详情、Space 切换 enable/disable（带确认）
- 选中态存 query string `?selected=<id>`，刷新后保留

### 排序

- 默认 `priority ASC, name ASC`
- 无列头；点击主名称右侧微小的 Chevron 图标可在「优先级 / 名称 / 更新时间」间切换

### 空态与无结果

详见 `DESIGN.md §14.5` 中 `EmptyStateCard` 扩展矩阵。

- `no-providers`：无任何 provider → "还没有任何 Provider。先添加第一个 OpenSubtitles Provider。" + [创建 Provider]
- `no-results`：筛选后无匹配 → "没有符合筛选条件的 Provider。" + [清空筛选]
- `no-matches`：搜索后无匹配 → "没有匹配 'xxx' 的 Provider。" + [清空搜索]

## Module 3: Inspector（右侧检查区）

**位置**：右 1/3，sticky 顶部对齐，与 List 同步滚动。

**渲染规则**：按当前选中的 `provider.type` 分支渲染。

**审美定位**：Inspector 是“对象舞台”，而不是附属说明栏。它必须通过更宽松的留白、更清晰的 section 节奏，让用户在列表扫描后能快速完成二次判断。

### OpenSubtitles 选中

```
┌─────────────────────────────────────────┐
│  当前选中                                │
│  OS OpenSubtitles Main Pool             │
│  ● Enabled · Pool healthy               │
│                                          │
│  凭据池摘要                              │
│  8 active · 1 cooling · 0 quarantined   │
│  [████████░░░░░░░░░░░░] 88%             │
│                                          │
│  健康                                    │
│  ● OK · 12 min ago   最近错误: 无        │
│                                          │
│  调度摘要                                │
│  priority 10 · weight 1 · concurrency 3 │
│  cooldown 30s · fallback: 无            │
│                                          │
│  [进入配置详情 →]                        │
└─────────────────────────────────────────┘
```

组件：`SelectedContextHeader` + `PoolSizeIndicator` + `HealthBlock.compact` + `SchedulingSummaryList` + `CtaEnterDetail`。

### Xunlei 选中

```
┌─────────────────────────────────────────┐
│  当前选中                                │
│  XL Xunlei (官方接口) 🔒 受限           │
│  ● Enabled · Pool healthy               │
│                                          │
│  凭据池                                  │
│  ┌────────────────────────────────────┐ │
│  │  ℹ 该 provider 不需要 API Key       │ │
│  │  Xunlei 由 v0.2.3 migration 预置， │ │
│  │  当前无凭据池结构。                 │ │
│  │                                    │ │
│  │  [了解受限能力范围 →]               │ │
│  └────────────────────────────────────┘ │
│                                          │
│  健康                                    │
│  ● Unknown · 尚未执行检查                │
│                                          │
│  [进入配置详情 →]                        │
└─────────────────────────────────────────┘
```

关键差异：

- 凭据池区用 `RestrictedCapabilityCallout`（非空态卡片）
- 顶部 `🔒 受限` 徽章
- 调度摘要保持字段一致

### Inspector 审美约束

- Inspector 内部 section 建议采用“标题在上、内容在下、线性分隔”的方式，避免再堆 3 张同样的 Card。
- 进入详情按钮应放在 Inspector 视觉收束点，作为自然承接动作。
- OpenSubtitles 与 Xunlei 的 Inspector 必须共享同一骨架，但中心信息块必须不同，形成“相同框架，不同对象性格”。

## Interaction Rules

1. 列表筛选必须即时生效，不应跳转页面或打断当前选择。
2. Provider 行的**选中**与**进入详情**是两层动作（选中用于比较与检查，详情用于编辑）。
3. 降级、高风险和"待完善配置" Provider 必须在列表中一眼可识别（颜色 + Badge）。
4. 未启用、无可用凭据或仅完成首轮建档的 Provider 必须保持可见，但不得伪装成正常稳定状态。
5. 启用/禁用是即时动作，无 dirty state，调 API 完成即反馈（Toast）。
6. 启停必须带确认对话框（`AlertDialog`），具体文案见 `DESIGN.md §14.5` Hover/Focus/Selected/Disabled 矩阵。
7. 创建成功后不得强制跳转详情页；默认回到列表页、自动选中新实例。
8. Inspector 必须始终跟随当前选中的 Provider 实例，而非泛化的 provider 类型。

## Page-Specific Design Rules

- **Relevant global rules**: `DESIGN.md §14`
- **Allowed overrides**: 列表页可采用高信息密度、全宽数据布局；允许列表与检查区并排展示以支持控制台工作流。
- **Forbidden deviations**:
  - ❌ 不得用 Table 列替代卡片行
  - ❌ 不得把凭据池压力隐藏到二级页面
  - ❌ 不得用"创建 OpenSubtitles"作为入口文案
  - ❌ 不得在 Inspector 中塞凭据池完整表格
  - ❌ 不得用同一空态硬塞 OS 与 Xunlei 的差异

## Data / Dependencies

- **Data sources**: Provider 列表、type、status、health、credential pool summary、scheduling summary
- **External dependencies**: Provider 管理 API
- **Cross-page dependencies**: `docs/pages/provider-detail.md`、`docs/pages/create-provider.md`
