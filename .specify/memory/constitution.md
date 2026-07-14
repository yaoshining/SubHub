<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - 无
- Added sections:
  - 质量门禁与交付标准
  - 交付流程与评审要求
  - 并行特性治理
- Removed sections:
  - 无
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ .specify/templates/commands/*.md（路径不存在，无需更新）
  - ✅ README.md（已核对，无需更新）
  - ✅ docs/workflows/spec-github-worktree.md（已核对，已对齐）
- Deferred TODOs:
  - 无
-->

# SubHub 宪章

## 核心原则

### I. 代码质量是发布门禁

所有生产代码在合并前 MUST 通过格式化、静态检查与代码规范校验。
每次变更 MUST 保持可读性、模块化边界，并在 API 边界提供必要文档。
任何被接受的技术债 MUST 明确负责人、原因与后续跟踪任务。
Rationale: 一致的质量门禁可显著降低回归风险与长期维护成本。

### II. 测试是必需且分层的

每个功能与缺陷修复 MUST 包含先失败后通过的测试。
测试覆盖 MUST 包含核心逻辑单元测试，以及适配器边界、API 行为、缓存/存储交互的
集成测试或契约测试。
当必需测试失败时，Pull Request MUST NOT 被合并。
Rationale: 分层测试是聚合型 Provider 服务最关键的安全保障。

## III. 设计事实来源

- 全局视觉与交互规则以 `DESIGN.md` 为准。
- 页面级行为与布局约束以 `docs/pages/*.md` 为准。
- 当现有规则已覆盖场景时，实现 MUST NOT 自行引入新的视觉语言。
- 若新增页面或组件需要系统级规则，MUST 更新 `DESIGN.md`。
- 若变更仅影响单个页面，SHOULD 更新对应页面规范而非 `DESIGN.md`。

### IV. 用户体验必须保持一致

对外 API 在不同 Provider 下 MUST 保持可预期行为，包括响应结构、错误格式、
分页/排序语义与状态码约定。
当必须引入破坏性 UX/API 变化时，团队 MUST 记录迁移影响，并在发布说明中提供兼容指导。
Rationale: 下游媒体客户端依赖稳定且一致的集成行为。

### V. 必须定义性能预算

每个功能在实现前 MUST 定义可度量的性能目标（例如 p95 延迟、缓存命中率、
以及相关的内存/存储约束）。
对可能超出预算的改动，合并前 MUST 提供基准数据与缓解方案。
Rationale: SubHub 在多 Provider 与重缓存负载下必须保持响应能力。

### VI. 默认追求可维护与简洁

设计 MUST 优先采用简单且可替换的模块，而非紧耦合抽象。
Provider 集成 MUST 隔离在稳定接口之后，防止来源特定行为泄漏到核心 API。
Rationale: 模块化与简洁性可确保系统在 Provider 与策略持续演进时仍具可扩展性。

## 质量门禁与交付标准

- 每个 feature spec MUST 包含：测试策略、UX/API 一致性预期与性能目标。
- 每个 implementation plan MUST 通过宪章检查（Constitution Check）。
- 每个任务计划 MUST 明确包含测试、UX/API 一致性校验与性能验证任务。

## 交付流程与评审要求

- 必须以小步、可评审增量方式交付；每个 Pull Request MUST 声明与宪章原则的符合性。
- 当任一宪章门禁缺少证据时，评审者 MUST 阻止合并。
- CI 在每个 PR 上 MUST 执行格式化、静态检查与必需测试套件。
- 当运行时行为或对外 API 行为变更时，相关文档 MUST 同步更新。

## 并行特性治理

- 并行 feature MUST 使用独立 git worktree。
- 单个 worktree 在任一时刻 MUST 只跟踪一个 active feature。
- 单个 active feature MUST 精确映射到一个 spec 目录。
- 每个 feature MUST 拥有唯一 feature id。
- spec 目录、分支、issues、tasks 与 PR MUST 可追溯到同一 feature id。
- 一个 feature SHOULD 对应一个主 issue，且 MAY 拆分多个 task issue。
- 贡献者在同一 worktree 内 MUST NOT 在多个 active feature 间切换推进。
- 若第二个 feature 需要并行推进，MUST 创建新的 worktree。
- worktree 内的 `.specify/feature.json` MUST 反映该 worktree 正在开发的 active feature。
- 从 Spec Kit 工件创建的 GitHub issue MUST 引用来源 spec 目录与 feature id。
- task issues SHOULD 回指 `tasks.md` 中的 task id。
- issue 同步在一次动作中 MUST NOT 混合多个 spec 目录的任务。
- feature 在同步 task issues 前 SHOULD 完成核心 `spec -> plan -> tasks` 流程。
- 若工件尚不完整，SHOULD 仅创建一个主跟踪 issue。
- 本节仅定义治理策略，MUST NOT 规定具体 shell 命令。

## 治理

本宪章是 SubHub 工程治理的最高层规则。若与其他指导冲突，以本文件为准。

修订必须满足：
（1）有文档化提案；
（2）维护者评审批准；
（3）在同一变更中同步更新受影响模板与指导文档。

版本策略：

- MAJOR：治理规则出现不兼容变更，或原则被移除/重定义。
- MINOR：新增原则/章节，或对政策进行实质扩展。
- PATCH：仅澄清措辞与非语义性修订。

合规评审要求：

- 每个 PR 评审 MUST 包含显式的宪章符合性检查。
- 周期性审计 MUST 对 active specs/plans/tasks 抽样核验政策一致性。

**Version**: 1.1.0 | **Ratified**: 2026-05-21 | **Last Amended**: 2026-05-22
