<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/002-migrate-neon-vercel/plan.md`
<!-- SPECKIT END -->

## 语言规范

- 所有回复、文档撰写、git提交消息、PR 与 Issue 默认使用中文表达。

## 包管理器与脚本执行约定

- 以下为仓库级执行约定，适用于实现类 agent、review agent、Speckit 流程与后续文档示例。
- 本仓库默认且首选包管理器为 `pnpm`。
- 安装依赖、运行开发服务、执行测试、运行 lint/typecheck、执行 codegen、运行 migration、运行 API 契约脚本时，默认都应优先使用 `pnpm`。
- 未经用户明确要求，不要输出 `npm` 命令示例。
- 若文档、prompt、agent 输出或任务说明中存在 `npm` 示例，后续更新时应优先改写为 `pnpm` 对应写法。
- 若某个执行环境暂时缺少全局 `pnpm`，应通过安装/启用 `pnpm` 解决，不得把 `corepack pnpm` 这类环境级 workaround 写入 `package.json`、测试断言、任务文档或其他仓库真源。
- 若项目脚本已在 `package.json` 中定义，则默认使用：
	- `pnpm install`
	- `pnpm dev`
	- `pnpm build`
	- `pnpm format`
	- `pnpm format:write`
	- `pnpm lint`
	- `pnpm typecheck`
	- `pnpm test`
	- `pnpm api:spec`
	- `pnpm api:client`
	- `pnpm api:docs`
	- `pnpm api:check`
	- `pnpm db:generate`
	- `pnpm db:migrate`
	- `pnpm db:check`
- 除非仓库中存在明确例外或用户明确要求，否则不要自行切换到 `npm`、`yarn` 或其他包管理器。
- `corepack` 可作为某次临时执行环境中的启用手段，但不是本仓库脚本、文档或命令示例的默认写法。

## 代码格式约定（Prettier）

- 当任务修改了仓库文件并准备提交、交付或结束实现时，默认应先执行 `pnpm format:write`，主动将受 Prettier 管理的文件收敛到仓库格式基线。
- 未经用户明确要求，不要把“等 CI 里的 `pnpm format` 报错后再修”作为默认工作流。
- 若本次改动未触及 `format:write` 覆盖范围之外的文件，默认应在本地完成格式化，再进入后续 lint、test、commit 或 PR 阶段。
- 若格式化会改动与当前任务无关、且由用户正在处理的文件，应在输出中明确说明，而不是静默扩大改动范围。

## 数据库测试分层约定（PGlite / Postgres / Neon）

- 本仓库数据库测试默认应保持分层意识：`mock / no-db` 用于纯逻辑快速单测，`PGlite` 用于快速数据库单测层，`real Postgres` 用于正式数据库测试层，`Neon staging / deploy verification` 用于环境与发布验证层。
- `PGlite` 的定位是“快速数据库单测层”，适用于少量 repository 基础行为测试与少量 service 层数据库逻辑测试；它比 mock 更真实，但不替代真实 Postgres / Neon 验证链路。
- 未经用户明确要求，不应把 `PGlite` 视为正式运行时数据库，也不应将其作为正式 migration 验证主路径、SQLite -> Postgres cutover 验证底座、staging / production 行为替代验证或发布门禁替代验证。
- 当任务涉及 schema migration、DDL 验证、SQLite -> Postgres 数据搬迁、cutover 校验、环境映射、部署验证、发布门禁、staging / production 行为验证时，应优先保留并使用真实 Postgres 测试数据库（本地或 CI）或 Neon staging / deploy verification。
- 不要因为 `PGlite` 接入方便或试点成功，就顺手删除、弱化或绕过真实 Postgres test database、CI Postgres service 或 Neon staging 验证步骤。
- 当输出实现方案、测试建议、评审结论或任务说明时，如涉及数据库测试，应尽量明确：当前测试属于哪一层、为什么选择 `PGlite` 或真实 Postgres，以及哪些验证仍需留在正式数据库或 Neon 环境中。

## 版本约定

- 仓库版本约定主真源为 `docs/releases/versioning.md`。
- 当前已收口的 MVP 版本为 `v0.1.0`；数据库与部署生产化目标版本为 `v0.2.0`；正式稳定首发目标版本为 `v1.0.0`。
- 涉及 feature、issue、milestone、spec 或 release 说明时，如已明确版本目标，应优先沿用该文档中的版本定义，不要临时发明并行版本说法。

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

## GitHub issue / PR / milestone 执行规则（适用于 Speckit taskstoissues）

- 以下为仓库级执行规则，适用于手动创建 issue、agent 创建 issue、`speckit.taskstoissues` 以及未来任何将任务同步到 GitHub issue 的流程。

### 1. 适用范围

- 本仓库 issue / PR 默认遵守既有 `type:*`、`area:*`、`stage:*`、`priority:*`、`scope:*` 标签体系与 `MVP`、`Post-MVP`、`Future` milestone 约定。
- 未经用户明确要求，不应绕过本仓库 labels / milestones 约定，自行发明另一套分类方式。

### 2. issue 最小标签要求

- 正式 issue 默认至少具备：1 个 `type:*`、1 个 `area:*`、1 个 `priority:*`、1 个 `scope:*`。
- 如 issue 已进入执行流程，还应补充 1 个 `stage:*`。
- 若当前上下文不足以可靠判断全部标签，至少先补 `type:*` 与 `scope:*`，并在说明中明确其余标签待补。

### 3. milestone 规则

- 当前仓库 milestone 包括：`MVP`、`Post-MVP`、`Future`。
- `scope:mvp` 的 issue 默认优先挂到 `MVP`。
- `scope:post-mvp` 的 issue 默认优先挂到 `Post-MVP`。
- `scope:future` 的 issue 默认优先挂到 `Future`，或在仅做积压管理时只保留 `scope:future`。
- `scope:stretch` 的 issue 可根据上下文决定是否挂 milestone，但不应默认挤入 `MVP`。

### 4. taskstoissues 额外规则

- 当 `speckit.taskstoissues` 或类似流程根据 `tasks.md` 创建 issue 时，应默认遵守本仓库标签与 milestone 规则。
- issue 标题与任务边界应尽量清晰，并尽量映射到单一任务或单一可执行单元。
- 默认使用本仓库标签体系，而不是 GitHub 默认标签的随意组合。
- 若当前 feature 已明确属于 MVP 或 Post-MVP，应自动继承相应 `scope:*` 与 milestone 倾向。
- 若任务属于未来工作，应明确标记为 `scope:future`，不要混入当前 MVP 任务批次。

### 5. PR 规则

- PR 应尽量继承对应 issue 的核心标签，至少反映主要 `type:*` 与 `area:*`。
- 若 PR 关联 MVP 范围 issue，不应在没有说明的情况下混入明显属于 `scope:future` 的改动。

### 6. 保持上游可升级性

- 不要将上述规则重度写死到 Speckit 原生 agent 文件中。
- 应优先通过本仓库全局 instructions 约束 `speckit.taskstoissues` 等流程。
- 如果未来需要更强控制，应优先增加本仓库的包装命令或协调层，而不是直接深改上游 Speckit agent 本体。
