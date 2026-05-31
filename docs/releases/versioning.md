# SubHub 版本约定

## 版本策略

- `v0.1.0`：当前已收口的 MVP 版本。
- `v0.2.0`：数据库与部署生产化版本，重点覆盖 Neon / Vercel 路线、运行时环境映射、初始化与迁移流程收敛。
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

### `v1.0.0`

代表产品与基础设施均达到正式稳定首发标准：

- MVP 主功能稳定可用
- 数据库与部署路线稳定
- 初始化与迁移流程稳定
- 主要交付链路、验收与发布方式明确

## 与仓库流程的关系

- 当前 `specs/001-mvp-admin-console/` 对应的收口版本为 `v0.1.0`。
- 后续数据库 / 部署生产化工作建议以独立 feature 或独立 spec 形式推进，并默认对应 `v0.2.0`。
- GitHub milestone 可逐步从阶段性命名过渡到版本号命名，但 `scope:*` 标签仍保留为范围控制手段，不与版本号职责混淆。

## GitHub Milestone 约定

- 当前仓库已建立版本 milestones：`v0.1.0`、`v0.2.0`、`v1.0.0`。
- 历史 milestones：`MVP`、`Post-MVP`、`Future` 继续保留，用于过渡期兼容与历史查询，不再作为版本归档主入口。
- 已完成的 MVP 管理控制台与统一字幕出口相关 issue 已迁移至 `v0.1.0`；旧 `MVP` milestone 保留但应维持为空。
- 后续新 issue 默认优先按版本目标挂 milestone，而不是继续挂到 `MVP`、`Post-MVP`、`Future`。
- `scope:*` 标签负责表达范围层级，例如 `scope:mvp`、`scope:post-mvp`、`scope:future`；milestone 负责表达目标版本，两者不得互相替代。
- 当 issue 属于当前首发闭环，应优先归入 `v0.1.0`；数据库与部署生产化工作应优先归入 `v0.2.0`；正式稳定首发收口工作应优先归入 `v1.0.0`。
- 若出现仅需表达长期积压、但尚未承诺版本窗口的事项，可暂不设置版本 milestone，仅保留 `scope:*` 标签，待进入明确版本规划后再补 milestone。
