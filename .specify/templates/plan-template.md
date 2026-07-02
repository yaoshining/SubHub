# 实施计划: [FEATURE]

**分支**: `[###-feature-name]` | **日期**: [DATE] | **规格**: [link]

**输入**: 来自 `/specs/[###-feature-name]/spec.md` 的功能规格

**说明**: 本模板由 `/speckit.plan` 命令填充。执行流程见 `.specify/templates/plan-template.md`。

## 摘要

[从功能规格中提取：核心需求 + 研究得出的技术方案]

## 设计上下文

**全局设计系统**: `DESIGN.md`

**相关页面规范**:

- [列出本功能引用的页面规范，例如 `docs/pages/dashboard.md`]

**已评审的设计输入**:

- [列出用于规划的原型、截图、HTML 制品或其他设计参考]

## 技术上下文

<!--
  ACTION REQUIRED: 用项目的技术细节替换本节内容。
  此结构作为建议性框架，用于指导迭代过程。
-->

**语言/版本**: [例如 Python 3.11、Swift 5.9、Rust 1.75，或 NEEDS CLARIFICATION]

**核心依赖**: [例如 FastAPI、UIKit、LLVM，或 NEEDS CLARIFICATION]

**存储**: [如适用，例如 PostgreSQL、CoreData、files，或 N/A]

**测试**: [例如 pytest、XCTest、cargo test，或 NEEDS CLARIFICATION]

**目标平台**: [例如 Linux server、iOS 15+、WASM，或 NEEDS CLARIFICATION]

**项目类型**: [例如 library/cli/web-service/mobile-app/compiler/desktop-app，或 NEEDS CLARIFICATION]

**性能目标**: [领域相关，例如 1000 req/s、10k lines/sec、60 fps，或 NEEDS CLARIFICATION]

**约束条件**: [领域相关，例如 <200ms p95、<100MB memory、offline-capable，或 NEEDS CLARIFICATION]

**规模/范围**: [领域相关，例如 10k users、1M LOC、50 screens，或 NEEDS CLARIFICATION]

## 宪章检查

_门禁：必须在第 0 阶段研究前通过，并在第 1 阶段设计后复检。_

- 已定义代码质量门禁（format、lint、static analysis），并在 CI 中强制执行。
- 已定义必需测试策略（适用时包含 unit + integration/contract）。
- 已定义对外行为的 UX/API 一致性约束。
- 已定义可度量性能预算与验证方法。
- 已记录面向长期可维护性的简洁化/模块化方案。
- 已识别设计来源（`DESIGN.md` + 相关 `docs/pages/*.md`），并映射到功能范围。
- 计划已声明是否需要对 `DESIGN.md` 增补系统级规则。
- 已明确 worktree 隔离：一个 worktree 仅对应一个 active feature。
- 已明确可追溯关系：feature id 映射到一个 spec 目录、一个分支与一个主 issue。
- 已明确 issue 同步范围：同步 task issue 时不得跨 spec 混批。

## 设计映射

### 适用规则

- **全局规则**: [列出相关 `DESIGN.md` 章节、设计令牌或组件规则]
- **页面规则**: [列出本功能必须遵循的页面级布局、状态与层级规则]

### 计划中的文档变更

- **更新 `DESIGN.md`**: [Yes/No + 原因]
- **更新既有页面规范**: [列出文件或 `None`]
- **新建页面规范**: [列出文件或 `None`]

## 项目结构

### 文档（本功能）

```text
specs/[###-feature]/
├── plan.md              # 本文件（/speckit.plan 产物）
├── research.md          # 第 0 阶段产物（/speckit.plan）
├── data-model.md        # 第 1 阶段产物（/speckit.plan）
├── quickstart.md        # 第 1 阶段产物（/speckit.plan）
├── contracts/           # 第 1 阶段产物（/speckit.plan）
└── tasks.md             # 第 2 阶段产物（/speckit.tasks，非 /speckit.plan 创建）
```

### 设计文档（仓库根目录）

```text
DESIGN.md                # 全局设计系统与视觉规则
docs/
└── pages/
    ├── page-spec-template.md
  └── [page-name].md   # 页面级目标、模块、状态与覆盖规则
```

### 源码（仓库根目录）

<!--
  ACTION REQUIRED: 将下方占位目录树替换为本功能的真实结构。
  删除未使用选项，并用真实路径扩展所选结构（如 apps/admin、packages/...）。
  最终计划中不得保留 Option 标签。
-->

```text
# [REMOVE IF UNUSED] Option 1: 单体项目（默认）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web 应用（检测到 "frontend" + "backend" 时）
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: 移动端 + API（检测到 "iOS/Android" 时）
api/
└── [与上方 backend 类似]

ios/ or android/
└── [平台特定结构：功能模块、UI 流程、平台测试]
```

**结构决策**: [记录所选结构，并引用上方真实目录]

## 设计保真实施策略

- 在引入新模式前，优先复用既有视觉与交互规则。
- 实施过程中，代码校验必须同时对照 `DESIGN.md` 与相关页面规范。
- 若实现暴露页面级变更，必须在同一 feature 中更新对应页面规范。
- 若实现暴露跨页面新规则，必须在同一 feature 中更新 `DESIGN.md`。

## 复杂度追踪

> **仅当宪章检查存在需说明的例外时填写**

| 例外项                  | 必要原因   | 为何拒绝更简单方案     |
| ----------------------- | ---------- | ---------------------- |
| [例如：第 4 个子项目]   | [当前需求] | [为何 3 个子项目不足]  |
| [例如：Repository 模式] | [具体问题] | [为何直接 DB 访问不足] |
