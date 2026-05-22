# Page Spec

## Metadata

- **Page**: Providers
- **Route / Entry Point**: `providers.html` / `/providers`
- **Status**: Active
- **Last Updated**: 2026-05-22
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

让管理员横向比较 Provider 的价值与风险，快速识别健康度、成功率抖动和 Token 池压力，并决定进入哪个详情页处理。

## Audience / Scenario

- **Primary user**: 管理员 / 运维维护者
- **Primary scenario**: 监控 Provider 可用性，判断要处理哪个上游来源
- **Frequency / importance**: 高频运营页；是 Provider 治理主入口

## Modules / Sections

1. **页头与筛选区**: 展示页面目的、主题切换、Provider 状态筛选与模拟/演练动作入口。
2. **Token 池摘要卡**: 展示活跃 Token 总数、冷却中的 Token、接近额度上限的 Token 和最近切换次数。
3. **Provider 列表区**: 按行展示每个 Provider 的健康状态、池规模、成功率 / 抖动状态和简要风险说明。
4. **快速操作区**: 为每个 Provider 提供查看凭据池和进入配置详情的动作。

## Key States

- **Default state**: 展示全部已配置 Provider，并高亮当前选中的或最需要关注的来源。
- **Loading state**: 先显示 Provider 行骨架和摘要卡占位，再填充状态信息。
- **Empty state**: 尚未配置任何 Provider 时，展示“先添加首个 Provider”的空状态与入口。
- **Error state**: Provider 列表或状态摘要加载失败时，说明哪些信息不可用，并保留新增或重试入口。
- **Permission / access state**: 无权限用户不可编辑 Provider；只读用户可浏览状态但不能执行高风险操作。

## Content Hierarchy

- **Primary information**: 哪些 Provider 可服务、哪些处于降级状态、哪个最值得优先处理。
- **Secondary information**: 成功率 / 抖动状态、活跃 / 冷却 / 预警 Token 数量、最近 429 或异常说明。
- **Tertiary information**: 优先级标签、来源类型标签、补充描述。
- **Primary actions**: 查看池子、进入配置详情、添加 Provider。
- **Secondary actions**: 状态筛选、模拟切换、切换主题。

## Interaction Rules

- 列表筛选必须即时生效，不应跳转页面或打断当前选择。
- Provider 行的选中与“进入配置详情”是两层动作：选中用于比较，详情用于编辑。
- 降级和高风险 Provider 必须在列表中可被一眼识别，不能埋在二级信息中。
- 对未启用或无可用凭据的 Provider，应保留可见性，但不得伪装成正常可服务状态。
- 本页必须明确暴露 Token 池规模与压力，不能退化为只有名称和开关的列表。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `8.4 Provider 运营 / Provider 管理`、`9.1 提供方故障与令牌故障切换`、`11. 内容规则`
- **Allowed overrides**: MVP 可只展示少量核心 Provider 字段，但必须保留健康度、池规模、风险和跳转入口。
- **Forbidden deviations**: 不得退化为简单设置列表；不得把凭据池压力隐藏到二级页面后才能感知。

## Data / Dependencies

- **Data sources**: Provider 列表、健康度、成功率 / 抖动状态、Token 池摘要、配额预警、最近切换情况
- **External dependencies**: 上游字幕来源健康状态
- **Cross-page dependencies**: `docs/pages/provider-detail.md`、`docs/pages/dashboard.md`

## Notes

- 首版至少应覆盖 OpenSubtitles 的配置与状态展示。
- 若后续接入更多 Provider，本页继续承担“比较与分诊”的职责，不直接承载复杂配置。
