---
description: "功能实现任务清单模板"
---

# 任务清单: [FEATURE NAME]

**输入**: 来自 `/specs/[###-feature-name]/` 的设计文档

**前置条件**: plan.md（required）、spec.md（用户故事 required）、research.md、data-model.md、contracts/
及所有被引用的设计文档（`DESIGN.md`、`docs/pages/*.md`）

**可追溯前置条件**: 在同步 task issue 前，功能工件中 MUST 明确定义 feature id、spec 目录、分支与主 issue 关联关系。

**测试**: 下方示例包含测试任务。测试默认 REQUIRED，且按需 MUST 覆盖 unit + integration/contract 场景。

**组织方式**: 任务按用户故事分组，以支持每个故事独立实现与独立测试。

## 格式: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无依赖）
- **[Story]**: 任务所属用户故事（如 US1、US2、US3）
- 描述中必须包含精确文件路径

## 路径约定

- **单体项目**: 仓库根目录使用 `src/`、`tests/`
- **Web 应用**: `backend/src/`、`frontend/src/`
- **移动端**: `api/src/`、`ios/src/` 或 `android/src/`
- **设计文档**: `DESIGN.md`、`docs/pages/`
- 下方路径示例默认按单体项目，需按 plan.md 实际结构调整

<!--
  ============================================================================
  IMPORTANT: 下方任务仅为示例任务，用于说明格式。

  /speckit.tasks 命令 MUST 用真实任务替换这些示例，依据包括：
  - spec.md 中的用户故事（含优先级 P1、P2、P3...）
  - plan.md 中的功能需求
  - data-model.md 中的实体
  - contracts/ 中的接口定义

  任务 MUST 按用户故事组织，以确保每个故事可以：
  - 独立实现
  - 独立测试
  - 作为 MVP 增量独立交付

  生成的 tasks.md 中 MUST NOT 保留这些示例任务。
  ============================================================================
-->

## 阶段 1: 初始化（共享基础设施）

**目的**: 项目初始化与基础结构搭建

- [ ] T001 评审 `DESIGN.md`，并在 `/specs/[###-feature-name]/plan.md` 列出与本功能相关的全局规则
- [ ] T002 评审所有引用的 `docs/pages/*.md`，确认受影响页面、模块与状态
- [ ] T003 按实施计划创建项目结构
- [ ] T004 使用 [framework] 依赖初始化 [language] 项目
- [ ] T005 [P] 配置 lint 与格式化工具

---

## 阶段 2: 基础能力（阻塞性前置）

**目的**: 在开始任何用户故事实现前 MUST 完成的核心基础设施

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事开发

基础任务示例（需按项目实际调整）：

- [ ] T006 搭建数据库 schema 与迁移框架
- [ ] T007 [P] 实现认证/授权框架
- [ ] T008 [P] 搭建 API 路由与中间件结构
- [ ] T009 创建所有故事共享依赖的基础模型/实体
- [ ] T010 配置错误处理与日志基础设施
- [ ] T011 建立环境配置管理
- [ ] T012 定义本功能的设计校验方案（完成前必须核对哪些 `DESIGN.md` 与页面规范规则）

**检查点**: 基础能力就绪，可并行启动用户故事实现

---

## 阶段 3: 用户故事 1 - [Title] (Priority: P1) 🎯 MVP

**目标**: [简述该故事交付内容]

**独立测试**: [如何验证该故事可独立工作]

### 用户故事 1 的测试 (REQUIRED) ⚠️

> **NOTE: 先写测试，并在实现前确认测试失败**

- [ ] T013 [P] [US1] 在 tests/contract/test\_[name].py 为 [endpoint] 编写契约测试
- [ ] T014 [P] [US1] 在 tests/integration/test\_[name].py 为 [user journey] 编写集成测试

### 用户故事 1 的实现

- [ ] T015 [P] [US1] 在 src/models/[entity1].py 创建 [Entity1] 模型
- [ ] T016 [P] [US1] 在 src/models/[entity2].py 创建 [Entity2] 模型
- [ ] T017 [US1] 在 src/services/[service].py 实现 [Service]（依赖 T015、T016）
- [ ] T018 [US1] 在 src/[location]/[file].py 实现 [endpoint/feature]
- [ ] T019 [US1] 增加校验与错误处理
- [ ] T020 [US1] 增加用户故事 1 相关日志
- [ ] T021 [US1] 对照 `DESIGN.md` 与受影响页面规范进行实现校验

**检查点**: 此时用户故事 1 应可完整运行并可独立测试

---

## 阶段 4: 用户故事 2 - [Title] (Priority: P2)

**目标**: [简述该故事交付内容]

**独立测试**: [如何验证该故事可独立工作]

### 用户故事 2 的测试 (REQUIRED) ⚠️

- [ ] T022 [P] [US2] 在 tests/contract/test\_[name].py 为 [endpoint] 编写契约测试
- [ ] T023 [P] [US2] 在 tests/integration/test\_[name].py 为 [user journey] 编写集成测试

### 用户故事 2 的实现

- [ ] T024 [P] [US2] 在 src/models/[entity].py 创建 [Entity] 模型
- [ ] T025 [US2] 在 src/services/[service].py 实现 [Service]
- [ ] T026 [US2] 在 src/[location]/[file].py 实现 [endpoint/feature]
- [ ] T027 [US2] 与用户故事 1 组件集成（如有需要）
- [ ] T028 [US2] 对照 `DESIGN.md` 与受影响页面规范进行实现校验

