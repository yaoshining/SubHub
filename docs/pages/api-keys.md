# Page Spec

## Metadata

- **Page**: API Keys
- **Route / Entry Point**: `api-keys.html` / `/api-keys`
- **Status**: Active
- **Last Updated**: 2026-05-24
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

让管理员把下游调用方 Key 当作持续运营的产品资源来管理：先判断当前是否仍有可用入口，再对单个 Key 执行生成、轮换、停用与使用情况回看，确保统一字幕出口只被有效调用方访问。

## Audience / Scenario

- **Primary user**: 管理员 / 平台维护者
- **Primary scenario**: 为外部应用签发访问凭据，识别即将失控的调用方，执行轮换或停用，并核查最近使用情况
- **Frequency / importance**: 高频治理页；直接决定对外 API 是否可控、可回收、可追踪

## Modules / Sections

1. **页头与关键动作区**: 展示页面目的、当前治理语境，并提供“轮换当前 Key”和“生成新 Key”主动作。不承载主题切换入口（主题切换统一位于 Sidebar Footer，见 `DESIGN.md §3.1`）。
2. **Key 摘要卡区**: 展示 Active keys、Rotations / 30d、Suspended、Quota alerts 四类信号，帮助管理员先判断整体可用性与风险。
3. **Key inventory 区**: 以高密度清单展示调用方、受控 Key 片段、环境与状态，并支持按环境 / 状态筛选。
4. **生成与授权区**: 为新调用方填写名称、环境、配额与 Scope，形成首轮建档入口。
5. **Selected key 详情区**: 围绕当前选中 Key 展示完整业务信息、最近 24h 使用、最近轮换结果、停用动作，以及受控 reveal / copy 行为。
6. **治理说明区**: 用简洁规则解释轮换、停用与风险处置的边界，帮助维护者理解当前 MVP 的治理原则。

## Key States

- **Default state**: 展示摘要卡、Key inventory、生成与授权表单，以及当前选中 Key 的详情。
- **Loading state**: 先展示页头、摘要卡和 inventory 骨架，再加载选中项详情与最近使用信息。
- **Empty state**: 尚未创建任何调用方 Key 时，页面必须突出“创建首个 Key”的表单与用途说明，并明确当前对外服务尚不可用。
- **No-selection state**: 当页面已有 Key，但当前没有选中项时，右侧详情区必须显示“未选择 Key”的上下文空态，明确提示从左侧 inventory 选择对象；不得留白，也不得残留上一条 Key 的旧数据。
- **Error state**: 创建、停用、轮换或详情加载失败时，必须指出失败对象与恢复动作，并保留当前 inventory 与已知上下文。
- **Permission / access state**: 只读用户可查看摘要、inventory 和业务状态，但不能轮换、停用、reveal 或 copy 完整明文。
- **Reveal window state**: 新 Key 创建后或当前 Key 轮换成功后，Selected key 详情进入受控窗口，允许显示完整明文并执行复制；窗口结束后仅保留受控片段与业务信息。
- **Success state**: 创建、轮换或停用成功后，页面必须明确反馈结果，并保持当前选中上下文不丢失。

## Content Hierarchy

- **Primary information**: 当前是否仍有活跃 Key、哪个 Key 正在接近风险、当前选中 Key 是否需要立刻轮换或停用。
- **Secondary information**: 调用方名称、环境、Scope、配额、状态、最近 24h 使用、最近轮换结果与当前版本提示。
- **Tertiary information**: 治理说明、辅助提示、异常注记、解释性文案。
- **Primary actions**: 生成新 Key、轮换当前 Key、停用当前 Key。
- **Secondary actions**: 筛选 inventory、切换当前选中对象、在受控窗口内 reveal / copy 完整明文。

## Interaction Rules

