# Page Spec

## Metadata

- **Page**: Admin Login
- **Route / Entry Point**: `login.html` / `/login`
- **Status**: Active
- **Last Updated**: 2026-05-22
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

在进入后台前确认操作者身份，并明确环境边界、工作区上下文与高风险操作的二次验证入口。

## Audience / Scenario

- **Primary user**: SubHub 维护者 / 管理员
- **Primary scenario**: 首次开通系统，或日常登录进入控制台处理 Provider、调用方 Key 与后台风险操作
- **Frequency / importance**: 高频入口；是所有后台操作的安全前提

## Modules / Sections

1. **身份确认区**: 明确这是高权限后台入口，而不是营销或普通 SaaS 登录页。
2. **工作区 / 环境选择区**: 在进入后台前确认目标环境或工作区，避免生产与演示环境混淆。
3. **登录与认证区**: 承载密码登录、SSO 入口、2FA 挑战和首轮管理员建立流程。
4. **状态反馈区**: 展示登录失败、会话过期、认证失败、未配置 SSO 或 2FA 验证失败等反馈。
5. **跳转说明区**: 登录成功后说明将进入 Dashboard 或返回用户原本尝试访问的受保护页面。

## Key States

- **Default state**: 展示身份确认信息、环境边界说明和主登录入口。
- **Loading state**: 提交登录、发起 SSO、提交 2FA 或建立首个管理员时禁用重复提交，并显示处理中状态。
- **Empty state**: 系统尚未完成首轮开通时，展示“创建首个管理员”流程，而不是空白页。
- **Error state**: 凭据错误、会话失效、SSO 不可用、2FA 失败或初始化失败时给出明确原因与重试动作。
- **Permission / access state**: 已登录用户再次访问时直接跳转到 Dashboard 或原目标页面；未登录用户不可看到后台导航与敏感模块。

## Content Hierarchy

- **Primary information**: 当前身份确认动作、环境边界、是否需要二次验证或首轮开通。
- **Secondary information**: 登录失败原因、SSO / 2FA 状态、登录后去向。
- **Tertiary information**: 安全提示、访问限制说明、审计只读模式提示。
- **Primary actions**: 登录、继续 2FA、创建首个管理员。
- **Secondary actions**: 选择工作区、切换环境、发起 SSO、返回原访问目标。

## Interaction Rules

- 首轮开通与日常登录必须共用同一入口，但两种状态不能同时展示，避免流程混淆。
- 工作区或环境选择必须先于进入后台发生，不能在登录成功后才暴露生产 / 演示边界。
- 成功登录后应优先返回用户原本尝试访问的受保护页面；若无明确目标，则进入 Dashboard。
- 登录失败必须保留已输入的非敏感字段，减少重复输入负担。
- 首个管理员建立成功后，页面立即切换为已受保护的后台入口状态，不再重复展示初始化表单。
- 未启用的 SSO、2FA 或审计只读模式必须展示明确的未配置状态，不能用消失式入口替代。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `6.1 主题`、`6.3 页面外壳`、`8.1 认证入口`
- **Allowed overrides**: 未登录状态允许使用更简化的页面外壳，不显示完整后台导航。
- **Forbidden deviations**: 不得做成营销首页；不得在未认证状态暴露 Provider、Key 或用户运营数据。

## Data / Dependencies

- **Data sources**: 管理员身份状态、首轮开通状态、当前会话状态、工作区 / 环境列表、SSO / 2FA 可用性、登录错误反馈
- **External dependencies**: 无
- **Cross-page dependencies**: `docs/pages/dashboard.md`、`docs/pages/users.md`

## Notes

- 本页是 17 个 screen 中的正式入口页，不属于后台内页导航，但属于后台 IA 的一部分。
- 若实现阶段暂未开启 SSO 或 2FA，仍需为这些入口预留明确状态，避免未来再改页面结构。
