# Page Spec

## Metadata

- **Page**: Subtitle API Validator
- **Route / Entry Point**: `/admin/subtitle-api-validator`；从 provider 管理上下文进入的内部工具入口
- **Status**: Draft
- **Last Updated**: 2026-07-14
- **Related Feature Specs**: `specs/006-subtitle-api-validator/spec.md`

## Goal

为管理员 / 运维人员提供一个独立的字幕 provider 链路验证页，用来在同一页面内完成 provider 选择、搜索验证与下载验证，快速判断问题是出在 provider 配置、参数、网络、上游返回还是下载目标本身。该页的目标是缩短排障路径，而不是承接正式字幕搜索或字幕入库流程。

## Audience / Scenario

- **Primary user**: 管理员 / 内部运维
- **Primary scenario**: 在 provider 异常、配置调整后、联调期间或线上问题排查时，快速验证某个 provider 的搜索链路与下载链路是否正常
- **Frequency / importance**: 低频但高价值的诊断工具页；不是日常主导航核心页，但对 provider 排障与运营诊断非常关键

## Information Architecture

- **推荐方向**: 采用“左侧 Provider Rail + 右侧 Validation Workbench”的双栏诊断工作台，而不是单页长滚动表单或强切 Tabs 的分仓式页面。
- **判定依据**: 该结构最符合管理员在短时间内完成“看状态、改参数、发请求、看结果、查诊断”的连续动作路径；provider 状态在左侧保持常驻，右侧专注当前验证任务，减少上下滚动和上下文丢失。
- **与共享布局关系**: 整体骨架属于 `docs/layouts/admin-layout.md` 中“详情 / 检查页面骨架”的受控变体：主栏承载验证流程，次级诊断摘要内嵌在主栏上半区，而不是额外开独立永久侧栏。

## Aesthetic Direction

本页不是 CRUD 表单页，也不是业务搜索页，而是 **diagnostic workbench / 控制台式验证工作台**。

- 视觉气质应延续当前 SubHub admin console 的冷静克制基调，避免营销式 hero、插画、情绪化大色块。
- 页面应比普通配置页更强调**状态、耗时、链路反馈、最近一次动作**，让管理员优先看到“现在在测谁、有没有通、卡在哪”。
- 结构上要避免“单纯表单堆叠”：provider 选择、能力边界、参数输入、结果验证、下载反馈、诊断摘要必须形成连续工作流。
- 结果区与诊断区要有“控制台感”，允许更高信息密度、更多弱分隔和等宽元信息，但不能牺牲扫读性。
- 颜色沿用现有 token 语义：`primary` 只服务于当前主操作与选中对象，`success / warning / destructive / info` 只服务于状态，不引入新 token。

## Layout

推荐采用 **Provider Rail + Validation Workbench** 的主从式桌面骨架，并按现有 `providers` / `provider-detail` 页面节奏保持一致。

### Desktop / Small Laptop

