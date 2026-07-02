---
description: "SubHub 新 feature 工作流启动与阶段判断。输入需求描述、issue 或页面想法，自动判断当前所处阶段、缺失产物与风险，输出最小正确下一步和推荐 agent/命令。"
name: SubHub Feature Kickoff
argument-hint: "新 feature 描述、issue 链接、页面名或需求说明"
agent: SubHub 流程协调器
tools: [read, search, todo]
---

你正在执行 SubHub 的 **feature kickoff 阶段判断**。

目标：分析用户提供的请求，判断当前处于哪个阶段、缺少哪些关键产物，输出**最小正确下一步**。不要讲完整流程，不要让用户自己决定先找哪个 agent。

---

## 步骤一：同步仓库上下文

**按以下顺序读取，跳过不存在的文件：**

1. `.specify/memory/constitution.md`（项目宪法）
2. `.github/copilot-instructions.md`（项目级约定）
3. `docs/workflows/spec-github-worktree.md`（开发工作流）
4. `DESIGN.md`（全局设计真源）
5. `docs/pages/*.md`（现有 page spec）
6. `.github/agents/*.agent.md`（可用代理一览）
7. 当前 active feature 的 `spec.md`、`plan.md`、`tasks.md`
8. 用户提供的需求描述、issue、截图、原型或页面上下文

---

## 步骤二：判断请求类型

识别当前用户请求最接近以下哪一类起点：

| 类型                | 说明                                              |
| ------------------- | ------------------------------------------------- |
| **纯想法 / 粗需求** | 没有明确边界，功能范围模糊                        |
| **产品范围不清**    | 有大致方向但用户场景、成功标准未定义              |
| **UX 流程不清**     | 功能已知但任务流、页面流、状态未建模              |
| **缺 page spec**    | 有原型或线框，但未转化为结构化 page spec          |
| **缺设计细化**      | 有 page spec，但 DESIGN.md 或设计稿不足以支撑实现 |
| **可进入 specify**  | 设计和 page spec 足够，可生成 feature spec        |
| **可进入 plan**     | 已有 spec.md，可进入技术方案设计                  |
| **可进入 tasks**    | 已有 plan.md，可进入任务拆分                      |
| **可进入实现**      | 已有 tasks.md，可分配前端/后端实现                |
| **需要 review**     | 已有实现，需要 UI 保真评审或代码评审              |

---

## 步骤三：检查关键产物状态

逐项检查以下产物是否存在且足够稳定：

- [ ] 原型 / 线框图
- [ ] `DESIGN.md`
- [ ] `docs/pages/<page>.md`（目标页面 page spec）
- [ ] `spec.md`
- [ ] `plan.md`
- [ ] `tasks.md`
- [ ] 设计稿（`.pen` 或等价参考）
- [ ] GitHub issue 对应关系
- [ ] 当前 feature branch / worktree 绑定

---

## 步骤四：判断 worktree 需求

检查以下情况并给出建议：

- 当前工作目录是否已绑定另一个 active feature
- 当前请求是否是一个新的并行 feature
- 是否建议新建 worktree、feature branch 和 spec 目录
- 如果建议新建，推荐运行 `speckit.git.feature` 先创建分支

---

## 步骤五：输出阶段判断与下一步

```
## 当前请求类型
（从步骤二的类型中选择）

## 当前所处阶段
（描述现在处于 kickoff 流程的哪个位置）

## 已有产物
- （列出已存在且足够稳定的产物）

## 缺失产物
- （列出缺失或不够稳定的产物）

## 当前风险
- （列出如果直接跳步会产生的具体风险）

## 是否需要新 worktree
是 / 否（说明原因）

## 推荐下一步
（最多给 1 个主推荐 + 1 个备选，不要列出完整流程）

## 推荐 agent 或命令
（从以下选项中选最合适的）

- `SubHub 产品经理` — 需求范围收敛与成功标准定义
- `SubHub 体验流程设计师` — UX 流程建模、任务流、状态覆盖
- `SubHub 界面设计管家` — page spec 维护、设计规则治理
- `/subhub.page-spec` — 生成或更新目标页面的 page spec
- `/subhub.design-draft` — 生成页面设计稿初稿或更新方案
- `speckit.specify` — 生成或更新 feature spec
- `speckit.plan` — 生成实现计划
- `speckit.tasks` — 生成任务清单
- `speckit.implement` — 按 tasks.md 执行实现
- `/subhub.review-ui` — 执行 UI 保真评审

## 如果现在不能继续，最关键缺口是什么
（最多列出 3 项，优先级由高到低）
```

---

## 何时停止并先补上下文

遇到以下情况，停止推进并说明原因：

- **需求太模糊**：无法判断页面目标、用户场景或功能边界
- **feature 边界不清**：当前请求可能涉及多个独立 feature，需先拆分
- **worktree 已绑定其他 active feature**：建议先切换或新建 worktree
- **关键设计文档完全缺失**：`DESIGN.md` 或 page spec 不存在，直接进入实现风险过高
- **试图并行推进多个新 feature**：一次只推进一个，先决定优先级

---

## 输出要求

- 默认中文
- 不直接生成完整设计稿或实现代码
- 重点是"阶段判断 + 缺口判断 + 最小正确下一步"
- 推荐下一步最多给 1 个主推 + 1 个备选
- 如果信息不足，只列出最关键的 1–3 个缺失项，不要泛泛要求"补全所有文档"
- 结论应直接可操作，避免官僚式完整性描述
