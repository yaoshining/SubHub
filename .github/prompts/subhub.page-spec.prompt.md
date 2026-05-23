---
description: "为 SubHub 指定页面生成或更新 page spec。输入页面名与上下文，自动完成参考收集、UX 初稿与 UI 收敛，输出可写入 docs/pages/<page>.md 的中文正文草案。"
name: SubHub Page Spec
argument-hint: "页面名（如 dashboard、providers、provider-detail、settings）以及上下文说明"
agent: SubHub 界面设计管家
tools: [read, search, todo]
---

你正在执行 SubHub 的 **page spec 生成 / 更新** 流程。

目标：根据提供的页面名与上下文，完成参考收集、UX 初稿和 UI 收敛，最终输出可直接写入 `docs/pages/<page>.md` 的中文 page spec 草案。

---

## 步骤一：同步上下文

**按以下顺序读取，跳过不存在的文件：**

1. `.specify/memory/constitution.md`（项目宪法）
2. `DESIGN.md`（全局设计真源）
3. `docs/pages/*.md`（现有 page spec，判断目标页面是否已有规范）
4. `docs/pages/page-spec-template.md`（page spec 格式模板）
5. 当前 feature 的 `spec.md`、`plan.md`、`tasks.md`
6. 用户提供的其他上下文（原型截图、线框图、issue 链接、设计稿等）

---

## 步骤二：读取 ui-ux-pro-max 参考（如果存在）

检查以下路径是否存在：
- `.github/design-system/subhub/MASTER.md`
- `.github/design-system/subhub/pages/<page>.md`

如果存在，将其作为**中间参考输入**读取，吸收其中有价值的内容：
- 页面级布局方向与视觉层次
- 组件选型建议
- 信息层级与主次操作提示

**必须注意：**
- 这些文件是工具生成的中间工件，**不是**项目最终真源
- 不允许将其原样作为 page spec 输出
- 吸收内容后，以 `DESIGN.md` 和 `docs/pages/*.md` 为权威收敛

---

## 步骤三：UX 初稿

基于上述输入，提炼以下内容：

- **页面目标**：这个页面要帮助用户完成什么
- **目标用户与使用场景**：谁、在什么情境下使用
- **任务流 / 页面流**：用户如何进入、操作、离开
- **关键状态**：默认、加载、空态、错误、无权限
- **信息层级**：哪些信息最重要，哪些是次要/辅助
- **主次操作**：主操作（primary）和次操作（secondary/危险）各是什么
- **失败恢复与异常路径**：操作失败时如何展示、如何恢复

---

## 步骤四：UI 收敛

将 UX 初稿整理为正式的 page spec 结构，补充：

- 与 `DESIGN.md` 的规则映射（引用具体章节或规则名）
- 页面特有交互规则（不属于 `DESIGN.md` 的局部约定）
- 需要上移到 `DESIGN.md` 的内容（若发现跨多页面可复用的规则，标注建议上移）
- 适合 TailwindCSS + shadcn/ui 实现的组件结构建议（只写设计意图，不写代码）

---

## 步骤五：输出

### 如果目标页面 **尚无** `docs/pages/<page>.md`：

输出完整 page spec 草案，结构如下：

```
# <页面名> Page Spec

## 页面概述
## 输入来源说明
## 页面目标
## 目标用户与使用场景
## 模块 / 区块
## 关键状态
## 信息层级
## 主次操作
## 页面特有交互规则
## 与 DESIGN.md 的映射
## 来自 ui-ux-pro-max 的参考吸收点（如有）
## 建议写入 docs/pages/<page>.md 的正文草案
```

### 如果目标页面 **已有** `docs/pages/<page>.md`：

不输出完整文档，只输出增量：
- **建议新增内容**（带说明）
- **建议修改内容**（带原文对比）
- **建议删除或合并内容**（带理由）

### 如果信息不足：

不要硬写完整 page spec。只列出：
- 目前已知的内容（可以作为基础的部分）
- 最关键的缺失项（需要补充的具体信息）
- 建议下一步（补原型、补 spec、澄清业务职责）

---

## 何时停止并先补上下文

遇到以下情况，停止生成并说明原因：

- **缺少页面职责**：不清楚这个页面要帮助用户做什么，spec 和上下文都没有说明
- **既无原型也无 spec**：没有任何页面相关的已知信息可以作为起点
- **请求实际上是系统级规则**：用户描述的内容应该写入 `DESIGN.md` 而非单个 page spec
- **需求冲突或范围过大**：输入涉及多个页面，或与现有 `DESIGN.md` 规则冲突
- **子场景误当独立页面**：弹层、drawer、modal、表单等场景应归属于所属页面，不单独创建 page spec，除非用户明确要求

---

## 输出要求

- 默认中文
- 不直接写实现代码
- 不生成 Figma / Pencil 设计稿
- 弹层、drawer、modal、表单等视为当前页面的子场景，不创建独立 page spec
- 输出结构稳定，便于长期复用和版本追踪
