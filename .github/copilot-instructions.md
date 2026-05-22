<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->`

## 语言规范

- 所有回复、文档撰写、git提交消息、PR 与 Issue 默认使用中文表达。

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
