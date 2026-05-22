# Page Spec

## Metadata

- **Page**: Users
- **Route / Entry Point**: `users.html` / `/users`
- **Status**: Active
- **Last Updated**: 2026-05-22
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

为控制台维护者提供成员、邀请、会话与风险账号的统一治理页，用于确认谁能登录、谁仍有访问权，以及是否存在需要立即处理的风险会话。

## Audience / Scenario

- **Primary user**: 管理员 / owner
- **Primary scenario**: 查看当前后台成员、邀请新成员、暂停异常用户或会话
- **Frequency / importance**: 中频治理页；是登录能力扩展后的配套入口

## Modules / Sections

1. **页头与高频动作区**: 提供发送邀请、暂停当前用户等动作。
2. **成员摘要卡**: 展示活跃成员、待接受邀请、值守覆盖和风险会话数量。
3. **成员与邀请列表区**: 展示成员状态并支持按活跃、待接受、已暂停筛选。
4. **邀请流程区**: 填写邮箱、默认角色与接入范围，完成新成员邀请。
5. **选中成员详情区**: 展示角色、时区、最近活动、负责模块与未处理事项。
6. **设备与会话区**: 展示风险会话或需要管理员关注的登录设备信息。
7. **风险动作区**: 提供暂停 / 恢复成员或处理高风险会话的明确动作。

## Key States

- **Default state**: 展示成员列表、当前选中成员详情、会话状态和邀请入口。
- **Loading state**: 先展示统计卡与成员列表骨架，再加载详情与会话信息。
- **Empty state**: 尚无额外成员时，保留当前管理员信息，并引导通过邀请扩充维护者。
- **Error state**: 邀请失败、成员状态更新失败或会话信息加载失败时，页面必须指出失败对象和恢复动作。
- **Permission / access state**: 仅管理员可邀请、暂停、恢复或调整成员状态；普通操作员不可管理他人身份。

## Content Hierarchy

- **Primary information**: 当前谁可以登录、哪些成员待接受、是否存在风险会话。
- **Secondary information**: 角色、接入范围、最近活动、负责模块、当前会话状态。
- **Tertiary information**: 时区、设备明细、解释性提示。
- **Primary actions**: 发送邀请、暂停 / 恢复当前用户、处理会话风险。
- **Secondary actions**: 切换筛选、查看成员详情。

## Interaction Rules

- 首版用户管理应服务于“谁能进入后台”，而不是完整组织管理。
- 成员筛选与选中状态必须协同工作，切换筛选后仍应保证用户知道当前查看的是谁。
- 暂停成员必须是显式风险动作，并在执行后立即反映到其登录状态。
- 邀请流程应尽量短，避免首版引入复杂审批与多层角色配置。
- 页面必须保留恢复动作，不得只有暂停没有恢复。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `8.7 用户与权限治理 / 用户管理`、`8.7 用户与权限治理 / 权限策略`、`11. 内容规则`
- **Allowed overrides**: MVP 可不实现复杂角色矩阵，但必须保留成员状态、邀请状态和风险会话的基础可见性。
- **Forbidden deviations**: 不得把用户页扩展成通用组织后台；不得隐藏高风险会话或把其放入难以发现的位置。

## Data / Dependencies

- **Data sources**: 后台成员列表、邀请状态、成员最近活动、会话风险状态、成员当前启停状态
- **External dependencies**: 无
- **Cross-page dependencies**: `docs/pages/login.md`

## Notes

- 若首版只存在单管理员，本页仍应保留最小结构，以支持后续邀请和会话治理扩展。
- 更复杂的角色规则和审计策略应留给后续 `access-control` 相关 feature，而不是塞入当前 MVP。
