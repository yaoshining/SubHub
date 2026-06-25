# SubHub 版本约定

## 版本策略

- `v0.1.0`：当前已收口的 MVP 版本。
- `v0.2.0`：数据库与部署生产化版本，重点覆盖 Neon / Vercel 路线、运行时环境映射、初始化与迁移流程收敛。
- `v0.2.1`：在 `v0.2.0` 正式运行基线之上，针对已发布 API 的小步快跑式字段扩展；本版本以 003「字幕搜索字段扩展」为代表。
- `v0.2.2`：在 `v0.2.1` 字段扩展基础上，正式建立适合多 provider 的聚合搜索入口模型，使接口可以接收 richer request fields，并允许各 provider 按自身能力选择性消费字段，为后续接入迅雷等第二字幕源打好契约与实现边界。
- `v0.2.x`：允许在 `v0.2.0` 之后引入 patch 级版本，承载"已发布 API 的非 breaking 字段扩展"或"已建立 feature 的小幅补强"，不引入新的产品模块或数据库 schema 变更。
- `v1.0.0`：产品功能与基础设施都达到正式稳定首发标准后的版本。

## 各版本含义

### `v0.1.0`

代表当前首个可用 MVP 闭环，覆盖：

- 管理控制台登录
- Dashboard
- Providers
- API Keys
- Users
- Settings
- 统一字幕查询与下载出口

以下内容不视为 `v0.1.0` 已解决范围：

- 生产数据库路线最终收敛
- Vercel 部署与环境映射收敛
- 生产初始化 / migration / bootstrap 流程标准化
- 每个 PR 对应独立数据库分支等高级预览策略

### `v0.2.0`

代表在保持 `v0.1.0` MVP 功能范围不变的前提下，完成数据库与部署生产化能力收敛，例如：

- 数据库迁移到 Neon Postgres
- Vercel 运行时与环境变量策略明确
- Production / Preview / Development 环境映射稳定
- migration、seed、bootstrap 与发布流程收敛

### `v0.2.1`

代表在 `v0.2.0` 正式运行基线之上的第一轮 patch 版本，重点解决「字幕搜索接口请求字段不足」的问题，对应 003「字幕搜索字段扩展」。

首版（Tier 1）实际落地字段：

- `imdb_id`：格式 `^tt\d+$`，IMDb ID 定位
- `tmdb_id`：正整数，TMDb ID 定位
- `type`：`movie` | `episode`，与 `season`/`episode` 冲突时返回 400

保持现有字段命名不变：`title` / `year` / `season` / `episode` / `language`。

明确不包含在 `v0.2.1`：

- `filename`（Tier 2 辅助字段，价值有限，暂缓）
- `moviehash`（Tier 3，需调用方客户端预计算哈希，暂缓）
- `hearing_impaired` / `foreign_parts_only`（Tier 2-3，偏好过滤 / 上游不稳定，暂缓）
- 字段改名（`season` → `season_number`、`language` → `languages`）—— 涉及 breaking 风险，不在 patch 版本内做
- 多 provider 能力模型设计
- provider 路由 / fallback 编排
- 新字幕 provider 正式接入
- 手动上传字幕
- 缓存字幕管理
- 自有字幕资产管理
- AI 字幕处理

`v0.2.1` 属于「字幕搜索字段扩展」阶段，重点解决请求字段不足的问题，不进入多 provider 搜索建模与字幕资产管理阶段。

### `v0.2.2`

代表在 `v0.2.1` 字段扩展基础上的「多字幕 provider 搜索入口模型基础版」阶段，目标不是简单继续加字段，而是正式建立适合多 provider 的聚合搜索入口模型，使接口可以接收 richer request fields，并允许各 provider 按自身能力选择性消费字段，为后续接入迅雷等第二字幕源打好契约与实现边界。

建议包含的范围：

- 定义 SubHub 稳定的聚合字幕搜索请求模型
- 明确"字段可传 != 所有 provider 都支持"的 provider 能力边界
- provider 选择性消费请求字段
- provider 参数映射边界收敛
- 为 OpenSubtitles 保留结构化字段优势
- 为迅雷等名称检索型 provider 预留接入方式
- provider 结果标准化的基础准备
- 更新 OpenAPI / generated client / tests / 文档

