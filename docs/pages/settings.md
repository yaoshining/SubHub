# Page Spec

## Metadata

- **Page**: Settings
- **Route / Entry Point**: `settings.html` / `/settings`
- **Status**: Active
- **Last Updated**: 2026-05-24
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

为管理员提供一个低频但高确定性的系统设置总览页，用于确认当前实例是否具备基础服务条件、识别哪些能力在本版本可配置，以及把维护者明确分流到真正承接深配置的页面。

## Audience / Scenario

- **Primary user**: 管理员 / 运维维护者
- **Primary scenario**: 登录后台后确认实例部署状态、服务就绪度、配置职责边界，以及下一步应前往哪个治理页
- **Frequency / importance**: 低频边界页；不是主要运营入口，但承担系统状态解释与配置分流职责

## Modules / Sections

1. **页头与只读动作区**: 展示页面定位，并提供“查看部署信息”“查看版本说明”等只读动作。
2. **系统基础状态卡区**: 展示环境、系统版本、首个管理员状态与服务就绪度。
3. **范围说明区**: 明确声明当前版本不在此页管理复杂系统策略，避免管理员误把本页当成总配置中心。
4. **配置分流区**: 告诉管理员 Provider 运行策略、API Key、成员治理与复杂权限模型分别应去哪里完成。
5. **基础服务核查区**: 只读展示 Provider、调用方 Key、管理员认证和统一出口是否满足服务条件。
6. **部署读数区**: 展示当前实例部署说明与环境标签，强调该页不承载保存动作。
7. **后续能力预留区**: 展示缓存治理、镜像策略、媒体同步、高级权限等明确不属于当前 MVP 的后续能力。

## Key States

- **Default state**: 展示系统基础状态卡、范围说明、配置分流、基础服务核查、部署读数和后续能力预留。
- **Loading state**: 保留控制台外壳和页面分区骨架，优先加载系统状态卡与部署读数，再补充核查项和后续能力说明。
- **Empty state**: 当系统尚未完成首轮开通或缺少部署读数时，页面必须明确展示“未完成初始化 / 未具备服务条件”，并把管理员引导到 Login、Users、Providers 或 API Keys 对应页面，而不是显示空白设置容器。
- **Error state**: 当部署信息、版本说明或核查摘要加载失败时，页面应保留已知可用信息，并明确指出失败对象与重试方式。
- **Permission / access state**: 仅管理员可访问；无权限用户不得看到部署读数、认证状态或后续能力说明。

## Content Hierarchy

- **Primary information**: 当前实例是否在生产环境、是否已初始化管理员、是否已具备对外服务条件、核心配置应去哪里完成。
- **Secondary information**: 统一出口状态、启用中的 Provider 数量、可用调用方 Key 状态、认证方式与部署标签。
- **Tertiary information**: 版本说明、后续能力预留、范围解释性文本。
- **Primary actions**: 查看部署信息、查看版本说明、进入 Provider Detail、进入 API Keys、进入 Users。
- **Secondary actions**: 查看未来权限策略去向、理解后续能力边界。

## Interaction Rules

- 本页是**确认与分流页**，不是深度编辑页；不得在此直接承载 Provider 调度、API Key 生命周期、成员治理或复杂权限配置表单。
- 页头动作只允许读取部署信息与版本说明，不得伪装成全局保存或高风险写入动作。
- 配置分流区中的每个入口都必须指向明确页面，不得出现“更多设置”这类模糊跳转。
- 更复杂权限模型与后续能力预留必须以次级、弱化或不可编辑状态表达，不能让管理员误以为当前版本已可用。
- 基础服务核查区只展示结论性状态与摘要说明，不重复各治理页的完整明细表格或编辑控件。
- 当系统尚未具备对外服务条件时，服务就绪卡和核查区必须优先暴露未就绪原因，而不是继续显示正常态文案。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `2. 产品定位与界面原则`、`6.2 页面布局模式`、`7.2 卡片与面板`、`7.6 Inline Callout 与 Notice`、`7.8 导航`、`8. 状态与反馈规则`、`9. 数据展示与技术信息呈现`
- **Allowed overrides**: 作为低频边界页，本页可以弱化主操作密度，并允许使用 muted panel 表达“后续版本”能力；但仍必须保持明确的信息层级与清晰跳转去向。
- **Forbidden deviations**: 不得把本页扩展为通用系统配置中心；不得把后续能力渲染成当前可编辑功能；不得在本页重复 Provider、API Key 或用户页已经承接的主流程。

## Data / Dependencies

- **Data sources**: 部署环境、系统版本、管理员初始化状态、认证方式、启用中的 Provider 摘要、可用调用方 Key 摘要、统一出口状态、版本说明
- **External dependencies**: 部署环境元数据、统一网关服务状态
- **Cross-page dependencies**: `docs/pages/dashboard.md`、`docs/pages/providers.md`、`docs/pages/provider-detail.md`、`docs/pages/api-keys.md`、`docs/pages/users.md`

## Notes

- 本页应维持“信息确认 + 配置分流”的克制定位，不因后续功能增长而变成系统设置大杂烩。
- 若后续真的引入可编辑的系统级策略，应先评估是否形成跨页面复用的系统规则；若是，需要先更新 `DESIGN.md`，再决定是否扩展本页。
- 复杂权限模型在当前 MVP 中仍属于后续能力；若后续引入 `access-control` 页面，应在本页保留分流关系，但不提前假装其已成为当前主路径。