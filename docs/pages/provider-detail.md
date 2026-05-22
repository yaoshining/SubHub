# Page Spec

## Metadata

- **Page**: Provider Detail
- **Route / Entry Point**: `provider-detail.html` / `/providers/:providerId`
- **Status**: Active
- **Last Updated**: 2026-05-22
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

为管理员提供单个 Provider 的完整运营配置面，集中管理运行策略、Token / API Key 池与最近异常，以支持稳定的自动切换与快速隔离异常凭据。

## Audience / Scenario

- **Primary user**: 管理员 / 运维维护者
- **Primary scenario**: 调整某个 Provider 的运行策略，隔离异常凭据，保持对外查询与下载可用
- **Frequency / importance**: 高频深度操作页；是 Provider 运维闭环核心

## Modules / Sections

1. **页头与返回区**: 说明当前 Provider 语境，并提供返回列表和保存配置动作。
2. **关键指标卡**: 展示优先级、活跃 Token 数、冷却窗口和回退目标等影响调度的摘要。
3. **运行策略区**: 管理权重、并发限制、轮换与冷却策略、失败切换策略与回退目标。
4. **Token 池区**: 展示每个 Token / Provider API Key 的状态、剩余额度、最近异常，并提供新增与隔离动作。
5. **最近行为区**: 展示该 Provider 近一段时间内的真实表现与异常轨迹。
6. **配置说明区**: 解释当前配置为何存在，降低后续维护者理解成本。

## Key States

- **Default state**: 展示当前 Provider 配置、Token 池与最近行为摘要。
- **Loading state**: 先展示页头与指标骨架，再加载策略表单和 Token 池明细。
- **Empty state**: 若该 Provider 已创建但尚无任何 Token / API Key，明确提示先添加至少一个可用凭据。
- **Error state**: 保存失败、Token 池加载失败或状态更新失败时，保留现有配置并提供重试与撤销提示。
- **Permission / access state**: 无编辑权限时，页面进入只读状态，不展示保存、隔离或新增动作。

## Content Hierarchy

- **Primary information**: 当前 Provider 是否可服务、哪些策略正在生效、是否还有活跃 Token。
- **Secondary information**: 每个 Token / Provider API Key 的状态、异常说明、调度参数、最近行为趋势。
- **Tertiary information**: 历史注释、解释性说明、低频诊断信息。
- **Primary actions**: 保存配置、隔离异常凭据、创建新凭据。
- **Secondary actions**: 返回列表、查看最近行为、调整单项策略。

## Interaction Rules

- 页面上的所有编辑都必须围绕“当前 Provider”上下文，不能与全局调用方 Key 管理混用。
- 保存配置前允许管理员连续调整多个策略项，但必须在页面上明确哪些内容尚未保存。
- 隔离异常凭据必须是显式动作，并在执行后立即从活跃池中移出。
- 若某 Provider 当前没有任何活跃凭据，页面顶部必须优先提示“对外服务风险”，而不是仅显示表单。
- 页面必须回答“API Key 在哪填、优先级在哪调、冷却策略在哪设”，不能拆散到多个页面后才完成一个配置闭环。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `8.4 Provider 运营 / Provider 配置详情`、`9.1 提供方故障与令牌故障切换`、`5. 产品原则`
- **Allowed overrides**: MVP 可收敛高级策略项，但必须保留权重、并发限制、冷却、回退和 Token 池五类核心信息。
- **Forbidden deviations**: 不得把 Provider 凭据与下游调用方 Key 混在一张表里；不得把异常隔离设计成隐式自动消失。

## Data / Dependencies

- **Data sources**: 单个 Provider 配置、Token 池状态、最近异常记录、最近行为摘要
- **External dependencies**: 上游字幕来源的额度与错误反馈
- **Cross-page dependencies**: `docs/pages/providers.md`、`docs/pages/dashboard.md`

## Notes

- 本页中的 API Key / Token 指上游 Provider 凭据，不等同于 `api-keys.html` 中的下游调用方 Key。
- 首版重点是让维护者看清“为什么会切换、切到哪、哪些凭据不能再用”。
