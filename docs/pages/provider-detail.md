# Page Spec

## Metadata

- **Page**: Provider Detail
- **Route / Entry Point**: `provider-detail.html` / `/providers/:providerId`
- **Status**: Active
- **Last Updated**: 2026-05-23
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

为管理员提供单个 Provider 实例的完整运营配置面，承接列表页的创建成功流，集中管理运行策略、Token / API Key 池与最近异常，以支持稳定的自动切换与快速隔离异常凭据。

## Audience / Scenario

- **Primary user**: 管理员 / 运维维护者
- **Primary scenario**: 从 Providers 列表进入某个实例，补齐或调整运行策略，隔离异常凭据，保持对外查询与下载可用
- **Frequency / importance**: 高频深度操作页；是 Provider 运维闭环核心，也是创建后继续完善配置的承接页

## Modules / Sections

1. **页头与返回区**: 说明当前 Provider 实例语境，并提供返回列表和保存配置动作。
2. **关键指标卡**: 展示优先级、活跃 Token 数、冷却窗口和回退目标等影响调度的摘要。
3. **运行策略区**: 管理权重、并发限制、轮换与冷却策略、失败切换策略与回退目标。
4. **Token 池区**: 展示每个 Token / Provider API Key 的状态、剩余额度、最近异常，并提供新增与隔离动作。
5. **最近行为区**: 展示该 Provider 近一段时间内的真实表现与异常轨迹。
6. **配置说明区**: 解释当前配置为何存在，降低后续维护者理解成本，并帮助理解新建实例与稳定实例的差异。

## Key States

- **Default state**: 展示当前 Provider 配置、Token 池与最近行为摘要。
- **Post-create state**: 若由列表页新建实例跳转而来，页面必须明确哪些配置已经完成（名称、API Key 录入），哪些策略仍待补齐（权重、并发、轮换/冷却、失败切换、回退目标）。
- **Loading state**: 先展示页头与指标骨架，再加载策略表单和 Token 池明细。
- **Dirty / unsaved state**: 管理员修改任一策略项或凭据操作后，页面必须显式标记“存在未保存变更”，并指出受影响的模块或字段。
- **Save pending state**: 点击保存后，页面必须明确进入保存中状态，禁用重复提交，并保持当前上下文可见。
- **Empty state**: 若该 Provider 已创建但尚无任何 Token / API Key，明确提示先添加至少一个可用凭据。
- **Error state**: 保存失败、Token 池加载失败或状态更新失败时，保留现有配置并提供重试与撤销提示。
- **Permission / access state**: 无编辑权限时，页面进入只读状态，不展示保存、隔离或新增动作。
- **Success state**: 保存成功后，明确反馈哪些策略已生效，并允许返回列表继续比较。

## Content Hierarchy

- **Primary information**: 当前 Provider 是否可服务、哪些策略正在生效、是否还有活跃 Token、当前实例是否仍处于待完善配置阶段。
- **Secondary information**: 每个 Token / Provider API Key 的状态、异常说明、调度参数、最近行为趋势。
- **Tertiary information**: 历史注释、解释性说明、低频诊断信息。
- **Primary actions**: 保存配置、隔离异常凭据、创建新凭据。
- **Secondary actions**: 返回列表、查看最近行为、调整单项策略。

## Interaction Rules

- 页面上的所有编辑都必须围绕“当前 Provider 实例”上下文，不能与全局调用方 Key 管理混用。
- 保存配置前允许管理员连续调整多个策略项，但必须在页面上明确哪些内容尚未保存。
- 若页面存在未保存变更，返回列表、切换实例或刷新页面前必须给出明确提醒，避免管理员误丢配置。
- 隔离异常凭据必须是显式动作，并在执行后立即从活跃池中移出。
- 若某 Provider 当前没有任何活跃凭据，页面顶部必须优先提示“对外服务风险”，而不是仅显示表单。
- 页面必须回答“API Key 在哪填、优先级在哪调、冷却策略在哪设”，不能拆散到多个页面后才完成一个配置闭环。
- 若用户从列表页的“继续配置”CTA 进入本页，页面应能一眼回答“创建已完成什么、下一步必须补什么”，其中待补策略项至少包括权重、并发、轮换/冷却、失败切换和回退目标，避免管理员误以为新实例已经 fully ready。
- 本页允许对单个实例做深度调整，但不得反向承载通用 Provider 接入模型；实例创建仍应回到列表页入口完成。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `2. 产品定位与界面原则`、`6. 布局与密度原则`、`7.3 输入框、选择器与表单`、`7.4 表格与列表`、`7.5 状态标签、Badge、Chip`、`7.9 组件系统基线`、`8. 状态与反馈规则`
- **Allowed overrides**: MVP 可收敛高级策略项，但必须保留权重、并发限制、冷却、回退和 Token 池五类核心信息；允许通过提示区强调“创建后待补配置”的实例状态。
- **Forbidden deviations**: 不得把 Provider 凭据与下游调用方 Key 混在一张表里；不得把异常隔离设计成隐式自动消失；不得让用户回到列表页后才知道哪些关键策略尚未设置。

## Component Patterns (shadcn/ui)

本页面组件实现必须优先映射到以下 shadcn/ui 组件结构，不得引入自定义替代。

### 页头与返回区

- 返回列表：`Button variant="ghost" size="sm"` + `ChevronLeft` 图标，置于页面左上角。
- 页面标题（Provider 实例名称）：`h1` 级别文字，`text-foreground`。
- Provider 类型标签（如 "OpenSubtitles"）：`Badge variant="secondary"`。
- 未保存变更指示：`Badge variant="outline"` + warning token（`border-warning text-warning bg-warning/10`），出现于页头右侧或标题下方，文案如"含未保存变更"。
- 保存配置：`Button variant="default"`（Primary）；保存中状态：`Button disabled` + 内联 spinner；成功/失败反馈：`toast`（Sonner）。

