<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

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

## 图标系统约定（Lucide）

- 本项目默认图标系统为 **Lucide**。
- 设计稿、页面规范、前端实现、代码评审默认优先使用 Lucide 图标；非必要不得混用风格差异明显的图标集。
- 设计稿中的图标默认通过 Pencil `icon_font` 能力使用 Lucide，`iconFontFamily` 默认使用 `lucide`。
- 图标资产统一维护在 `design/main.pen` 的 `Assets / Icons / Lucide` 区域；需复用时优先做成可复用组件（reusable icon assets）。
- 设计稿图标命名应尽量与 Lucide 原始图标名一致，例如：`menu`、`panel-left`、`settings`、`users`、`shield`、`key-round`。
- UI / UX 相关 agent 在补充图标时，应优先按场景选择语义清晰、风格克制的 Lucide 图标；若设计稿缺失，可补入 `Assets / Icons / Lucide`，并优先复用同名或等价资产，避免重复创建。
- 前端实现默认使用 `lucide-react`；若设计稿或页面规范已指定 Lucide 图标名，应优先使用同名 `lucide-react` 组件。
- 未经用户明确要求，不应将 Lucide 图标随意替换为其他图标库近似图标；若设计稿与代码命名不一致，应先指出并收敛命名，不得静默偏离。
- 涉及图标实现的代码评审应检查：是否使用约定 Lucide 命名、是否与设计稿和页面规范语义一致、是否无必要混入其他图标库、是否出现同一语义在不同页面使用不同图标。
- 仅当 Lucide 明显无法覆盖需求时，才允许引入额外图标源；如需引入，必须在对应 page spec、设计文档或实现说明中明确原因。
- 未经说明，不应自行扩展为多图标系统并行维护。

### 常用语义到 Lucide 图标名映射（默认）

| 语义 | 默认 Lucide 名称 |
|------|------------------|
| 菜单/主导航入口 | `menu` |
| 侧边栏/面板切换 | `panel-left` |
| 系统设置 | `settings` |
| 用户/成员管理 | `users` |
| 安全/权限 | `shield` |
| 凭据/API Key | `key-round` |

- 上述映射为默认优先映射；若页面场景确需不同图标，必须保持语义更清晰且在页面规范或实现说明中记录原因。
- 同一语义在同一产品域内应保持图标名一致，避免跨页面漂移命名。
- 设计稿、页面规范、前端代码与评审结论引用图标时，默认以上述名称作为优先对齐基线。

## Lucide 图标资产同步约定

- 以下为仓库级图标资产同步规则，适用于设计、实现与评审全流程。
- 项目默认图标系统为 Lucide；设计稿中默认通过 Pencil 的 `icon_font` 使用，`iconFontFamily` 使用 `lucide`。
- `design/main.pen` 的 `Assets / Icons / Lucide` 为项目级图标资产区，维护已采纳且可复用的 Lucide 图标集合。
- 正式设计流程首次引入且存在复用可能的新图标，应同步到该资产区；页面用图标应优先复用该资产区，避免重复创建。
- 仅用于短暂探索草稿可临时使用；进入正式设计稿、page spec 对齐或多页面复用阶段后，必须回写到资产区。
- 资产命名尽量与 Lucide 原始图标名一致，前端实现与代码评审默认以资产区名称作为 `lucide-react` 映射与对齐基线。

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

## API 契约链路约定（OpenAPI / Orval / Scalar）

- OpenAPI 真源文件固定为：`docs/api/openapi.yaml`。凡涉及 API 契约定义、变更、评审、对齐，默认以该路径为正式约定。
- Orval 配置文件固定为：`orval.config.ts`。
- 前端生成 client/types 输出目录固定为：`src/lib/api/generated/`。
- API 手写封装层目录固定为：`src/lib/api/`。生成代码与手写适配逻辑必须分开维护，不得混写。
- API 文档展示默认入口为：`/docs/api`（Scalar）。凡涉及 API 文档展示与联调，默认按该路由检查。
- 约定脚本标准命名为：`api:spec`、`api:client`、`api:docs`，可选校验脚本为：`api:check`。
- 当实现、评审或集成涉及接口变化时，必须提醒检查：`docs/api/openapi.yaml`、`orval.config.ts`、`src/lib/api/generated/`、`api:spec`、`api:client`、`api:docs`。
- 即使仓库暂未落地上述脚本，也应将其视为预期标准命名，不得自行发明替代命名。
- 未经用户明确要求，不得自行创建另一套 OpenAPI 路径、Orval 路径或 API 脚本命名。
