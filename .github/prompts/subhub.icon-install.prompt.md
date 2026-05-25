---
description: "为 SubHub 安装并应用 Lucide 图标资产。输入一个或多个图标名及可选场景，自动检查复用、补充资产并给出页面应用与前端同名组件建议。"
name: SubHub Icon Install
argument-hint: "icons=<图标列表> 可选 page=<页面> scene=<场景> file=<.pen路径>，例如：icons=users,shield page=access-control scene=row-actions"
agent: SubHub 界面设计管家
---

你正在执行 SubHub 的 **Lucide 图标资产安装与应用** 流程。

命令：`/subhub.icon-install`

目标：当用户提供一个或多个 Lucide 图标名，以及可选页面/区块/场景时，自动完成图标资产检查、复用、补充与应用建议，确保“安装 + 资产沉淀 + 场景应用”闭环，并与前端实现命名一致。

---

## 步骤一：同步上下文

按以下顺序读取并对齐（不存在则跳过）：

1. `.github/copilot-instructions.md`
2. `DESIGN.md`
3. 相关 `docs/pages/*.md`（优先与用户场景相关页面）
4. 当前设计稿上下文，默认目标：`design/main.pen`

---

## 步骤二：检查图标系统约定

执行前先确认以下约束（细节以 `.github/copilot-instructions.md` 为准）：

- 默认图标系统：Lucide
- 设计稿图标资产位置：`design/main.pen` 的 `Assets / Icons / Lucide`
- 设计稿图标默认通过 Pencil `icon_font` 使用，`iconFontFamily = "lucide"`
- 前端实现默认使用 `lucide-react`
- 图标命名尽量与 Lucide 原始图标名一致

---

## 步骤三：解析输入并校验图标名

支持输入风格示例：

- `/subhub.icon-install menu panel-left settings`
- `/subhub.icon-install users shield key-round for access-control`
- `/subhub.icon-install menu, x, search 用于 mobile nav`
- `/subhub.icon-install plus, pencil, trash-2 用于 providers 表格行操作`

推荐键值输入（稳定模式）：

- `/subhub.icon-install icons=menu,panel-left,settings page=dashboard scene=sidebar`
- `/subhub.icon-install icons=users,shield,key-round page=access-control scene=table-actions`
- `/subhub.icon-install icons=menu,x,search page=mobile-nav`
- `/subhub.icon-install icons=plus,pencil,trash-2 page=providers scene=row-actions`

批量别名输入（可选）：

- `/subhub.icon-install icons=@common-actions page=providers scene=row-actions`
- `/subhub.icon-install icons=@nav-basic,@security-access page=access-control`

键值参数说明：

- `icons`：必填。图标名列表，支持逗号分隔。
- `page`：可选。页面名或页面标识。
- `scene`：可选。区块/场景名（如 `sidebar`、`table-actions`、`mobile-nav`）。
- `file`：可选。目标设计稿路径；默认 `design/main.pen`。

内置别名（可扩展）：

- `@common-actions` -> `plus,pencil,trash-2`
- `@nav-basic` -> `menu,panel-left,search`
- `@security-access` -> `users,shield,key-round`

处理规则：

- 先解析键值参数；若无键值参数，则回退到自由文本解析。
- 若 `icons` 中包含 `@别名`，先展开为实际 Lucide 图标名，再做去重与合法性校验。
- 提取图标名列表（去重、保序）
- 提取可选场景描述（如 dashboard sidebar、users row actions、mobile nav）
- 若提供 `file`，优先使用该路径作为设计稿目标，否则使用默认 `design/main.pen`
- 若图标名不是合法或常见 Lucide 名称：
  - 先指出问题
  - 提供最接近候选名称
  - 待确认后再安装

  输出补充：

  - 若使用了别名，需在输出中增加“别名展开结果”，明确本次实际处理的图标名列表。

---

## 步骤四：资产检查与补充

针对每个图标名，检查 `design/main.pen`：

1. 是否存在 `Assets / Icons / Lucide`
2. 是否已存在同名或等价图标资产

执行策略：

- 默认先检查资产区并执行资产沉淀：除非用户明确说明“仅临时用于当前草稿”，否则不要只在页面临时插入而不沉淀资产。
- 硬阈值规则：同一请求中同一图标在目标页面/场景出现 2 次及以上时，必须判定为需要资产沉淀，不按临时草稿处理。
- 已存在：优先复用，不重复创建，并优先对齐资产区命名与语义。
- 不存在：先补入新的 Lucide 图标资产，再进入页面应用阶段。

新增资产要求：

- 名称使用 Lucide 原始图标名
- 放置在 `Assets / Icons / Lucide`
- 作为可复用组件（reusable icon assets）
- 便于后续页面实例化复用

---

## 步骤五：页面应用

默认流程顺序：

1. 检查资产区
2. 新图标同步到 `Assets / Icons / Lucide`（如需要）
3. 再应用到对应页面/场景

除非用户明确要求临时草稿行为，不应跳过资产区直接在页面创建孤立图标实例。

若用户提供了页面、区块或场景：

- 说明图标应应用到哪些具体位置
- 说明对应页面语义
- 给出前端实现应优先使用的同名或等价 `lucide-react` 组件，不得静默替换近似图标

若上下文足够明确：

- 可直接在设计稿对应场景放入图标实例

若上下文不足：

- 先完成资产安装
- 输出建议应用位置，不强行落位

临时草稿例外：

- 若用户明确说明仅一次性探索、临时草稿或无需复用，可允许不沉淀到资产区；输出中必须标记为“未同步资产区的临时图标使用”。

---

## 步骤六：何时停止并先补上下文

出现以下情况时，先停止并输出阻塞项：

- 图标名明显不合法且无法推断接近候选
- 用户要求应用到某页面，但缺少足够页面上下文
- 用户要求引入 Lucide 之外图标系统但未说明原因
- 请求范围过大（如“全站图标全部定完”），应建议先从单页面或单场景开始

---

## 输出要求

默认中文，且必须明确分为以下四部分：

1. 已存在并复用的图标
2. 新同步到资产区的图标
3. 已应用或建议应用的页面/场景
4. 前端实现应使用的同名 `lucide-react` 组件

若存在临时草稿例外：

- 追加“未同步资产区的临时图标使用”小节，明确哪些图标未沉淀及原因。

额外约束：

- 不引入其他图标库，除非用户明确要求
- 若存在命名或语义偏差风险，必须显式提示
- 若设计稿、page spec 或资产区已给出明确 Lucide 图标名，默认按“设计稿图标名 = 实现图标名”优先执行
- 保持简洁、稳定、高执行性，不写成图标设计教程
