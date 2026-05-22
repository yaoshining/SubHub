# Page Spec

## Metadata

- **Page**: API Keys
- **Route / Entry Point**: `api-keys.html` / `/api-keys`
- **Status**: Active
- **Last Updated**: 2026-05-22
- **Related Feature Specs**: `specs/001-mvp-admin-console/spec.md`

## Goal

让管理员把下游调用方 Key 当作受管理对象运营，完成生成、轮换、停用、筛选和最近使用回看，并确保对外统一字幕服务只被有效调用方访问。

## Audience / Scenario

- **Primary user**: 管理员 / 平台维护者
- **Primary scenario**: 为外部应用签发访问凭据，处理泄漏风险，停用异常调用方
- **Frequency / importance**: 高频治理页；直接影响对外 API 可控性

## Modules / Sections

1. **页头与关键动作区**: 提供创建新 Key、轮换当前 Key 等高频动作。
2. **Key 摘要卡**: 展示活跃 Key、近 30 天轮换次数、已停用数量和配额预警数量。
3. **Key 清单区**: 展示调用方、Key 标识、环境、Scope、配额、状态，并支持按状态筛选。
4. **新建与授权区**: 为新调用方填写名称、环境、Scope 和配额。
5. **选中 Key 详情区**: 展示当前选中 Key 的状态、最近使用情况、停用入口和轮换结果。
6. **治理说明区**: 提醒管理员轮换、停用和异常处理的基本原则。

## Key States

- **Default state**: 展示 Key 清单、当前选中 Key 的详情和创建新 Key 表单。
- **Loading state**: 先展示摘要和清单骨架，再加载选中项详情。
- **Empty state**: 尚未创建任何调用方 Key 时，突出“创建首个 Key”的表单与用途说明。
- **Error state**: 创建、停用、轮换失败时给出明确反馈，并保留原有清单可见性。
- **Permission / access state**: 只读用户可查看 Key 状态摘要，但不能看到明文、轮换或停用入口。

## Content Hierarchy

- **Primary information**: 哪些 Key 可继续服务、哪个 Key 正在预警、当前是否已有可用调用方入口。
- **Secondary information**: 调用方名称、环境、Scope、配额、状态、最近使用与轮换历史。
- **Tertiary information**: 细粒度说明、治理解释、异常注记。
- **Primary actions**: 生成新 Key、轮换当前 Key、停用当前 Key。
- **Secondary actions**: 筛选环境/状态、查看单个 Key 详情。

## Interaction Rules

- Key 列表的筛选必须保留当前选中上下文，避免筛选后用户丢失正在处理的对象。
- 新 Key 的明文只在创建后短暂展示一次，后续页面以受控标识展示为主。
- 停用与轮换是不同动作：停用应立即阻止新请求，轮换应明确生成新版本并更新当前状态。
- 当不存在任何活跃 Key 时，页面顶部必须显式提示“对外服务不可用”。
- 页面必须保留最近使用信息，不能只展示静态凭据清单。

## Page-Specific Design Rules

- **Relevant global rules from `DESIGN.md`**: `2. 产品定位与界面原则`、`6. 布局与密度原则`、`7.3 输入框、选择器与表单`、`7.4 表格与列表`、`7.5 状态标签、Badge、Chip`、`8. 状态与反馈规则`、`9. 数据展示与技术信息呈现`
- **Allowed overrides**: MVP 可简化环境、配额和作用域枚举，但必须保留 Key 生命周期视角。
- **Forbidden deviations**: 不得把 API Key 页面做成单次生成表单；不得让停用、轮换结果无状态反馈。

## Data / Dependencies

- **Data sources**: 调用方 Key 清单、Key 状态、轮换记录、最近使用摘要、Scope / 配额配置
- **External dependencies**: 外部应用接入关系
- **Cross-page dependencies**: `docs/pages/dashboard.md`

## Notes

- 本页只管理下游调用方 Key，不管理上游 Provider 凭据。
- 若后续加入更细粒度的访问控制，应保持本页仍然聚焦 Key 生命周期而不是通用权限中心。