- Key inventory 的目标是**可识别与可比较**，不是一次性完整展示所有长字段。列表必须优先保证扫描效率。
- 调用方名称允许以两层信息呈现：主行显示名称，副行显示环境或 Scope 摘要；名称过长时最多两行并截断。
- Key 列只展示受控片段（如前后缀），使用等宽字体；不得在 inventory 中直接暴露完整明文。
- 右侧 Selected key 详情必须显示完整业务信息，包括完整调用方名称、环境、Scope、配额、最近使用和最近轮换结果；即使列表已截断，详情也应帮助管理员确认对象。
- 当页面存在可见 Key 时，应默认自动选中首个可见对象；No-selection state 只作为兜底状态，不应成为常态首屏。
- 当当前没有选中项时，右侧面板显示“未选择 Key”空态，说明下一步是从左侧 inventory 选择对象；该状态不得显示任何旧的业务详情、受控片段或 reveal / copy 动作。
- 完整明文只允许在新建 / 轮换后的受控窗口内通过眼睛按钮 reveal，并允许通过复制按钮写入剪贴板；窗口结束后移除 reveal / copy，仅保留参考片段。
- Key inventory 的筛选必须保留当前选中上下文；若当前选中对象被筛选隐藏，详情区仍需保留该对象并明确提示“当前对象不在筛选结果中”。
- 停用与轮换是不同动作：停用应立即阻止新请求，轮换应创建新版本并更新当前状态，不得混成单一“重置”动作。
- 当不存在任何活跃 Key 时，页面顶部必须显式提示“对外服务不可用”，而不是只显示空清单。
- 页面必须保留最近使用与最近轮换信息，不能退化成静态凭据列表或一次性生成表单。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `2. 产品定位与界面原则`、`6. 布局与密度原则`、`7.2 卡片与面板`、`7.3 输入框、选择器与表单`、`7.4 表格与列表`、`7.5 状态标签、Badge、Chip`、`7.9 组件系统基线`、`8. 状态与反馈规则`、`9. 数据展示与技术信息呈现`
- **Allowed overrides**: MVP 可简化环境、配额和 Scope 的枚举粒度，但必须保留 Key 生命周期、选中详情和风险信号三类核心信息；治理说明可保留为规则提示，不升级为更重的自动化治理界面。
- **Forbidden deviations**: 不得把 API Key 页面做成单次生成页；不得要求用户依赖横向滚动才能读懂 inventory；不得在 inventory 或默认详情态中暴露完整明文；不得让停用、轮换或 reveal 结果没有明确状态反馈。

## Component Patterns (shadcn/ui)

本页面组件实现必须优先映射到以下 shadcn/ui 组件结构，不得引入自定义替代。

### 页头与关键动作区

- 页面标题与说明：`h1` + 辅助说明文本，使用 `text-foreground` / `text-muted-foreground`。
- 轮换当前 Key：`Button variant="outline"`。
- 生成新 Key：`Button variant="default"`（Primary）。
- 顶部若需要全局风险提示，使用 `Alert`；不得在此区域放置主题切换控件。

### Key 摘要卡区

- 外层容器：多列 `Card` 网格。
- 单张摘要卡：`Card` + `CardHeader` / `CardContent`，标签使用 `text-xs text-muted-foreground`，数值使用 `text-2xl font-semibold`。
- 状态辅助提示使用 `Badge` 或简短说明文本，不得只靠数字表达风险。

### Key inventory 区

- 外层容器：`Card` with `CardHeader`（标题 + 筛选器）和 `CardContent`。
- 筛选器：`Tabs` 或 `Segmented` 等价模式优先映射为 `TabsList` / `TabsTrigger`；若实现为按钮组，也必须沿用 shadcn 按钮变体，不自造基础控件。
- inventory 使用 shadcn/ui `Table`。
  - 列建议为：调用方 | Key | 环境 | 状态。
  - 调用方单元格允许主副两层信息：主行为名称，副行为 Scope / 配额 / 环境摘要。
  - Key 单元格使用 `font-mono`，仅展示受控片段。
  - 状态使用 `Badge`：活跃 → success token；接近额度 → warning token；已停用 / 风险 → `variant="destructive"`；中性标签 → `variant="secondary"`。
