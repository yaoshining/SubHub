# Page Spec

## Metadata

- **Page**: Admin Login
- **Route / Entry Point**: `login.html` / `/login`
- **Status**: Active
- **Last Updated**: 2026-05-23
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

为未认证用户提供唯一的后台登录入口，在最短路径内完成身份验证，并在系统尚未初始化时于同一路由完成首个管理员创建。

## Audience / Scenario

- **Primary user**: SubHub 维护者 / 管理员
- **Primary scenario**: 首次开通系统，或日常登录进入控制台处理 Provider、调用方 Key 与后台风险操作
- **Frequency / importance**: 高频入口；是所有后台操作的安全前提

## Modules / Sections

1. **品牌与身份说明区**: 在卡片顶部展示 `SubHub Admin` 品牌与一句高权限后台说明，明确这不是营销页或公开站点。
2. **主认证卡片区**: 采用居中单卡布局，承载日常密码登录或首轮开通表单，两种模式互斥切换。
3. **状态反馈区**: 在卡片底部展示登录失败、初始化失败、会话失效等明确反馈，并保持结构稳定。
4. **扩展认证占位区**: 在卡片内部以禁用说明块展示 SSO / 2FA 当前未启用状态，为后续扩展预留信息位但不增加主流程复杂度。
5. **登录后去向提示区**: 说明成功后将进入 Dashboard 或返回用户原本尝试访问的受保护页面。

## Key States

- **Default state**: 展示品牌说明、账号输入、密码输入和主登录按钮；页面焦点集中在完成登录动作。
- **Submitting state**: 提交登录或初始化表单时禁用重复提交，按钮进入处理中状态。
- **Bootstrap state**: 系统尚未初始化时，主认证卡片切换为“创建首个管理员”表单，而不是进入独立 setup 页面。
- **Error state**: 凭据错误、会话失效、初始化失败时，在卡片底部给出明确原因与重试提示，不清空非敏感字段。
- **Redirect state**: 已登录用户访问 `/login` 时，直接跳转到原目标页；若无原目标页，则跳转到 Dashboard。
- **Permission / access state**: 未登录用户不可见后台导航与运营数据；登录页是未认证访问控制台的唯一入口。

## Content Hierarchy

- **Primary information**: 当前是“登录控制台”还是“创建首个管理员”，以及对应的主表单动作。
- **Secondary information**: 错误反馈、未启用的 SSO / 2FA 状态、登录后的去向说明。
- **Tertiary information**: 安全提示、访问限制说明、补充性的认证扩展文案。
- **Primary actions**: 登录、创建首个管理员。
- **Secondary actions**: 显示 SSO / 2FA 未启用状态、提示将返回原目标页。

## Interaction Rules

- `/login` MUST 作为未认证用户进入控制台的唯一入口，不引入环境 / 工作区选择流程。
- 首轮开通与日常登录 MUST 共用同一路由与同一主卡片结构，但两种模式不能同时展示。
- 日常登录表单默认包含“邮箱或用户名”“密码”两个主输入与一个主按钮，避免把入口页做成多任务面板。
- 首轮开通表单包含管理员标识、密码、确认密码；创建成功后立即切回受保护登录入口状态。
- 登录失败或初始化失败时 MUST 保留已输入的非敏感字段，减少重复输入负担。
- 登录成功后 MUST 优先返回用户原本尝试访问的受保护页面；若无明确目标，则进入 Dashboard。
- SSO / 2FA 在首版中不是可用主流程，但 MUST 以明确的未启用状态显示，不能直接隐藏。
- 已登录用户再次访问 `/login` 时，不应看到登录卡片，而应直接重定向。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `2. 产品定位与界面原则`、`3.1 主题策略`、`4. 字体与信息层级`、`8. 状态与反馈规则`、`10. 可访问性与交互底线`
- **Allowed overrides**: 未登录状态允许使用简化外壳，不显示后台侧边栏、页面 Header 和控制台内页摘要区。
- **Forbidden deviations**: 不得做成营销首页；不得加入大面积品牌化 Hero；不得在未认证状态暴露 Provider、API Key、用户或系统运营数据；不得引入与当前 MVP 不符的环境 / 工作区切换。

## Data / Dependencies

- **Data sources**: 管理员初始化状态、当前会话状态、原目标页重定向信息、SSO / 2FA 可用性状态、登录或初始化错误反馈
- **External dependencies**: 无
- **Cross-page dependencies**: `docs/pages/dashboard.md`、`docs/pages/users.md`

## Notes

- 本页是后台 IA 的正式入口页，但不是后台内页，不参与侧边栏导航。
- 页面应延续控制台主题 token 与状态反馈语言，但在未认证状态下保持更克制的版式密度。
- 后续若真的启用 SSO / 2FA，应优先复用当前预留的信息区和状态位，而不是重做页面骨架。