**检查点**: 此时用户故事 1 与用户故事 2 均应可独立运行

---

## 阶段 5: 用户故事 3 - [Title] (Priority: P3)

**目标**: [简述该故事交付内容]

**独立测试**: [如何验证该故事可独立工作]

### 用户故事 3 的测试 (REQUIRED) ⚠️

- [ ] T029 [P] [US3] 在 tests/contract/test\_[name].py 为 [endpoint] 编写契约测试
- [ ] T030 [P] [US3] 在 tests/integration/test\_[name].py 为 [user journey] 编写集成测试

### 用户故事 3 的实现

- [ ] T031 [P] [US3] 在 src/models/[entity].py 创建 [Entity] 模型
- [ ] T032 [US3] 在 src/services/[service].py 实现 [Service]
- [ ] T033 [US3] 在 src/[location]/[file].py 实现 [endpoint/feature]
- [ ] T034 [US3] 对照 `DESIGN.md` 与受影响页面规范进行实现校验

**检查点**: 所有用户故事应具备独立可用能力

---

[按需继续扩展用户故事阶段，保持同样模式]

---

## 阶段 N: 收尾与横切关注点

**目的**: 处理影响多个用户故事的改进项

- [ ] TXXX [P] 更新 docs/ 下文档
- [ ] TXXX [P] 若页面行为或布局变更，更新 `docs/pages/*.md`
- [ ] TXXX 若功能引入跨页面新规则，更新 `DESIGN.md`
- [ ] TXXX 代码清理与重构
- [ ] TXXX 跨所有故事进行性能优化
- [ ] TXXX [P] 在 tests/ 增补 unit 与 integration/contract 覆盖
- [ ] TXXX 校验跨 Provider 的 UX/API 一致性与错误响应一致性
- [ ] TXXX 对照 `DESIGN.md` 与所有受影响页面规范进行设计保真校验
- [ ] TXXX 安全加固
- [ ] TXXX 运行 quickstart.md 验证

---

## 依赖与执行顺序

### 阶段依赖

- **Setup（阶段 1）**: 无依赖，可立即开始
- **Foundational（阶段 2）**: 依赖 Setup 完成，会阻塞全部用户故事
- **User Stories（阶段 3+）**: 均依赖 Foundational 完成
  - 具备资源时可并行推进
  - 或按优先级串行推进（P1 → P2 → P3）
- **Polish（最终阶段）**: 依赖所有目标用户故事完成

### 用户故事依赖

- **用户故事 1 (P1)**: Foundational（阶段 2）完成后可启动，不依赖其他故事
- **用户故事 2 (P2)**: Foundational（阶段 2）完成后可启动，可与 US1 集成但应可独立测试
- **用户故事 3 (P3)**: Foundational（阶段 2）完成后可启动，可与 US1/US2 集成但应可独立测试

### 每个用户故事内的顺序

- 测试 MUST 先写并在实现前失败
- 模型先于服务
- 服务先于接口
- 核心实现先于集成
- 当前优先级故事完成后再推进下一优先级

### 可并行机会

- Setup 中标记 [P] 的任务可并行
- Foundational 中标记 [P] 的任务可并行（限阶段 2 内）
- Foundational 完成后，用户故事可并行启动（视团队容量）
- 同一故事中标记 [P] 的测试可并行
- 同一故事中标记 [P] 的模型任务可并行
- 不同用户故事可由不同成员并行推进

---

## 并行示例：用户故事 1

```bash
# 一次性并行启动用户故事 1 的全部测试：
Task: "在 tests/contract/test_[name].py 为 [endpoint] 编写契约测试"
Task: "在 tests/integration/test_[name].py 为 [user journey] 编写集成测试"

# 一次性并行启动用户故事 1 的全部模型任务：
Task: "在 src/models/[entity1].py 创建 [Entity1] 模型"
Task: "在 src/models/[entity2].py 创建 [Entity2] 模型"
```

---

## 实施策略

### MVP 优先（仅用户故事 1）

1. 完成阶段 1：Setup
2. 完成阶段 2：Foundational（CRITICAL，会阻塞全部故事）
3. 完成阶段 3：用户故事 1
4. **STOP and VALIDATE**：独立验证用户故事 1
5. 条件满足则部署/演示

### 增量交付

1. 完成 Setup + Foundational → 基础就绪
2. 交付用户故事 1 → 独立测试 → 部署/演示（MVP）
3. 交付用户故事 2 → 独立测试 → 部署/演示
4. 交付用户故事 3 → 独立测试 → 部署/演示
5. 每个故事都应在不破坏已交付能力的前提下增量创造价值

### 团队并行策略

多开发者协作时：

1. 团队共同完成 Setup + Foundational
2. Foundational 完成后：

- 开发者 A：用户故事 1
- 开发者 B：用户故事 2
- 开发者 C：用户故事 3

3. 各故事独立完成并独立集成

---

## 备注

- [P] 任务表示不同文件且无依赖，可并行
- [Story] 标签用于将任务映射到具体用户故事，实现可追溯
- Task issue SHOULD 回指 `tasks.md` 任务 id（例如 `T012`）
- 每次 issue 同步 MUST 限定在单一 spec 目录内
- 每个用户故事应可独立完成并独立测试
- 实现前务必确认测试先失败
- 实现前后都应评审相关设计文档
- 每个任务或合理任务组完成后提交
- 在任意检查点可暂停并独立验证故事
- 避免：任务描述模糊、同文件冲突、破坏独立性的跨故事依赖
