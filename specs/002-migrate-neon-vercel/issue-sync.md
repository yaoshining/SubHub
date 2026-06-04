# 002 Issue 同步方案: Neon Postgres + Vercel 运行时迁移

本文件用于把 [specs/002-migrate-neon-vercel/tasks.md](specs/002-migrate-neon-vercel/tasks.md) 映射为可直接创建的 GitHub issue 批次。

## 使用原则

- 本 feature 的 issue 同步范围仅限 [specs/002-migrate-neon-vercel/spec.md](specs/002-migrate-neon-vercel/spec.md)、[specs/002-migrate-neon-vercel/plan.md](specs/002-migrate-neon-vercel/plan.md) 和 [specs/002-migrate-neon-vercel/tasks.md](specs/002-migrate-neon-vercel/tasks.md)，不得与 [specs/001-mvp-admin-console/tasks.md](specs/001-mvp-admin-console/tasks.md) 混批。
- 必须先创建 002 主追踪 issue，再创建 task issues。
- 当前 feature 属于 `scope:mvp`，默认 milestone 使用 `MVP`。
- 每个正式 issue 至少带 1 个 `type:*`、1 个 `area:*`、1 个 `priority:*`、1 个 `scope:*`；进入执行后再补 1 个 `stage:*`。
- 仓库 instructions 已明确 `scope:*` 与 milestone 规则；但当前上下文未给出 `area:*`、`priority:*`、`stage:*` 的完整枚举列表。因此本文件给出“建议值”。若仓库已有等价标签名，应优先替换为仓库已有值，不另造并行标签。

## 建议的 issue 批次

建议使用 1 个主追踪 issue + 6 个 task issues。

### 主追踪 issue

**建议标题**

002 运行时迁移主追踪 issue

**建议职责**

- 追踪 feature 边界、主里程碑、外部阻塞项与 task issues 依赖关系。
- 链接 [specs/002-migrate-neon-vercel/spec.md](specs/002-migrate-neon-vercel/spec.md)、[specs/002-migrate-neon-vercel/plan.md](specs/002-migrate-neon-vercel/plan.md)、[specs/002-migrate-neon-vercel/tasks.md](specs/002-migrate-neon-vercel/tasks.md) 和 [specs/002-migrate-neon-vercel/issue-sync.md](specs/002-migrate-neon-vercel/issue-sync.md)。
- 记录外部阻塞项：Neon prod/staging/dev、Vercel Production/Preview、SQLite 备份/迁移窗口。

**建议 labels**

- `type:feature`
- `area:infra`
- `priority:high`
- `scope:mvp`
- `stage:ready`

**建议 milestone**

- `MVP`

### Task Issue A

**建议标题**

002A 建立 Postgres 迁移基线与环境映射基础设施

**对应任务**

- `T001-T018`

**建议职责**