- 不得把完整明文塞进表格单元格，也不得依赖超宽列维持可读性。

### 生成与授权区

- 外层容器：`Card` with `CardHeader`、`CardContent`。
- 表单控件：`Label` + `Input` / `Select`。
- 调用方名称：`Input`。
- 环境、配额、Scope：`Select`。
- 创建后的说明与一次性展示提醒：`Alert` 或内联提示块，不自造提示组件。

### Selected key 详情区

- 外层容器：`Card` with `CardHeader`（当前调用方名称 + 状态 `Badge`）和 `CardContent`。
- No-selection state：同样沿用 `Card` 容器，但 `CardHeader` 改为“未选择 Key”，`CardContent` 展示一段空态说明文本；不得渲染旧数据占位。
- 元信息使用 `Badge` 组展示环境、配额、Scope。
- 最近 24h 使用、最近轮换结果等可拆成内嵌子卡片或结构化信息行，仍优先使用 `Card` / `Separator` / `Badge` 体系。
- 停用动作：`Button variant="destructive"`，必要时搭配 `AlertDialog`。
- reveal 按钮：`Button variant="ghost" size="icon"` + eye 图标，仅在受控窗口内可见。
- copy 按钮：`Button variant="outline" size="sm"`，仅在受控窗口内可见。
- 明文展示建议使用只读 `Input` 或 `Textarea` 承载，避免裸文本直接暴露在面板中。

### 治理说明区

- 外层容器：`Card`。
- 规则提示可用 `Alert`、列表或时间线样式承载，但实现必须沿用既有排版与 token，不引入独立视觉语言。

## Data / Dependencies

- **Data sources**: 调用方 Key 清单、当前选中 Key 详情、Key 状态、最近 24h 使用摘要、轮换记录、Scope / 配额配置、受控 reveal window 状态
- **Derived UI state**: 当前是否存在选中项、当前选中项是否已被筛选隐藏、No-selection state 提示文案
- **External dependencies**: 外部应用接入关系、系统剪贴板能力（仅在受控 copy 行为触发时使用）
- **Cross-page dependencies**: `docs/pages/dashboard.md`

## Responsive Behavior (Page-Specific)

> 共享响应式骨架规则参见 `docs/layouts/admin-layout.md §6`；以下为本页特有例外与优先级约定。

### Tablet

- 左侧 inventory 与右侧 Selected Key 详情可调整为垂直堆叠，Inventory 在上，详情在下。
- 高风险动作（停用、轮换）按钮必须在详情区首屏可见，不得下沉到需要滚动才可触达的位置。
- 受控 reveal / copy 动作在 Tablet 下保持与桌面相同的视觉层级，不得折叠为"更多"菜单。

### Mobile

- 统一转单列：Key 摘要卡 → Key inventory（卡片化或窄表格）→ Selected Key 详情（独立区块）。
- 生成新 Key 等主操作可提升为固定底部按钮或首屏 FAB，确保在 inventory 较长时仍可触达。
- 停用与轮换为高风险动作，在 Mobile 下必须保留 `AlertDialog` 二次确认，不得因屏幕窄而简化确认流程。
- 受控 reveal 窗口在 Mobile 下应确保明文可读，不因容器宽度导致截断；建议使用 `Textarea` 只读样式承载。

## Notes

- 本页只管理下游调用方 Key，不管理上游 Provider 凭据；上游凭据归属 `docs/pages/provider-detail.md`。
- 本页遵循 MVP 边界：吸收原型中的结构与关键交互，但不把双写窗口、自动降速、人工复核升级成当前必做功能。
- 即使 inventory 为高密度视图，Selected key 详情仍应承担“把对象讲清楚”的职责：列表负责扫描，详情负责确认。
