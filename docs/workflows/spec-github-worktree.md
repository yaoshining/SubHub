# Spec / GitHub / Worktree 并行工作流

本文档定义 SubHub 在 `Spec Kit + GitHub Issues + git worktree` 下的并行 feature 工作方式。

## 目标

- 允许多个 feature 并行推进。
- 让每个 feature 的 `spec`、`branch`、`worktree`、`issue` 关系清晰且可追溯。
- 避免单一工作区中的 `active feature` 相互覆盖。

## 核心原则

- 一个 `worktree` 只服务一个 active feature。
- 一个 active feature 只对应一个 `specs/<feature-id>-<name>/` 目录。
- 一个 feature 对应一个主 issue，可再拆分多个 task issues。
- 并行 feature 必须使用独立 worktree，不在同一 worktree 中混用多个 active feature。
- 分支名、issue、PR、任务都应包含 feature id。

## 对应关系

推荐保持如下映射：

| 实体          | 对应关系                          |
| ------------- | --------------------------------- |
| Feature       | 一个产品功能或变更主题            |
| Spec          | `specs/<feature-id>-<name>/`      |
| Worktree      | 一个独立工作目录                  |
| Branch        | 一个 feature branch               |
| Spec 主 Issue | 一个 feature 的 GitHub 主 issue   |
| Task Issues   | `tasks.md` 拆分出的并行任务 issue |

示例：

| 项目元素   | 示例                                 |
| ---------- | ------------------------------------ |
| Feature ID | `003`                                |
| Spec 目录  | `specs/003-search-improvements/`     |
| Branch     | `feat/003-search-improvements`       |
| Worktree   | `../subhub-003-search-improvements`  |
| 主 Issue   | `[Spec 003] 搜索体验改进`            |
| 子 Issue   | `[003][T012] 实现搜索筛选状态持久化` |

## 推荐命名规则

### Branch

- `feat/<feature-id>-<short-name>`
- 例如：`feat/003-search-improvements`

### Worktree

- `<repo-name>-<feature-id>-<short-name>`
- 例如：`subhub-003-search-improvements`

### Spec 目录

- `specs/<feature-id>-<short-name>/`
- 例如：`specs/003-search-improvements/`

### 主 Issue

- `[Spec <feature-id>] <中文标题>`
- 例如：`[Spec 003] 搜索体验改进`

### Task Issue

- `[<feature-id>][Txxx] <任务标题>`
- 例如：`[003][T012] 实现搜索筛选状态持久化`

## 并行工作流程

### 1. 为新 feature 建立独立分支与 worktree

- 创建 feature branch。
- 为该 branch 创建独立 worktree。
- 在该 worktree 中运行 `speckit.specify`、`speckit.plan`、`speckit.tasks`。

### 2. 在该 worktree 中只维护一个 active feature

- `.specify/feature.json` 只指向当前 feature 对应的 spec 目录。
- 不在同一 worktree 中切换到其他 feature 继续推进。

### 3. 完成 spec 文档后同步 GitHub issues

建议同步两层 issue：

- 主 issue：代表整个 feature
- task issues：代表 `tasks.md` 中可并行处理的任务

每个 issue 都应包含：

- 对应 spec 路径
- feature id
- 依赖关系（如有）
- 验收标准

### 4. 按 task issue 并行开发

- 一个 task issue 对应一个开发任务。
- 可以在同一 feature branch 下连续完成多个任务。
- 如果同一 feature 下任务间冲突较大，也可以继续拆分更细的分支，但仍归属于该 feature。

### 5. PR 与 issue / spec 关联

每个 PR 至少应关联：

- 一个 feature id
- 一个主 issue 或 task issue
- 对应 spec 路径

## issue 同步建议

### 推荐结构

每个 feature 可维护一个映射文件，例如：

`specs/<feature-id>-<short-name>/issue-map.json`

示例：

```json
{
  "spec_issue": 123,
  "task_issues": {
    "T012": 124,
    "T013": 125
  }
}
```

用途：

- 防止重复建 issue
- 支持增量同步
- 支持从 spec 快速回查 GitHub issues

### issue body 建议包含

主 issue：

- feature 简介
- spec 路径
- `spec.md` / `plan.md` / `tasks.md` 位置
- success criteria
- 子 issue 列表

task issue：

- feature id
- task id
- task 原文
- 依赖任务
- 验收标准
- 建议分支名

## 风险与禁止事项

### 禁止事项

- 不要在同一 worktree 中推进多个 active feature。
- 不要在 issue 同步时混用多个 spec 目录作为一个批次。
- 不要让分支、issue、PR 脱离 feature id。
- 不要在未完成 `spec -> plan -> tasks` 基础文档前直接批量建 task issues。

### 常见风险

- `.specify/feature.json` 指向错误 feature，导致后续命令落到错误 spec。
- 多个 feature 使用相同编号或相似目录名，导致 issue / branch 混乱。
- task issues 缺少 spec 路径和验收标准，后续实现不可追踪。

## 最小执行建议

如果先追求可落地，而不是一步到位自动化，建议先采用下面的最小方案：

1. 一条 feature 分支对应一个 worktree。
2. 一条 feature 分支只维护一个 active feature。
3. 每个 feature 先手动完成 `spec.md`、`plan.md`、`tasks.md`。
4. 再为该 feature 同步一个主 issue 和多个 task issues。
5. issue、branch、PR 全部带 feature id。

这套方式已经足够支持多 feature 并行，且能与当前 Spec Kit 的 active feature 模型兼容。
