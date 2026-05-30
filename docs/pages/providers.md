# Page Spec

## Metadata

- **Page**: Providers
- **Route / Entry Point**: `providers.html` / `/providers`
- **Status**: Active
- **Last Updated**: 2026-05-23
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

让管理员在同一页内完成 Provider 的**比较、分诊、首轮建档与深配承接**：先判断哪个来源有风险，再快速创建新的 OpenSubtitles 实例，并明确下一步是否需要进入详情页补充调度策略。

## Audience / Scenario

- **Primary user**: 管理员 / 运维维护者
- **Primary scenario**: 监控上游来源健康度，创建新的 OpenSubtitles 实例，判断当前应停留在列表分诊还是进入详情深配
- **Frequency / importance**: 高频运营页；是 Provider 治理主入口，也是新增 Provider 的首个入口

## Modules / Sections

1. **页头与操作区**: 展示页面目的、状态筛选、模拟失败切换动作，以及“新增 OpenSubtitles”主入口。
2. **创建成功反馈区**: 在完成新增后展示成功提示、继续配置 CTA 和“留在列表”动作，明确“建档已完成，策略待补充”的当前进度。
3. **Token 池摘要卡**: 展示活跃 Token 总数、冷却中的 Token、接近额度上限的 Token 和最近切换次数。
4. **Provider 列表区**: 按行展示每个 Provider 实例的健康状态、池规模、成功率 / 抖动状态、当前风险和动作入口。
5. **选中 Provider 池检查区**: 随当前选中项展示凭据池摘要、状态芯片、Token 表格与关键说明。
6. **切换原则与深配承接区**: 概括当前 Provider 的调度规则，并提供进入 `provider-detail` 的明确跳转。
7. **新增 Provider 抽屉**: 以模板化方式创建 OpenSubtitles Provider，仅收集名称与至少一个 API Key，不承载高级策略配置。

## Key States

- **Default state**: 展示全部已配置 Provider，并高亮当前选中的或最需要关注的来源；右侧同步显示该来源的池检查结果。
- **Loading state**: 先显示 Provider 行骨架、摘要卡占位和检查区占位，再填充状态信息。
- **Empty state**: 尚未配置任何 Provider 时，展示“先添加首个 OpenSubtitles Provider”的空状态与入口，并说明创建后仍需进入详情页补充策略。
- **Create drawer state**: 点击“新增 OpenSubtitles”后打开右侧抽屉；抽屉仅允许填写 Provider 名称和 API Key 列表。
- **Create success state**: 创建成功后关闭抽屉，返回列表并自动选中新建实例，显示成功反馈与“继续配置”CTA。
  - **Mobile 表达**：不使用右侧面板；成功反馈以内联 Callout Banner 形式出现在列表顶部（对应 Module 2），展示“已成功创建，策略待补充”说明，并提供次操作按钮“留在列表”（左）和主操作按钮“继续配置”（右）。此 Banner 在用户执行任一操作后或离开页面时消失，不持久展示。
  - **语义约束**：“继续配置”为 primary（跳转 provider-detail）；“留在列表”为 secondary（关闭 Banner 留页）。两者层级不可互换。
- **Needs-config state**: 刚创建的 Provider 必须以“待完善配置 / 基础可用”呈现，不得伪装为已完全稳定运行。
  - **Mobile 卡片按钮顺序**：行内操作区排列为“更多”（次操作 / 左）+“继续配置”（主操作 / 右），遵循 DESIGN.md § 7.1 移动端主操作右对齐规则。
- **Error state**: Provider 列表、摘要卡、创建动作或池检查区加载失败时，说明哪些信息不可用，并保留新增或重试入口。
- **Permission / access state**: 无权限用户不可编辑 Provider；只读用户可浏览状态，但不能执行新增、模拟切换或高风险操作。

## Content Hierarchy

- **Primary information**: 哪些 Provider 可服务、哪些处于降级或待完善配置状态、当前选中的 Provider 是否值得立即处理。
- **Secondary information**: 成功率 / 抖动状态、活跃 / 冷却 / 预警 Token 数量、最近 429 或异常说明、创建后的下一步建议。
- **Tertiary information**: 优先级标签、来源类型标签、补充描述、切换原则说明。
- **Primary actions**: 查看池子、进入配置详情、新增 OpenSubtitles、继续配置。
- **Secondary actions**: 状态筛选、模拟切换、留在列表。

## Interaction Rules

- 列表筛选必须即时生效，不应跳转页面或打断当前选择。
- Provider 行的选中与“配置详情”是两层动作：选中用于比较与检查，详情用于编辑。
- 降级、高风险和“待完善配置” Provider 必须在列表中一眼可识别，不能埋在二级信息中。
- 对未启用、无可用凭据或仅完成首轮建档的 Provider，应保留可见性，但不得伪装成正常稳定状态。
- 本页必须明确暴露 Token 池规模与压力，不能退化为只有名称和开关的列表。
- MVP 的新增流程必须是**OpenSubtitles 模板化创建**；不得在本页暴露 Custom Adapter、认证方式切换、Base URL 或其他通用接入模型。
- 创建抽屉的最小必填项只有 Provider 名称和至少一个 API Key；权重、并发、冷却、失败切换和回退目标必须留到 `provider-detail` 中配置。
- 创建成功后不得强制跳转详情页；默认回到列表页、自动选中新实例，并以清晰 CTA 引导继续配置。
- 右侧池检查区和“进入 Provider 配置”链接必须始终跟随当前选中的 Provider 实例，而不是指向泛化的 Provider 类型。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `2. 产品定位与界面原则`、`6. 布局与密度原则`、`7.2 卡片与面板`、`7.3 输入框、选择器与表单`、`7.4 表格与列表`、`7.5 状态标签、Badge、Chip`、`8. 状态与反馈规则`
- **Allowed overrides**: Providers 页可采用高信息密度、全宽数据布局，并允许列表与检查区并排展示，以支持“Scan > Diagnose > Drill Down”的控制台工作流。
- **Forbidden deviations**: 不得退化为简单设置列表；不得把凭据池压力隐藏到二级页面后才能感知；不得把新增流程做成多步骤向导或通用 Provider 平台入口。

## Data / Dependencies

- **Data sources**: Provider 列表、健康度、成功率 / 抖动状态、Token 池摘要、配额预警、最近切换情况、当前选中 Provider 的池明细、创建成功反馈上下文
- **External dependencies**: 上游字幕来源健康状态
- **Cross-page dependencies**: `docs/pages/provider-detail.md`、`docs/pages/dashboard.md`

## Notes

- 首版至少应覆盖 OpenSubtitles 的配置与状态展示，并允许以实例方式创建多个 OpenSubtitles 池。
- 若后续接入更多 Provider，本页继续承担“比较与分诊”的职责；新增模板范围由 feature spec 单独扩展，不在本页默认开放。