明确不包含在 `v0.2.2`：

- 手动上传字幕
- 缓存字幕查看/编辑/转正
- 自有字幕资产管理
- AI 审核/清洗字幕内容
- 大规模 provider 架构重写
- 完整 provider 调度系统
- 高级 provider 熔断、排序、评分编排
- breaking API 重设计（除非单独评审）

`v0.2.2` 属于「多 provider 搜索入口模型」阶段，重点解决聚合搜索契约与 provider 消费边界问题，不进入字幕资产管理阶段。

### `v1.0.0`

代表产品与基础设施均达到正式稳定首发标准：

- MVP 主功能稳定可用
- 数据库与部署路线稳定
- 初始化与迁移流程稳定
- 主要交付链路、验收与发布方式明确

## 与仓库流程的关系

- 当前 `specs/001-mvp-admin-console/` 对应的收口版本为 `v0.1.0`。
- `specs/002-migrate-neon-vercel/` 对应的收口版本为 `v0.2.0`。
- `specs/003-subtitle-search-fields/` 对应的收口版本为 `v0.2.1`。
- 后续「多 provider 搜索入口模型基础版」工作（对应 `v0.2.2`）建议以独立 feature / spec 形式推进（如 `specs/004-*`），并默认对应 `v0.2.2`。
- 后续数据库 / 部署生产化工作建议以独立 feature 或独立 spec 形式推进，并默认对应 `v0.2.0`。
- 已发布 API 的非 breaking 字段扩展可对应 `v0.2.x`（如 `v0.2.1`），并应同步在对应 spec 的 `tasks.md` §Issue 映射表中说明该 milestone。
- GitHub milestone 可逐步从阶段性命名过渡到版本号命名，但 `scope:*` 标签仍保留为范围控制手段，不与版本号职责混淆。

## GitHub Milestone 约定

- 当前仓库已建立版本 milestones：`v0.1.0`、`v0.2.0`、`v0.2.1`、`v0.2.2`、`v1.0.0`。
- 历史 milestones：`MVP`、`Post-MVP`、`Future` 继续保留，用于过渡期兼容与历史查询，不再作为版本归档主入口。
- 已完成的 MVP 管理控制台与统一字幕出口相关 issue 已迁移至 `v0.1.0`；旧 `MVP` milestone 保留但应维持为空。
- 已完成的 002 Neon / Vercel 基础设施迁移相关 issue 归入 `v0.2.0`。
- 已完成的 003「字幕搜索字段扩展」37 个 issue 已从 `v0.2.0` 迁移至 `v0.2.1`；该里程碑承载的是 patch 级字段扩展，不与 `v0.2.0` 的数据库与部署生产化职责重叠。
- 后续新 issue 默认优先按版本目标挂 milestone，而不是继续挂到 `MVP`、`Post-MVP`、`Future`。
- `scope:*` 标签负责表达范围层级，例如 `scope:mvp`、`scope:post-mvp`、`scope:future`；milestone 负责表达目标版本，两者不得互相替代。
- 当 issue 属于当前首发闭环，应优先归入 `v0.1.0`；数据库与部署生产化工作应优先归入 `v0.2.0`；已发布 API 的非 breaking 字段扩展应优先归入 `v0.2.x`（如 `v0.2.1`）；多 provider 搜索入口模型工作应优先归入 `v0.2.2`；正式稳定首发收口工作应优先归入 `v1.0.0`。
- patch 级 milestone（`v0.2.x`）只承载"已发布 API 的非 breaking 字段扩展"或"已建立 feature 的小幅补强"，不引入新模块、不变更数据库 schema、不引入 breaking 行为；若突破该边界，应升至 minor（`v0.3.0`）或 major。
- 若出现仅需表达长期积压、但尚未承诺版本窗口的事项，可暂不设置版本 milestone，仅保留 `scope:*` 标签，待进入明确版本规划后再补 milestone。