```
+--Header---------------------------------------------------------------+
| Subtitle API Validator   admin-only / internal diagnostic             |
| 说明文本                                      [返回 Providers]        |
+-----------------------------------------------------------------------+
| +--Provider Rail--+ +--Workbench------------------------------------+ |
| | Provider 列表    | | Provider Overview | Diagnostic Snapshot       | |
| | 状态 / 类型 /    | +------------------------------------------------+ |
| | 支持下载验证     | | Search Composer                                 | |
| | 当前选中高亮     | +------------------------------------------------+ |
| |                 | | Search Results Console                          | |
| |                 | | 行内 Download Validation                        | |
| |                 | +------------------------------------------------+ |
| |                 | | Request Status / Error Feedback / Recent Check  | |
| +-----------------+ +------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

### Tablet / Mobile

- Tablet 下 Provider Rail 降级为顶部选择区或抽屉，不保留永久左栏。
- Mobile 下保持单列顺序：
  1. Header
  2. Provider 选择区
  3. Provider Overview
  4. Diagnostic Snapshot
  5. Search Composer
  6. Search Results Console
  7. Download Validation / Recent Validation
  8. Request Status / Error Feedback
- 响应式只改变排列，不改变诊断路径与语义顺序。

## Modules / Sections

1. **页头与定位说明区**: 页面标题、副标题、admin-only / 内部诊断标签、返回 provider 管理上下文的承接动作，以及“该页不影响正式用户流量”的提示。
2. **Provider Rail（左侧 Provider 列表区）**: 稳定显示当前系统可验证的 provider 列表、类型、启用状态、健康摘要、是否支持下载验证；支持快速切换当前验证对象。
3. **Provider Overview / Capability Panel（右侧上半区）**: 展示当前 provider 的用途边界、启用/禁用/受限状态、支持的搜索维度、下载验证支持情况、限制说明与参数提示。
4. **Diagnostic Snapshot（右侧上半区）**: 展示最近一次或当前一次验证的 provider、动作类型、请求时间、耗时、状态、错误类别与最小调试摘要。
5. **Search Composer（搜索参数输入与操作区）**: 拆分为基础通用参数区与 provider 扩展参数区，并包含验证搜索、重置、示例参数等操作入口。
6. **Search Results Console（搜索结果展示区）**: 使用高密度结果列表展示搜索结果、空结果或错误结果；每条结果保留 provider 来源与后续下载验证所需上下文。
7. **Download Validation Area（下载验证操作区）**: 以结果项行内操作为主，在每条结果上提供“浏览器下载”与“验证下载 URL”两类动作，并支持显示最近一次下载验证反馈。
8. **Request Status / Error Feedback（请求状态 / 错误反馈区）**: 承载 provider 列表加载、搜索请求、下载验证相关的 loading、success、empty、timeout、invalid params、provider error 等反馈。

## Key States

- **Default empty state**: 页面加载后左侧 Provider Rail 可见；若尚未选择 provider 或尚未发起验证，右侧工作区必须显示结构化空态，说明此页用途、推荐下一步动作，以及不会影响正式用户流量。
- **Provider selected / waiting for input state**: 已选中某个 provider 后，Provider Overview 与 Search Composer 立即激活；Diagnostic Snapshot 可展示“尚未发起验证”的中性状态，结果区显示等待验证的空态。
- **Loading state**: provider 列表加载时保留骨架；搜索与下载验证发起后，相关区域展示明确“请求中”状态，且不清空当前上下文；搜索中允许上一轮结果降级保留为历史上下文，而不是整块闪空。
- **Search success with results state**: 搜索成功且有结果时，结果区头部必须显示结果数、请求耗时与 provider 上下文；可继续下载验证的结果项要比不可下载项更易扫读。
- **Search success without results state**: 某次搜索成功但无结果时，页面必须明确说明“无匹配结果”；该状态是中性诊断结果，不得与失败态混淆，并保留当前输入参数供重试。
- **Error state**: 请求失败时必须区分 provider 列表加载失败、搜索参数非法、搜索超时、provider 上游错误、结果解析异常、下载 URL 无效、浏览器下载失败等错误，并给出重试入口或建议下一步。
- **Permission / access state**: 仅管理员可访问；无权限用户必须看到明确拒绝状态，不暴露 provider 列表、请求参数或验证结果。
- **Disabled / restricted provider state**: 已禁用或受限 provider 仍可被选择用于验证，但说明区、状态标签与诊断摘要中都必须持续显示其当前状态，避免被误解为已恢复线上可用。
- **No-download state**: 某条搜索结果无可用下载地址或标识时，下载验证按钮必须禁用或转为说明态，并明确显示“无下载地址可验证”。
- **Download validation success state**: 下载验证成功后，结果项与 Recent Validation 摘要区必须同步回显成功状态、动作类型与发生时间，给管理员足够信心判断下载链路正常。
- **Download validation failure state**: 下载验证失败时，不得只显示红色失败标签；必须可区分无下载地址、URL 无效、provider 返回异常、浏览器下载失败或未知错误，并保留最小可诊断上下文。

## Content Hierarchy

- **Primary information**: 当前选择的 provider、其当前状态、当前验证动作是否成功，以及搜索/下载链路是否健康。
- **Secondary information**: 基础参数与扩展参数的边界、每条结果的标题 / 来源 / 下载可验证性、最近一次验证反馈、请求耗时。
- **Tertiary information**: 错误摘要、超时提示、结果解析说明、provider 状态补充文案、最小调试上下文、限制说明。
- **Primary actions**: 选择 provider、提交搜索验证、执行下载验证。
- **Secondary actions**: 重试、切换 provider、清空当前结果、验证下载 URL、使用示例参数。
- **Hierarchy rule**: 页面视觉权重必须优先分配给“当前 provider + 当前验证状态”，其次才是输入与结果，再往后才是辅助诊断与补充说明；不得让装饰性元素抢占状态信息的注意力。

## Interaction Rules

- 本页承接的是 **provider 链路诊断**，不是 provider 配置编辑页；修改启停、权重、凭据池或 fallback 配置仍由 `providers` / `provider-detail` 承接。
- provider 切换后，当前 provider 说明、扩展参数、结果区上下文与 Recent Validation 摘要必须同步切换；不得把旧 provider 的搜索结果误显示为新 provider 的结果。
- 基础通用参数至少包含关键词；provider 扩展参数仅在当前 provider 支持且当前验证场景需要时展示，不得强行做成所有 provider 统一字段大表单。
- Search Composer 中的扩展参数区应采用“渐进显现”的切换方式：保留稳定的通用参数区，让变化集中在扩展参数区与说明区，避免整页大跳变。
- 搜索验证请求失败时，当前已输入参数必须保留，方便管理员快速调整并重试。
- 搜索成功但空结果、搜索失败、下载失败必须作为不同状态分别表达，不能合并为单一“失败”。
- 搜索开始后，结果区应优先给出进行中的明确反馈；返回成功后应把注意力自然引导到结果头部与可操作结果项；失败后应把注意力引导到错误摘要与下一步建议。
- 下载验证是链路验证，不得触发正式字幕入库、缓存转正或其他深度业务副作用。
- 若同时支持“浏览器下载”与“验证下载 URL”，必须把这两种动作区分表达：前者偏向实际下载动作，后者偏向链路可达性检查。
- 对 disabled / restricted provider 的验证结果，页面文案必须明确这是排障结果，不代表正式服务已恢复可用。
- 错误反馈可展示 provider 名称、动作类型、错误类别、请求耗时与可读摘要，但不得暴露 secret、token、凭据原文或上游敏感响应全文。
- 结果列表需要在“足够可读”和“足够紧凑”之间保持平衡：优先使用紧凑行式结构承载核心字段，provider 特有或低频字段进入展开区，而不是默认全部摊开。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `2. 产品定位与界面原则`、`6.2 页面布局模式`、`6.3 密度原则`、`7.1 按钮`、`7.2 卡片与面板`、`7.5 状态标签、Badge、Chip`、`7.6 Inline Callout 与 Notice`、`7.8 导航`、`7.9 组件系统基线`、`8. 状态与反馈规则`、`9. 数据展示与技术信息呈现`
- **Allowed overrides**: 作为内部诊断工具页，本页允许采用比普通业务页更高的信息密度；允许把 provider 列表与验证工作区做成并排布局，以缩短排障操作路径；允许在结果项上直接展示调试导向文案，但仍需保持管理台整体语气一致。
- **Forbidden deviations**: 不得把本页做成正式字幕搜索页；不得在页面中暴露 provider secret；不得把 provider 配置编辑、凭据池管理、历史审计中心混入本页；不得用单一统一字段模型强压所有 provider；不得让下载验证默认触发正式业务副作用。

## Relationship to Existing Pages

- 与 `docs/pages/providers.md` 的关系：
  - `providers` 页负责 provider 清单治理、启停、配置承接与创建入口。
  - `subtitle-api-validator` 页负责搜索链路 / 下载链路验证，不在列表页内嵌完整诊断工作区。
- 与 `docs/pages/provider-detail.md` 的关系：
  - `provider-detail` 页负责单实例配置、调度、凭据池与最近行为。
  - `subtitle-api-validator` 页负责在不进入正式业务搜索流的前提下验证 provider 的运行链路，不承担配置编辑主职责。
- 与 `docs/pages/create-provider.md` 的关系：
  - `create-provider` 承担建档。
  - `subtitle-api-validator` 可作为建档后或异常时的排障承接页。

## Main.pen Frame Plan

本页在 `design/main.pen` 中建议按现有 `v0.2.3 / ...` 命名体系落为一组**页面级 frame**，并优先覆盖深色默认主题与浅色等价态。

### Canonical state set

- `v0.2.3 / Subtitle API Validator – Default – Dark`
- `v0.2.3 / Subtitle API Validator – Default – Light`
- `v0.2.3 / Subtitle API Validator – Selected Provider – Dark`
- `v0.2.3 / Subtitle API Validator – Selected Provider – Light`
- `v0.2.3 / Subtitle API Validator – Searching – Dark`
- `v0.2.3 / Subtitle API Validator – Searching – Light`
- `v0.2.3 / Subtitle API Validator – Search Success – Dark`
- `v0.2.3 / Subtitle API Validator – Search Success – Light`
- `v0.2.3 / Subtitle API Validator – Empty Results – Dark`
- `v0.2.3 / Subtitle API Validator – Empty Results – Light`
- `v0.2.3 / Subtitle API Validator – Search Error – Dark`
- `v0.2.3 / Subtitle API Validator – Search Error – Light`
- `v0.2.3 / Subtitle API Validator – Download Success – Dark`
- `v0.2.3 / Subtitle API Validator – Download Success – Light`
- `v0.2.3 / Subtitle API Validator – Download Error – Dark`
- `v0.2.3 / Subtitle API Validator – Download Error – Light`

### Optional follow-up frames

若本轮后续需要补响应式原型，再追加：

- `Subtitle API Validator – Tablet – Dark`
- `Subtitle API Validator – Tablet – Light`
- `Subtitle API Validator – Mobile – Dark`
- `Subtitle API Validator – Mobile – Light`

### Frame coverage rule

- 默认态与已选中 provider、搜索中、搜索成功、空结果、搜索失败、下载成功、下载失败为**必须覆盖**状态。
- 若页面支持权限拒绝、provider list load error，可在后续作为辅助 frame 增补，不替代上述主状态集。
- 各 frame 必须延续当前 admin console 画板尺寸惯例：桌面工作台优先 1440 宽，后续 tablet / mobile 跟随现有 providers/detail 的尺寸体系。

## Component Inventory

### Reuse existing components / patterns

- `Sidebar / Dark / Base`、`Sidebar / Light / Base`
- `Component/ButtonPrimary`
- `Component/ButtonSecondary`
- `Component/StatusBadge`
- `Component/StatusBadge-Disabled`
- `Component/RestrictedCallout`
- 现有 `ProviderRow` 的信息层级模式
- 现有 `SummaryCard` 的卡片密度与标题 / 数值层级模式
- `providers` / `provider-detail` 页面中的 Context Strip、Inspector、列表行、空状态、受限提示等表达方式

### New page-level components

- `Validator Provider Rail`
  - 左侧 provider 列表容器，承载 provider name、type、status、health、download support
- `Validator Provider Rail Row`
  - 诊断导向的 provider 行，强调“当前可测谁、当前状态、是否支持下载验证”
- `Validator Capability Panel`
  - 当前 provider 支持项、限制项、下载能力、注意事项
- `Validator Search Composer`
  - 通用参数区 + provider 扩展参数区 + 操作区
- `Validator Diagnostic Snapshot`
  - 最近一次动作摘要、请求状态、耗时、错误类别
- `Validator Result Row`
  - 单条搜索结果的紧凑行结构，承载标题、语言、来源、下载能力、行内动作
- `Validator Download Feedback Strip`
  - 最近一次下载验证反馈，可挂在结果区顶部或底部
- `Validator Request State Block`
  - 搜索失败 / 超时 / 空结果 / provider error / parse error 的统一状态块
- `Validator Provider Parameter Notice`
  - 用来明确“通用参数 / provider 扩展参数”边界的轻量说明块

### Reuse vs new rule

- 能直接承接当前 admin 设计语言的部分，优先复用现有表达，不重新发明颜色、状态或按钮层级。
- 新增组件应以**页面级组合件**为主，而不是新增另一套基础按钮 / 表单 / badge。

## Main.pen Landing Guidance

- 继续沿用当前 SubHub admin console 的深色默认、浅色对等策略；不要只做单主题。
- 页面气质应更偏 **diagnostic workbench**：
  - 左侧 provider rail 稳定常驻
  - 右侧工作区强调请求动作、返回结果、诊断反馈
  - 允许更高信息密度与更多等宽元信息
- 不引入与现有体系冲突的新 token；优先复用 `DESIGN.md §3.5` 中的现有语义色与 `main.pen` 当前变量。
- 搜索结果不应做成大卡片瀑布，优先做成紧凑行式控制台列表。
- 下载验证反馈不应散落在全页，应和结果行或 Recent Validation 摘要形成明确对应关系。
- 本页建议摆放在现有 `v0.2.3` providers / provider-detail 画板右侧继续延展，便于对照审阅。
- 画板设计顺序建议：
  1. `Selected Provider – Dark`
  2. `Search Success – Dark`
  3. `Search Error – Dark`
  4. `Download Success – Dark`
  5. `Download Error – Dark`
  6. 再镜像补齐对应 Light frame
- 若首轮只做最小可用原型，优先完成：
  - `Default`
  - `Selected Provider`
  - `Search Success`
  - `Empty Results`
  - `Search Error`
  - `Download Error`
  这 6 个状态，再补下载成功与加载态。

## Component Patterns (shadcn/ui)

本页面组件实现必须优先映射到以下 shadcn/ui 组件结构，不得随意自造基础控件。

### 页头与定位说明区

- 页面标题与说明：`h1` + 辅助说明文本。
- admin-only / 内部诊断定位：`Badge` + `Alert` 或 `Inline Callout`。
- 回到 provider 管理上下文的承接入口：`Button variant="outline"` 或轻量链接按钮。
- 建议在标题区直接暴露一条弱强调范围提示，例如“Internal diagnostic workbench / No impact on production user flow”。

### Provider Rail（左侧 Provider 列表区）

- 外层容器：`Card` 或稳定侧栏面板。
- 列表本体：结构化列表或可选中行；当前选中项用列表行选中样式或 `Button` 变体表达。
- 每个 provider 行至少包含名称、类型、状态、健康摘要，以及是否支持下载验证。
- 状态展示：`Badge` / 状态文案组合，不只靠颜色区分 enabled / disabled / restricted / degraded。
- 宽屏下 Provider Rail 应保持稳定宽度，避免因右侧内容变化而抖动；移动端可降级为顶部选择器或抽屉。

### Provider Overview / Capability Panel

- 外层容器：`Card`。
- provider 名称、类型、状态：标题 + `Badge` 组。
- 用途边界、限制说明、参数提示：结构化信息块、`Alert` 或说明列表。
- 应清楚展示“支持的搜索维度 / 是否支持下载验证 / 当前限制说明”，但不得展示敏感凭据。

### Diagnostic Snapshot

- 外层容器：`Card`。
- 适合放置最近一次或当前一次验证的 provider、动作类型、请求时间、耗时、状态、错误类别。
- 这是后台诊断价值的关键区域，视觉权重应高于普通辅助说明，但低于主操作与结果区。

### Search Composer（搜索参数输入与操作区）

- 外层容器：`Card`。
- 参数表单：`Form`、`Input`、`Textarea`、`Select`、`Button`。
- 基础通用参数与扩展参数应分组呈现，可用 `Separator` 或子标题区分。
- 操作区至少包含 `验证搜索`、`重置`；可按实现判断是否加入 `示例参数`。
- Loading 状态必须明确，不得仅靠按钮轻微置灰。

### Search Results Console（搜索结果展示区）

- 外层容器：`Card`。
- 结果列表优先使用高密度结构化列表、轻量表格或紧凑结果行，而不是大卡片瀑布。
- 每条结果需保留标题、语言、来源、下载验证所需上下文，以及基础元信息展示位。
- 对 provider 特有的低频字段，优先放入可展开区域，避免主列表噪音过高。
- 空结果 / 错误结果：`Alert`、空态说明块或内联状态区。

### Download Validation Area（下载验证操作区）

- 结果行内动作：`Button variant="default"` 用于下载验证，`Button variant="outline"` 用于 URL 校验。
- 最近一次验证结果：`Badge`、状态行或内联反馈块；也可在结果区之外补一个 Recent Validation 摘要区。
- 对无下载地址的结果项：禁用态按钮 + 说明文本。

### Request Status / Error Feedback（请求状态 / 错误反馈区）

- 搜索与下载的状态反馈优先使用 `Alert`、`Toast`、内联状态块组合。
- 超时、参数错误、provider 错误、解析错误、URL 无效必须在文案层区分，而不是统一显示“请求失败”。
- 错误反馈除了状态本身，还应尽量给出下一步建议，例如调整参数、切换 provider、回到 provider 配置页检查状态。

## Data / Dependencies

- **Data sources**: provider registry / provider 管理 API、admin validator 搜索验证接口、admin validator 下载验证接口
- **External dependencies**: 上游 subtitle providers（经服务端受控调用）、浏览器下载能力
- **Cross-page dependencies**: `docs/pages/providers.md`、`docs/pages/provider-detail.md`、`docs/pages/access-control.md`

## Navigation / Entry Notes

- 本页不作为普通用户导航入口暴露；仅在管理员上下文中可达。
- 推荐从 `providers` 列表页或 `provider-detail` 页通过“验证链路 / 打开 Validator”类承接动作进入，以保持配置与诊断分层清晰。
- 即使后续加入独立导航项，其命名也必须强调“Validator / 内部验证工具”，不得命名成泛化的“字幕搜索”。

## Responsive Behavior (Page-Specific)

- **Small laptop / desktop**: 优先采用左侧 `280-300px` Provider Rail + 右侧 Validation Workbench 的双栏布局，减少排障时的来回滚动；右侧上半区可采用 `Provider Overview + Diagnostic Snapshot` 双卡并排。
- **Tablet**: Provider Rail 可降级为顶部横向选择区、抽屉或折叠面板；验证工作区在下方纵向堆叠；搜索参数区与结果区保持同页连续，不拆分到二级路由。
- **Mobile**: 统一转单列，顺序为页头说明 → provider 选择区 → 当前 provider 说明 → Diagnostic Snapshot → 参数区 → 结果区；结果项操作按钮允许换行，但必须保持“下载验证”和“URL 校验”两个动作的区分。
- **Responsive principle**: 响应式只允许改变布局排列，不允许改变页面核心任务路径与诊断语义；无论在哪个断点，都必须维持“provider 上下文 → 参数 → 结果 → 诊断反馈”的阅读顺序。

## Notes

- 本页是 `providers` / `provider-detail` 的诊断补位页：前两者负责 provider 配置、状态治理与启停，本页负责在不进入正式用户搜索路径的前提下做链路验证。
- 首批范围内允许验证 disabled / restricted provider，但必须持续显示其状态上下文；这是排障便利性优先，而不是产品主流程放开。
- 本页的信息架构故意不把 provider 配置编辑与验证工作台混在一起；即使从配置上下文承接进入，进入后也应立刻切到“诊断优先”的工作模式。
- 设计上应优先追求“3 秒内看清当前 provider 状态、10 秒内完成一次搜索验证、20 秒内定位明显链路问题”的工作台效率，而不是普通 CRUD 页的保守表单节奏。
- validator 页若后续需要最小日志 / 审计，只记录动作摘要，不应在本页内演化成完整历史中心。
- 页面结构需支持未来多 provider 扩展：通用参数区稳定，扩展参数区 provider-aware，结果列表允许核心字段稳定 + provider 特有字段展开，不要求未来新增 provider 时重构整页。
- 本页属于当前版本内新增能力，**version unchanged / shipped within current release scope**；不改变既有版本规划。
