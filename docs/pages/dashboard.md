# Page Spec

## Metadata

- **Page**: Dashboard
- **Route / Entry Point**: `dashboard.html` / `/dashboard`
- **Status**: Active
- **Last Updated**: 2026-05-22
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

让管理员在进入控制台后的数秒内判断系统整体是否健康、哪里最值得优先处理，以及下一步应进入哪个下钻页面。

## Audience / Scenario

- **Primary user**: 管理员 / 运维维护者
- **Primary scenario**: 登录后快速判断服务是否就绪、哪里异常、下一步去哪处理
- **Frequency / importance**: 高频首页；是控制台任务分发入口

## Modules / Sections

1. **顶部摘要区**: 展示当前总览标题、主题切换和高优先级入口动作。
2. **北极星状态区**: 用一句话总结系统整体状态，突出“现在系统整体怎么样”。
3. **系统健康概览区**: 汇总服务是否具备对外能力、近期异常数量与是否需要人工介入。
4. **队列与压力摘要区**: 展示任务压力、处理中断点或需要重试的信号。
5. **Provider 健康快照区**: 展示主要 Provider 健康摘要并提供下钻入口。
6. **缓存命中 / 覆盖面信号区**: 展示缓存是否发挥价值、覆盖是否存在缺口。
7. **明确下一步动作区**: 把管理员导向 Providers、Provider Detail、API Keys 或任务页面。

## Key States

- **Default state**: 展示系统健康概览、队列压力、Provider 快照、缓存信号和需要处理的事项。
- **Loading state**: 初次进入页面时先展示摘要模块骨架，再加载下钻信息。
- **Empty state**: 若尚未配置 Provider 或调用方 Key，明确展示“未完成首轮开通”的状态与下一步操作。
- **Error state**: 某些摘要无法加载时，保留已知可用信息，并提供刷新或跳转到对应页面排查。
- **Permission / access state**: 未登录用户不可访问；权限不足的用户只能看到与自身职责相关的安全摘要。

## Content Hierarchy

- **Primary information**: 系统整体健康、当前最值得处理的问题、下一步动作入口。
- **Secondary information**: 队列压力、Provider 健康信号、缓存命中 / 覆盖面、人工介入压力。
- **Tertiary information**: 具体数值、趋势说明、细项诊断信息。
- **Primary actions**: 进入 Providers、进入 API Keys、查看最近失败或任务详情。
- **Secondary actions**: 切换时间范围、切换维度、查看更详细链路。

## Interaction Rules

- Dashboard 不承担深度编辑职责，主要负责发现问题与引导到正确页面。
- 当系统尚未具备对外服务能力时，页面顶部必须优先展示“未就绪”而不是正常数据卡片。
- 快照中的异常项必须可点击，直接跳转到对应 Provider、Provider Detail 或 API Keys。
- 页面中的统计筛选只改变摘要视角，不改变控制台的全局导航结构。
- 页面必须同时覆盖系统健康、队列压力和缓存 / 覆盖信号，不能只保留 Provider 摘要。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `8.2 运营核心 / 运营总览`、`9.1 提供方故障与令牌故障切换`、`11. 内容规则`
- **Allowed overrides**: 可根据 MVP 简化趋势维度与图表丰富度，但不能拿掉“下一步去哪处理”的引导性信息。
- **Forbidden deviations**: 不得把 Dashboard 做成纯数字看板；不得隐藏未就绪或失败状态。

## Data / Dependencies

- **Data sources**: 登录态、系统整体健康摘要、任务队列压力、Provider 健康摘要、缓存命中 / 覆盖面信号、调用方 Key 可用性、最近异常摘要
- **External dependencies**: 无
- **Cross-page dependencies**: `docs/pages/providers.md`、`docs/pages/provider-detail.md`、`docs/pages/api-keys.md`

## Notes

- MVP 下 Dashboard 仍应围绕“系统是否已打通”展开，但不能省掉队列压力与缓存信号这两类核心运营信息。
- 若后续补充更多分析页，本页仍保持“发现问题并跳转”的总览首页定位。
