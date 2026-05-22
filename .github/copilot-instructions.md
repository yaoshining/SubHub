<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->`

## 语言规范

- 所有回复、文档撰写、git提交消息、PR 与 Issue 默认使用中文表达。

## 前端实现约束：TailwindCSS + shadcn/ui

本项目前端界面默认优先使用 **TailwindCSS + shadcn/ui** 进行组件化实现。

**编码代理与 UI 代理必须遵守以下规则：**

- 实现基础界面元素（按钮、输入框、表单、弹层、表格、标签、卡片等）时，优先复用 `shadcn/ui` 现有组件与模式，不得随意自造基础组件。
- 允许通过 Tailwind token、`variant`、`slot`、组合方式等对组件进行适配，以符合项目设计语言（详见 `DESIGN.md` § 7.9）。
- 只有在现有 `shadcn/ui` 模式明显无法承载需求时，才允许新增自定义基础组件，且须在对应页面规范（`docs/pages/*.md`）中说明理由。
- 页面实现应保持组件可复用、可组合、可变体化，不追求一次性页面特化写法。
- 若设计稿或页面规范中存在可映射到 `shadcn/ui` 的结构，应优先按该组件体系落地，而不是重新发明等价实现。
- 若设计意图与 `shadcn/ui` 默认模式冲突，应先提出映射方案或 tradeoff，再由人工确认是否引入新组件。

## 设计稿文件约定

所有设计稿工件统一存放于 `design/` 目录：

- `design/main.pen`：**设计稿主文件**，包含深/浅主题 Dashboard 设计稿（Pencil 格式）
- 新增页面设计稿应命名为 `design/<page-name>.pen` 或放入 `design/main.pen` 内的对应 Frame

设计代理（UI 代理）在操作设计稿时，默认以 `design/main.pen` 为入口文件。

## ui-ux-pro-max 产物约定（SubHub）

- `ui-ux-pro-max` 安装于 `.github/prompts/ui-ux-pro-max/`。
- 当从 `.github` 目录运行时，其持久化产物通常写入 `.github/design-system/<project-name>/`，例如：
	- `.github/design-system/subhub/MASTER.md`
	- `.github/design-system/subhub/pages/*.md`
- 这些文件默认视为工具生成的中间设计系统工件，不默认等同长期真源。
- 本仓库长期设计真源仍为：`DESIGN.md` 与 `docs/pages/*.md`。
- 代理可以读取 `.github/design-system/subhub/MASTER.md` 与 `.github/design-system/subhub/pages/*.md` 作为输入参考，但应将可复用内容吸收进 `DESIGN.md` 与 `docs/pages/*.md`。
- 除非用户明确指定，否则不要把 `.github/design-system/subhub/` 作为第二套长期设计权威。
- 若 `.github/design-system/<project-name>/` 仅包含中间生成结果，应视为可选提交；优先提交已吸收后的 `DESIGN.md` 与 `docs/pages/*.md`。
- 引用 `ui-ux-pro-max` 结果时，需明确当前是在：
	- 读取中间生成工件；或
	- 更新最终项目设计文档。
- 若内容已吸收进入真源文档，不应反复要求用户回查 `.github/design-system/...`。
- 本约定仅适用于 `ui-ux-pro-max` 生成工件（如 `.github/design-system/subhub/`），不泛化到所有 `.github/design-system/*` 内容。
