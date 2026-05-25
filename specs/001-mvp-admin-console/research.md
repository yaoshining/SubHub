# MVP 管理控制台与统一字幕出口 - 研究结论

## Decision: 采用 Next.js 全栈单体作为 MVP 落地路径

**Rationale**: 用户明确要求前端基于 Next.js + TypeScript；当前仓库尚无应用源码，使用 Next.js App Router/Route Handlers 可在同一仓库中同时承载后台页面、管理 API、对外字幕 API 和 Scalar 文档入口，最适合自托管 MVP 小步交付。

**Alternatives considered**:
- 前后端拆分仓库：增加部署和契约同步成本，不符合当前早期 MVP。
- 独立后端服务 + SPA：对当前仓库而言初始化成本更高，且不利于快速形成 `/docs/api`、后台页和 API 同步闭环。

## Decision: `docs/layouts/admin-layout.md` 作为共享布局正式实现基线

**Rationale**: spec 与 DESIGN 均明确该文件负责后台 Shell、页面骨架和响应式规则。实现阶段应把 Sidebar、Topbar/Page Header、Main Content、Secondary Panel、列表/详情/设置骨架与 Desktop/Tablet/Mobile 行为做成共享组件与测试对象。

**Alternatives considered**:
- 每页单独实现布局：会造成导航、断点、Header 和操作区漂移。
- 仅按设计稿逐页还原：无法保证跨页面规则可维护。

## Decision: API 契约链路必须作为首批任务落地

**Rationale**: 当前 feature 涉及管理端 API、外部字幕查询/下载 API、错误结构和响应字段；仓库已约定 OpenAPI 真源为 `docs/api/openapi.yaml`，Orval 配置为 `orval.config.ts`，生成目录为 `src/lib/api/generated/`，文档入口为 `/docs/api`。契约先行可让前后端并行，并避免手写类型漂移。

**Alternatives considered**:
- 先实现 API 再补 OpenAPI：会造成前端类型与文档不可信。
- 只在 `specs/.../contracts/` 写 OpenAPI：会违反仓库固定真源路径；因此本 feature 的 contracts 只作为规划契约，正式机器契约必须写入 `docs/api/openapi.yaml`。

## Decision: 首发 Provider 仅实现 OpenSubtitles adapter，但核心调度保持 Provider-agnostic

**Rationale**: spec 假设首个版本只要求 OpenSubtitles，同时 README 和宪章强调 Provider 可替换。实现应把 OpenSubtitles 认证、限流、错误语义隔离在 adapter 内，核心服务只依赖统一 Provider 接口和凭据池状态。

**Alternatives considered**:
- 写死 OpenSubtitles 到查询/下载流程：短期更快，但会让后续 Provider 扩展和失败切换困难。
- 本期实现多 Provider 通用接入 UI：超出 MVP 范围，也与 Providers 页的“OpenSubtitles 模板化创建”约束冲突。

## Decision: 持久化必须在实现前固定，推荐优先评估 SQLite + 迁移工具

**Rationale**: feature 需要持久化管理员、会话、Provider、Provider 凭据、调用方 Key、轮换历史和动作结果。SubHub 定位自托管早期 MVP，SQLite 类轻量方案适合单实例部署和本地开发；迁移工具可保证后续演进可控。

**Alternatives considered**:
- 内存存储：无法满足管理员、Key、Provider 配置的可运营交付。
- 直接要求外部 PostgreSQL：更适合后续规模化部署，但提高首版自托管门槛。
- JSON 文件存储：迁移、并发、测试隔离和敏感信息处理成本较高。

## Decision: 响应式行为作为交付任务，而非 UI polish

**Rationale**: `spec.md NFR-008`、`docs/layouts/admin-layout.md §6` 和多个 page spec 都将 Tablet/Mobile 特例列为 MUST。Provider Detail、API Keys、Users 已有页面级响应式规则；实现、测试与 UI review 必须覆盖。

**Alternatives considered**:
- 仅实现 Desktop 后补移动端：会导致布局组件、信息顺序和高风险动作位置返工。
- 依赖 Tailwind 默认折行：无法保证 page spec 中的业务顺序、详情下沉和操作可达性。

## Decision: Lucide 图标命名作为设计、实现和评审的共同契约

**Rationale**: 仓库约定 Lucide 为唯一默认图标系统；page spec 和 admin-layout 已声明 `cloud-off`、`key-round`、`users` 等具体名称。实现应使用同名 `lucide-react` 组件，并在设计稿资产区补齐正式复用图标。

**Alternatives considered**:
- 混用其他图标库：会破坏控制台一致性。
- 实现层自行找近似图标：会造成设计稿、page spec 与代码命名漂移。

## Decision: Review 是交付流程，不是可选后置动作

**Rationale**: 宪章要求每个 PR 包含合规检查，spec 要求 UI review 与 code review 正式覆盖。当前 feature 牵涉页面保真、响应式、图标、API 契约、后端状态流转和测试策略，必须在 tasks 中拆出评审与修复闭环。

**Alternatives considered**:
- 只依赖自动测试：无法捕获设计偏离、响应式语义错位和图标系统漂移。
- 只做人工浏览：无法验证 API 契约、错误结构和状态流转。