- 建立单一 `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 模型。
- 切换 Drizzle 与 `StorageClient` 到 Postgres 正式路径。
- 建立 Postgres baseline migration、bootstrap 真源和测试脚手架。

**建议 labels**

- `type:task`
- `area:infra`
- `area:backend`
- `priority:high`
- `scope:mvp`
- `stage:ready`

**建议 milestone**

- `MVP`

**依赖**

- 依赖主追踪 issue 创建完成。

### Task Issue B

**建议标题**

002B 让 Production 在 Neon Postgres 上跑通当前 MVP

**对应任务**

- `T019-T028`

**建议职责**

- 落地 production runtime readiness、后台与字幕 API 主路径回归。
- 建立 production migration workflow 与 deploy smoke gate。

**建议 labels**

- `type:task`
- `area:infra`
- `area:backend`
- `area:devops`
- `priority:high`
- `scope:mvp`
- `stage:ready`

**建议 milestone**

- `MVP`

**依赖**

- 依赖 002A。

### Task Issue C

**建议标题**

002C 固化 Preview 与 Development 的环境映射与护栏

**对应任务**

- `T029-T037`

**建议职责**

- 固化 `preview -> staging`、命中仓库级 Preview 分支白名单的普通 Preview 分支与本地 development -> dev 的映射，并明确非白名单 Preview 分支直接失败。
- 将环境选路责任保持在 Vercel 注入层，应用仅做校验与失败护栏。

**建议 labels**

- `type:task`
- `area:infra`
- `area:devops`
- `priority:high`
- `scope:mvp`
- `stage:ready`

**建议 milestone**

- `MVP`

**依赖**

- 依赖 002A。

### Task Issue D

**建议标题**

002D 实现 SQLite 到 Postgres 的搬迁与 cutover 校验链路

**对应任务**

- `T038-T048`

**建议职责**

- 将 SQLite 限定为迁移输入来源。
- 落地 precheck、import、validate-cutover、fixture 与失败阻断链路。

**建议 labels**

- `type:task`
- `area:infra`
- `area:backend`
- `priority:high`
- `scope:mvp`
- `stage:ready`

**建议 milestone**

- `MVP`

**依赖**

- 依赖 002A。
- 真正执行 cutover 前还依赖外部 SQLite 备份/快照与迁移窗口。

### Task Issue E

**建议标题**

002E 建立 greenfield/cutover/staging/dev 的 bootstrap、seed 与 release gate

**对应任务**

- `T049-T058`

**建议职责**

- 区分 greenfield production、cutover production、staging seed、dev seed 四条路径。
- 建立 migration job、post-migration smoke gate 和 release-blocking checks。

**建议 labels**

- `type:task`
- `area:infra`
- `area:devops`
- `area:backend`
- `priority:medium`
- `scope:mvp`
- `stage:ready`

**建议 milestone**

- `MVP`

**依赖**

- 依赖 002A。
- 建议在 002B 与 002D 的核心脚本稳定后推进。

### Task Issue F

**建议标题**

002F 完成 Postgres 迁移后的回归、文档与发布候选验证

**对应任务**

- `T059-T064`

**建议职责**

- 回写 decision/workflow 文档。
- 验证 001 主链路在 Postgres 运行时下无行为回退。
- 完成 OpenAPI/Orval/Scalar 链路与 release candidate 验证。

**建议 labels**

- `type:task`
- `area:infra`
- `area:docs`
- `area:qa`
- `priority:medium`
- `scope:mvp`
- `stage:ready`

**建议 milestone**

- `MVP`

**依赖**

- 依赖 002B、002C、002D、002E。

## 建议创建顺序

1. 创建主追踪 issue。
2. 创建 002A，作为所有故事的前置基础。
3. 创建 002B、002C、002D。
4. 创建 002E。
5. 创建 002F。

## 建议执行顺序

1. 先完成 002A。
2. 以 002B 作为 MVP 最小闭环，先拿到 production 可运行结果。
3. 002C 与 002D 可在 002A 后并行推进，但共享 `.github/workflows/`、`src/lib/env.ts`、`package.json` 时需要串行合并。
4. 002E 在 002B 与 002D 稳定后推进，避免 bootstrap / release gate 反复返工。
5. 002F 最后执行，负责总体验收与回写真源。

## 任务到 issue 的映射摘要

| Issue | 任务范围 | 主层级 | 阻塞关系 |
|---|---|---|---|
| 主追踪 issue | feature 全量 | 追踪 / 协调 | 无 |
| 002A | T001-T018 | 环境映射层 + Postgres 接入层 + bootstrap 真源 | 主追踪 issue |
| 002B | T019-T028 | production runtime + workflow gate | 002A |
| 002C | T029-T037 | preview/dev 环境映射与护栏 | 002A |
| 002D | T038-T048 | SQLite 搬迁层 + cutover 校验层 | 002A |
| 002E | T049-T058 | bootstrap/seed/release gate 层 | 002A，建议晚于 002B/002D |
| 002F | T059-T064 | 文档、回归、RC 验证 | 002B/002C/002D/002E |

## 不应进入当前 issue 批次的内容

- PR 级 Neon database branch 自动创建。
- 超出 [specs/002-migrate-neon-vercel/spec.md](specs/002-migrate-neon-vercel/spec.md) 的产品扩张。
- 对 [specs/001-mvp-admin-console/spec.md](specs/001-mvp-admin-console/spec.md) 的新功能性补需求。

这些内容如后续需要，应单独建 feature，并标记为 `scope:future` 或 `scope:post-mvp`，不要混入当前 002 的 `scope:mvp` issue 批次。

## 建议的主追踪 issue 模板骨架

```md
## 背景

将 SubHub 当前 MVP 的正式运行底座从 SQLite + 单机部署迁移到 Neon Postgres + Vercel，保持 001 已定义产品范围不变。

## 设计真源

- [ ] [specs/002-migrate-neon-vercel/spec.md](specs/002-migrate-neon-vercel/spec.md)
- [ ] [specs/002-migrate-neon-vercel/plan.md](specs/002-migrate-neon-vercel/plan.md)
- [ ] [specs/002-migrate-neon-vercel/tasks.md](specs/002-migrate-neon-vercel/tasks.md)
- [ ] [specs/002-migrate-neon-vercel/issue-sync.md](specs/002-migrate-neon-vercel/issue-sync.md)

## 外部阻塞项

- [ ] Neon prod / staging / dev 已准备
- [ ] Vercel Production / Preview 变量注入与分支覆盖已准备
- [ ] SQLite 备份/快照与迁移窗口已准备

## Task Issues

- [ ] 002A 建立 Postgres 迁移基线与环境映射基础设施
- [ ] 002B 让 Production 在 Neon Postgres 上跑通当前 MVP
- [ ] 002C 固化 Preview 与 Development 的环境映射与护栏
- [ ] 002D 实现 SQLite 到 Postgres 的搬迁与 cutover 校验链路
- [ ] 002E 建立 greenfield/cutover/staging/dev 的 bootstrap、seed 与 release gate
- [ ] 002F 完成 Postgres 迁移后的回归、文档与发布候选验证
```