### 关键指标卡区

- 外层容器：`Card`，`bg-surface-elevated`，内含 `CardHeader`（标题 + 可选刷新按钮）和 `CardContent`。
- 各指标子卡片：内嵌小型 `Card`，`bg-muted/30` + `border`，展示指标标签（`text-xs text-muted-foreground`）与数值（`text-2xl font-semibold text-foreground`）。
- 活跃 Token 数、冷却中 Token 数等状态摘要：每项附 `Badge`，语义同 §7.5：成功 → `border-success text-success bg-success/10`，警告 → warning token，危险 → `variant="destructive"`。

### 运行策略区

- 外层容器：`Card` with `CardHeader`（标题 + Separator）、`CardContent`。
- 策略项按"权重与并发"、"轮换与冷却"、"失败切换与回退"分组，每组以子标题（`text-sm font-medium text-foreground`）隔开，组间使用 `Separator`。
- 文本输入项：`Label` + `Input`，`size="sm"`，错误反馈紧贴字段下方（`text-xs text-destructive`）。
- 数值选择项（优先级、并发上限）：`Label` + `Input type="number"` 或 `Select`。
- 开关项（是否启用轮换、冷却）：`Label` + `Switch`，标签与开关行内排列，间距 `gap-3`。
- 下拉选择（回退目标 Provider）：`Select`，选项按可用性排序，不可用目标加 `disabled` 属性并附 `text-muted-foreground`。
- 若策略项尚未配置（新创建实例），对应字段通过 `Callout`（`Alert variant="warning"`）在组顶部提示"此项策略尚未设置，将影响自动切换稳定性"。

### Token 池区

- 外层容器：`Card` with `CardHeader`（标题 + "新增凭据" `Button variant="outline" size="sm"`）、`CardContent`。
- 凭据列表：shadcn/ui `Table`。
  - `TableHeader`：`bg-muted/50`，列标签 `text-xs font-medium text-muted-foreground`。
  - 列定义：Token 片段（等宽字体 `font-mono`）| 状态 `Badge` | 剩余额度 | 最近异常摘要 | 操作列。
  - 状态 `Badge` 语义：活跃 → success token；冷却中 → warning token；已隔离/停用 → `variant="destructive"`；未知 → `variant="secondary"`。
  - 隔离操作：`Button variant="destructive" size="sm"` + 确认对话框（`AlertDialog`）；确认文案明确"该凭据将立即从活跃池中移出"。
  - 恢复操作（若支持）：`Button variant="outline" size="sm"`。
- 空状态（无任何凭据）：`TableRow` 占满宽度，展示 `Alert variant="destructive"` 提示"当前无活跃凭据，对外服务已中断，请立即添加"。

### 最近行为区

- 外层容器：`Card` with `CardHeader`（标题 + 时间范围 `Select size="sm"` h-8）、`CardContent`。
- 事件列表：shadcn/ui `Table`，列定义：时间（`font-mono text-xs`）| 事件类型 `Badge` | 相关凭据 | 说明。
- 事件类型 `Badge` 语义：切换 → info token；异常 → warning/destructive token；恢复 → success token。

### 配置说明区

- 外层容器：`Card` with `CardHeader`（标题）、`CardContent`。
- 说明文本：`Textarea`（只读或可编辑），`text-sm text-muted-foreground`；编辑时变为标准 `Textarea`，标注"更新说明不需要单独保存，将随策略变更一同提交"。

### Post-Create 引导

- 若由列表页创建后跳转而来，页面顶部展示 `Alert variant="warning"`，说明"Provider 已创建，以下策略项仍待补充"，并列出：权重、并发限制、冷却策略、失败切换目标、回退 Provider。
- 每个待补充项对应页内锚点链接（`Button variant="link" size="sm"`），点击后页面滚动至对应策略表单组。

---

## Responsive Behavior (Page-Specific)

> 共享响应式骨架规则参见 `docs/layouts/admin-layout.md §6`；以下为本页特有例外与优先级约定。

### Tablet

- 主栏（运行策略区 + Token 池区）与次级上下文栏（关键指标卡 + 最近行为区）可下沉为垂直堆叠；指标卡优先展示在主配置表单之前。
- "未保存变更"指示器在 Tablet 下可从页头右侧调整为标题下方 `Alert` 形式，确保可见。
- 保存动作必须始终在首屏可达范围内，不得需要滚动页面才能触达。

### Mobile

- 统一转单栏，布局顺序：关键指标卡 → 运行策略区（按分组折叠） → Token 池区 → 最近行为区 → 配置说明区。
- 高风险动作（隔离凭据）必须固定在操作行可触达区，不得依赖桌面双栏位置。
- 运行策略区的多组配置项在 Mobile 下建议使用 `Accordion` 展开折叠分组，减少页面长度。
- "未保存变更"在 Mobile 下优先使用全宽 `Alert` 固定于表单顶部，不依赖页头位置。

---

## Data / Dependencies

- **Data sources**: 单个 Provider 配置、Token 池状态、最近异常记录、最近行为摘要、从列表页传入的实例上下文、未保存变更状态
- **External dependencies**: 上游字幕来源的额度与错误反馈
- **Cross-page dependencies**: `docs/pages/providers.md`、`docs/pages/dashboard.md`

## Notes

- 本页中的 API Key / Token 指上游 Provider 凭据，不等同于 `api-keys.html` 中的下游调用方 Key。
- 首版重点是让维护者看清“为什么会切换、切到哪、哪些凭据不能再用”，以及“刚创建的实例还缺哪些运行策略”。
