# 任务清单: MVP 管理控制台与统一字幕出口

**输入**: 来自 `specs/001-mvp-admin-console/` 的设计文档

**前置条件**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/api-contract.md`、`quickstart.md`、`DESIGN.md`、`docs/layouts/admin-layout.md`、`docs/pages/*.md`、`design/main.pen`

**可追溯前置条件**: Feature ID `001`，spec 目录 `specs/001-mvp-admin-console/`，分支 `feat/001-mvp-admin-console`，主 Issue 仍为 `TBD`；同步 task issue 前必须补齐主 Issue 关联。

**测试**: REQUIRED。任务必须覆盖 unit、integration、contract、UI 状态、响应式、OpenAPI/Orval/Scalar 链路。

**组织方式**: 任务按用户故事分组，以支持每个故事独立实现、独立测试与独立评审。

## 格式: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行，前提是不同文件且无依赖
- **[Story]**: 用户故事阶段任务使用 `[US1]`、`[US2]`、`[US3]`、`[US4]`、`[US5]`
- **路径**: 每个任务描述都包含明确文件路径

## Extension Hooks

**Optional Pre-Hook**: git
Command: `/speckit.git.commit`
Description: Auto-commit before task generation

Prompt: Commit outstanding changes before task generation?
To execute: `/speckit.git.commit`

---

## 阶段 1: 初始化（共享基础设施）

**目的**: 建立 Next.js + TypeScript + TailwindCSS + shadcn/ui + lucide-react 的最小工程骨架，并固定仓库级质量门禁。

- [ ] T001 在 `package.json` 固定 Next.js、React、TypeScript、TailwindCSS、shadcn/ui 相关依赖与测试工具版本
- [ ] T002 在 `package.json` 添加 `dev`、`build`、`format`、`lint`、`typecheck`、`test`、`api:spec`、`api:client`、`api:docs`、`api:check` 脚本
- [ ] T003 在 `tsconfig.json` 配置 Next.js TypeScript 严格模式、路径别名和生成代码引用边界
- [ ] T004 在 `next.config.ts` 创建 Next.js 应用配置并启用当前 MVP 所需的 App Router 基线
- [ ] T005 在 `tailwind.config.ts` 配置 TailwindCSS 内容扫描、语义 token、响应式断点和 shadcn/ui token 映射
- [ ] T006 在 `postcss.config.mjs` 配置 TailwindCSS 与 PostCSS 构建链路
- [ ] T007 在 `components.json` 初始化 shadcn/ui 配置并绑定 `src/components/ui/` 输出目录
- [ ] T008 在 `src/app/globals.css` 定义 `DESIGN.md` 对应的深色默认主题、浅色主题、状态色和基础可访问性 token
- [ ] T009 在 `src/app/layout.tsx` 创建应用根布局、主题类挂载点和全局字体结构
- [ ] T010 在 `src/lib/env.ts` 创建环境变量读取与校验入口，覆盖 OpenSubtitles、存储、应用 URL 和安全密钥配置
- [ ] T011 在 `src/lib/errors.ts` 创建统一错误类型，覆盖 `AUTHENTICATION_REQUIRED`、`FORBIDDEN`、`VALIDATION_FAILED`、`SERVICE_NOT_READY`、`CALLER_KEY_INVALID`、`CALLER_KEY_SUSPENDED`、`PROVIDER_UNAVAILABLE`、`PROVIDER_CREDENTIAL_EXHAUSTED`、`NO_RESULTS`、`SUBTITLE_NOT_FOUND`、`UPSTREAM_FAILED`
- [ ] T012 [P] 在 `src/components/ui/` 安装并导出 Button、Input、Select、Table、Card、Badge、Tabs、Alert、Dialog、Drawer、AlertDialog、Switch、Accordion、Textarea、Separator、Avatar、Sonner 组件
- [ ] T013 [P] 在 `src/components/icons/lucide.tsx` 建立 Lucide 图标集中导出，覆盖 `menu`、`panel-left`、`settings`、`users`、`shield`、`key-round`、`layout-dashboard`、`server`、`cloud-off`、`moon`、`sun`
- [ ] T014 [P] 在 `docs/api/openapi.yaml` 创建 OpenAPI 真源文件骨架，包含通用错误结构与认证方式占位
- [ ] T015 [P] 在 `orval.config.ts` 创建 Orval 配置，输出到 `src/lib/api/generated/`
- [ ] T016 [P] 在 `src/lib/api/index.ts` 创建手写 API 封装层入口，禁止直接修改 `src/lib/api/generated/`
- [ ] T017 [P] 在 `src/app/docs/api/page.tsx` 创建 Scalar API 文档展示入口骨架
- [ ] T018 [P] 在 `tests/setup.ts` 创建测试环境初始化入口，覆盖 DOM、fetch、环境变量和数据库测试隔离基础
- [ ] T019 [P] 在 `tests/helpers/api.ts` 创建 API 测试请求与错误断言辅助函数
- [ ] T020 [P] 在 `tests/helpers/ui.tsx` 创建前端页面渲染、路由、主题和断点测试辅助函数

**检查点**: 工程骨架、基础组件、脚本、OpenAPI/Orval/Scalar 入口和测试工具链已可被后续任务复用。

---

## 阶段 2: 基础能力（阻塞性前置）

**目的**: 建立所有用户故事共享的数据层、认证、安全边界、API 契约链路、共享 Admin Shell、响应式布局和图标基线。

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事实现。

- [ ] T021 在 `src/server/storage/schema.ts` 定义 AdminUser、AdminInvitation、AdminSession、Provider、ProviderCredential、CallerKey、CallerKeyRotation、SubtitleSearchRequest、SubtitleDownloadRequest、AdminActionResult 的数据库 schema
- [ ] T022 在 `src/server/storage/migrations/001_mvp_admin_console.ts` 创建初始迁移，覆盖所有 `data-model.md` 实体与必要索引
- [ ] T023 在 `src/server/storage/client.ts` 创建 SQLite 或等价轻量数据库连接、事务封装和测试数据库切换能力
- [ ] T024 [P] 在 `src/server/audit/action-results.ts` 实现 AdminActionResult 写入服务，覆盖 Provider、Credential、CallerKey、AdminInvitation、AdminUser、AdminSession、Login、Bootstrap 动作类型
- [ ] T025 [P] 在 `src/lib/auth/password.ts` 实现密码哈希、密码校验和强度校验函数
- [ ] T026 [P] 在 `src/lib/auth/session.ts` 实现后台会话创建、读取、撤销、过期判断和 `risk` 会话拒绝高风险动作逻辑
- [ ] T027 在 `src/middleware.ts` 实现受保护后台路由与管理端 API 的认证拦截，未认证访问跳转 `/login`
- [ ] T028 在 `src/server/api/response.ts` 实现统一成功响应、错误响应和字段校验错误映射
- [ ] T029 在 `src/server/api/admin-auth.ts` 实现管理端 API 会话校验工具，供所有 `/api/admin/*` Route Handlers 复用
- [ ] T030 在 `src/server/api/caller-key-auth.ts` 实现对外字幕 API 的 Caller Key 认证工具
- [ ] T031 在 `docs/api/openapi.yaml` 写入通用错误 schema、管理端会话认证、Caller Key Bearer 认证和基础 tag 分组
- [ ] T032 在 `src/lib/api/client.ts` 创建手写 API fetcher，统一处理生成 client 的 baseURL、认证错误和错误结构
- [ ] T033 [P] 在 `src/components/admin/admin-shell.tsx` 实现 Admin Shell 布局，包含 Sidebar、Topbar/Page Header、Main Content 和可选 Secondary Panel slot
- [ ] T034 [P] 在 `src/components/admin/sidebar.tsx` 实现中文导航、Logo 区、`layout-dashboard`、`server`、`key-round`、`users`、`settings` 图标和主题切换入口
- [ ] T035 [P] 在 `src/components/admin/responsive-drawer.tsx` 实现 Tablet/Mobile Sidebar Drawer，覆盖遮罩、Esc 关闭、导航后自动关闭和 `menu` 图标按钮
- [ ] T036 [P] 在 `src/components/admin/page-header.tsx` 实现页面标题、摘要、主操作和移动端单列收敛结构
- [ ] T037 [P] 在 `src/components/admin/empty-state-card.tsx` 实现共享空状态卡片，支持 `cloud-off`、`key-round`、`users` Lucide 图标
- [ ] T038 [P] 在 `src/components/admin/status-badge.tsx` 实现 success、warning、destructive、secondary 状态 Badge 映射
- [ ] T039 [P] 在 `src/components/admin/protected-layout.tsx` 实现后台页共享受保护布局和当前用户上下文注入
- [ ] T040 在 `src/app/(admin)/layout.tsx` 接入 Admin Shell、Sidebar、Topbar、响应式 Drawer 和主题持久化
- [ ] T041 在 `tests/unit/storage/schema.test.ts` 测试 schema 迁移、唯一约束、邀请状态约束和会话状态约束
- [ ] T042 [P] 在 `tests/unit/auth/session.test.ts` 测试 active、revoked、expired、risk 会话的访问控制
- [ ] T043 [P] 在 `tests/unit/api/errors.test.ts` 测试统一错误结构和错误码映射
- [ ] T044 [P] 在 `tests/ui/admin-shell-responsive.test.tsx` 测试 Sidebar、Drawer、Page Header 在 Desktop、Tablet、Mobile 下的骨架行为
- [ ] T045 [P] 在 `tests/ui/lucide-icons.test.tsx` 测试导航、空状态和主题切换使用约定 Lucide 图标名称
- [ ] T046 在 `docs/api/openapi.yaml`、`orval.config.ts`、`src/lib/api/generated/`、`src/lib/api/` 验证 API 契约链路可以通过 `npm run api:check`

**检查点**: 数据、认证、错误、共享布局、响应式、图标和 API 契约基础就绪，可并行启动用户故事。

---

## 阶段 3: 用户故事 1 - 首次开通控制台 (Priority: P1) 🎯 MVP

**目标**: 维护者可以创建首个管理员、登录后台、访问 Dashboard，并被保护路由正确拦截。

**独立测试**: 从未初始化状态访问 `/login`，创建首个管理员，完成登录，进入 `/dashboard`；未登录访问 `/dashboard`、`/providers`、`/api-keys`、`/users`、`/settings` 均被要求认证。

### 用户故事 1 的测试 (REQUIRED) ⚠️

- [ ] T047 [P] [US1] 在 `tests/contract/admin-auth.contract.test.ts` 为 `GET /api/admin/bootstrap/status`、`POST /api/admin/bootstrap`、`POST /api/admin/auth/login`、`POST /api/admin/auth/logout`、`GET /api/admin/auth/me` 编写契约测试
- [ ] T048 [P] [US1] 在 `tests/integration/admin-auth-flow.test.ts` 编写首个管理员创建、登录、登出、已登录访问 `/login` 重定向和未登录受保护路由拦截集成测试
- [ ] T049 [P] [US1] 在 `tests/ui/login-page.test.tsx` 编写 `/login` bootstrap、default、submitting、error、redirect 状态测试
- [ ] T050 [P] [US1] 在 `tests/ui/dashboard-page.test.tsx` 编写 `/dashboard` 未就绪优先、局部摘要失败、下一步入口状态测试

### 用户故事 1 的实现

- [ ] T051 [US1] 在 `docs/api/openapi.yaml` 补齐 bootstrap、login、logout、me、dashboard summary 的路径、请求、响应和错误 schema
- [ ] T052 [US1] 在 `src/server/services/bootstrap-service.ts` 实现首个管理员初始化逻辑、重复初始化拒绝和 `bootstrap_admin_created` 动作结果记录
- [ ] T053 [US1] 在 `src/server/services/auth-service.ts` 实现管理员登录、密码校验、会话创建、登出撤销和 `admin_login` 动作结果记录
- [ ] T054 [US1] 在 `src/app/api/admin/bootstrap/status/route.ts` 实现初始化状态查询接口
- [ ] T055 [US1] 在 `src/app/api/admin/bootstrap/route.ts` 实现首个管理员创建接口
- [ ] T056 [US1] 在 `src/app/api/admin/auth/login/route.ts` 实现管理员登录接口
- [ ] T057 [US1] 在 `src/app/api/admin/auth/logout/route.ts` 实现管理员登出接口
- [ ] T058 [US1] 在 `src/app/api/admin/auth/me/route.ts` 实现当前管理员查询接口
- [ ] T059 [US1] 在 `src/server/services/dashboard-service.ts` 实现 Dashboard 摘要读模型，覆盖管理员初始化、Provider 可用性、Caller Key 可用性、最近异常和下一步入口
- [ ] T060 [US1] 在 `src/app/api/admin/dashboard/summary/route.ts` 实现 Dashboard 摘要接口
- [ ] T061 [US1] 在 `src/app/login/page.tsx` 实现登录页简化认证外壳、品牌说明、登录表单、首个管理员创建表单、SSO/2FA 未启用提示和错误状态
- [ ] T062 [US1] 在 `src/app/(admin)/dashboard/page.tsx` 实现 Dashboard 页面骨架、北极星状态、系统健康概览、Provider 快照、队列与缓存信号、下一步动作
- [ ] T063 [US1] 在 `src/lib/api/admin-auth.ts` 封装 bootstrap、login、logout、me API 调用并接入 `src/lib/api/generated/`
- [ ] T064 [US1] 在 `src/lib/api/dashboard.ts` 封装 dashboard summary API 调用并接入 `src/lib/api/generated/`
- [ ] T065 [US1] 在 `src/app/(admin)/dashboard/page.tsx` 实现摘要局部失败保留已知信息和明确失败对象提示
- [ ] T066 [US1] 在 `src/app/login/page.tsx` 实现已登录访问 `/login` 返回原目标页或 `/dashboard` 的重定向逻辑
- [ ] T067 [US1] 运行 `npm run api:spec`、`npm run api:client`、`npm run typecheck`、`npm test -- tests/contract/admin-auth.contract.test.ts tests/integration/admin-auth-flow.test.ts tests/ui/login-page.test.tsx tests/ui/dashboard-page.test.tsx` 并修复 `docs/api/openapi.yaml`、`src/lib/api/generated/`、`src/app/login/page.tsx`、`src/app/(admin)/dashboard/page.tsx`

**检查点**: US1 可独立演示，完成最小受控后台入口。

---

## 阶段 4: 用户故事 2 - 配置 Provider 与凭据池 (Priority: P2)

**目标**: 管理员可以创建 OpenSubtitles Provider、维护多个上游凭据、查看凭据池状态、隔离/恢复异常凭据，并在详情页补齐运行策略。

**独立测试**: 登录后进入 `/providers` 创建 OpenSubtitles Provider，自动选中新实例，进入 `/providers/:providerId`，新增第二个凭据，隔离一个凭据后其他 active 凭据继续参与服务。

### 用户故事 2 的测试 (REQUIRED) ⚠️

- [ ] T068 [P] [US2] 在 `tests/contract/providers.contract.test.ts` 为 Provider list/create/get/update/enable/disable 和 credentials list/create/isolate/restore 编写契约测试
- [ ] T069 [P] [US2] 在 `tests/unit/providers/provider-service.test.ts` 测试 Provider 状态流转、needs_config、enabled、disabled、degraded 和 Provider 名称约束
- [ ] T070 [P] [US2] 在 `tests/unit/providers/credential-pool.test.ts` 测试 active、cooldown、isolated、disabled、exhausted 凭据选择、隔离、恢复和错误路径
- [ ] T071 [P] [US2] 在 `tests/integration/provider-management-flow.test.ts` 编写创建 Provider、新增凭据、隔离凭据、恢复凭据、详情策略保存的集成测试
- [ ] T072 [P] [US2] 在 `tests/ui/providers-page.test.tsx` 测试 `/providers` empty、loading、create drawer、create success、needs-config、error、permission 状态
- [ ] T073 [P] [US2] 在 `tests/ui/provider-detail-page.test.tsx` 测试 `/providers/:providerId` post-create、dirty/unsaved、save pending、empty credential、isolate confirmation、success、error 状态
- [ ] T074 [P] [US2] 在 `tests/ui/provider-responsive.test.tsx` 测试 Providers Mobile 成功 Banner、Provider Detail Tablet 次级栏下沉、Mobile Accordion 和高风险动作可达性

### 用户故事 2 的实现

- [ ] T075 [US2] 在 `docs/api/openapi.yaml` 补齐 Provider 与 ProviderCredential 管理接口路径、请求、响应和错误 schema
- [ ] T076 [US2] 在 `src/server/providers/provider-repository.ts` 实现 Provider 与 ProviderCredential 读写、状态查询和事务更新
- [ ] T077 [US2] 在 `src/server/providers/opensubtitles-adapter.ts` 实现 OpenSubtitles adapter，隔离认证、限流、超时和上游错误语义
- [ ] T078 [US2] 在 `src/server/providers/credential-pool.ts` 实现凭据池选择、冷却、隔离、恢复、耗尽和最近异常记录逻辑
- [ ] T079 [US2] 在 `src/server/services/provider-service.ts` 实现 Provider 创建、启用、停用、策略更新、详情读取和动作结果记录
- [ ] T080 [US2] 在 `src/app/api/admin/providers/route.ts` 实现 Provider 列表与创建接口
- [ ] T081 [US2] 在 `src/app/api/admin/providers/[providerId]/route.ts` 实现 Provider 详情读取与策略更新接口
- [ ] T082 [US2] 在 `src/app/api/admin/providers/[providerId]/enable/route.ts` 实现 Provider 启用接口
- [ ] T083 [US2] 在 `src/app/api/admin/providers/[providerId]/disable/route.ts` 实现 Provider 停用接口
- [ ] T084 [US2] 在 `src/app/api/admin/providers/[providerId]/credentials/route.ts` 实现凭据列表与新增凭据接口
- [ ] T085 [US2] 在 `src/app/api/admin/providers/[providerId]/credentials/[credentialId]/isolate/route.ts` 实现凭据隔离接口
- [ ] T086 [US2] 在 `src/app/api/admin/providers/[providerId]/credentials/[credentialId]/restore/route.ts` 实现凭据恢复接口
- [ ] T087 [US2] 在 `src/lib/api/providers.ts` 封装 Provider 与 ProviderCredential API 调用并接入 `src/lib/api/generated/`
- [ ] T088 [US2] 在 `src/app/(admin)/providers/page.tsx` 实现 Providers 页面页头、状态筛选、Token 池摘要卡、Provider 列表、选中 Provider 池检查和深配承接区
- [ ] T089 [US2] 在 `src/components/providers/create-provider-drawer.tsx` 实现 OpenSubtitles 模板化创建抽屉，仅收集 Provider 名称和至少一个 API Key
- [ ] T090 [US2] 在 `src/components/providers/provider-list.tsx` 实现 Provider 高密度列表、状态 Badge、needs-config 标识、选中状态和详情跳转
- [ ] T091 [US2] 在 `src/components/providers/provider-pool-inspector.tsx` 实现选中 Provider 凭据池摘要、Token 表格、异常说明和进入详情 CTA
- [ ] T092 [US2] 在 `src/app/(admin)/providers/[providerId]/page.tsx` 实现 Provider Detail 页头、返回、保存、未保存变更提示和 post-create 引导
- [ ] T093 [US2] 在 `src/components/providers/provider-policy-form.tsx` 实现权重、并发、轮换、冷却、失败切换和回退目标策略表单
- [ ] T094 [US2] 在 `src/components/providers/provider-credential-table.tsx` 实现凭据表格、新增凭据、隔离确认、恢复动作和无活跃凭据风险提示
- [ ] T095 [US2] 在 `src/components/providers/provider-activity.tsx` 实现最近行为表格、事件 Badge 和时间范围选择
- [ ] T096 [US2] 在 `src/app/(admin)/providers/page.tsx` 与 `src/app/(admin)/providers/[providerId]/page.tsx` 实现 Desktop/Tablet/Mobile 响应式行为，覆盖 Mobile 成功 Banner、详情页 Accordion、页面根无横向滚动
- [ ] T097 [US2] 运行 `npm run api:spec`、`npm run api:client`、`npm run typecheck`、`npm test -- tests/contract/providers.contract.test.ts tests/unit/providers/provider-service.test.ts tests/unit/providers/credential-pool.test.ts tests/integration/provider-management-flow.test.ts tests/ui/providers-page.test.tsx tests/ui/provider-detail-page.test.tsx tests/ui/provider-responsive.test.tsx` 并修复 `docs/api/openapi.yaml`、`src/server/providers/`、`src/app/(admin)/providers/`

**检查点**: US2 可独立演示，Provider 与上游凭据池形成可运营闭环。

---

## 阶段 5: 用户故事 3 - 对外提供统一字幕查询与下载 (Priority: P3)

**目标**: 管理员可以创建、轮换、停用下游调用方 Key；外部应用可以使用 active Caller Key 查询和下载字幕，并获得统一错误响应。

**独立测试**: 登录后创建 Caller Key，在受控 reveal window 内复制明文，使用该 Key 完成一次查询和下载；停用或轮换旧 Key 后新请求被拒绝。

### 用户故事 3 的测试 (REQUIRED) ⚠️

- [ ] T098 [P] [US3] 在 `tests/contract/caller-keys.contract.test.ts` 为 caller-keys list/create/rotate/suspend/usage 编写契约测试
- [ ] T099 [P] [US3] 在 `tests/contract/subtitles.contract.test.ts` 为 `GET /api/subtitles/search` 和 `GET /api/subtitles/download` 编写契约测试
- [ ] T100 [P] [US3] 在 `tests/unit/caller-keys/caller-key-service.test.ts` 测试 Caller Key 创建、受控 reveal、轮换、停用、授权校验和旧 Key 失效
- [ ] T101 [P] [US3] 在 `tests/unit/subtitles/subtitle-gateway.test.ts` 测试统一查询、下载、无结果、未就绪、未授权、上游失败和下载不可用错误映射
- [ ] T102 [P] [US3] 在 `tests/integration/subtitle-gateway-flow.test.ts` 编写创建 Caller Key 后查询与下载字幕的端到端 API 集成测试
- [ ] T103 [P] [US3] 在 `tests/ui/api-keys-page.test.tsx` 测试 `/api-keys` empty、no-selection、reveal window、copy、rotate、suspend、筛选后选中项保留状态
- [ ] T104 [P] [US3] 在 `tests/ui/api-keys-responsive.test.tsx` 测试 API Keys Tablet 双栏堆叠、Mobile 卡片化列表、明文 reveal 可读性和高风险动作二次确认

### 用户故事 3 的实现

- [ ] T105 [US3] 在 `docs/api/openapi.yaml` 补齐 Caller Key 管理接口和对外字幕 search/download 接口的路径、请求、响应、文件下载和错误 schema
- [ ] T106 [US3] 在 `src/server/caller-keys/caller-key-repository.ts` 实现 CallerKey 与 CallerKeyRotation 读写、哈希查询和使用摘要查询
- [ ] T107 [US3] 在 `src/server/services/caller-key-service.ts` 实现 Caller Key 创建、受控 reveal window、轮换、停用、恢复限制、授权校验和动作结果记录
- [ ] T108 [US3] 在 `src/server/subtitles/subtitle-gateway.ts` 实现统一字幕查询、Provider 调度、OpenSubtitles adapter 调用、统一结果归一化和请求记录
- [ ] T109 [US3] 在 `src/server/subtitles/subtitle-download.ts` 实现统一字幕下载、字幕引用解析、Provider 下载调用、文件响应头和下载记录
- [ ] T110 [US3] 在 `src/app/api/admin/caller-keys/route.ts` 实现 Caller Key 列表与创建接口
- [ ] T111 [US3] 在 `src/app/api/admin/caller-keys/[keyId]/rotate/route.ts` 实现 Caller Key 轮换接口
- [ ] T112 [US3] 在 `src/app/api/admin/caller-keys/[keyId]/suspend/route.ts` 实现 Caller Key 停用接口
- [ ] T113 [US3] 在 `src/app/api/admin/caller-keys/[keyId]/usage/route.ts` 实现 Caller Key 最近使用摘要接口
- [ ] T114 [US3] 在 `src/app/api/subtitles/search/route.ts` 实现对外字幕查询接口，覆盖 active Caller Key、无 Provider、无活跃 Key、上游无结果、上游失败错误路径
- [ ] T115 [US3] 在 `src/app/api/subtitles/download/route.ts` 实现对外字幕下载接口，覆盖 active Caller Key、字幕不存在、Provider 下载失败和文件响应
- [ ] T116 [US3] 在 `src/lib/api/caller-keys.ts` 封装 Caller Key 管理 API 调用并接入 `src/lib/api/generated/`
- [ ] T117 [US3] 在 `src/app/(admin)/api-keys/page.tsx` 实现 API Keys 页头、摘要卡、Key inventory、生成表单、Selected key 详情和治理说明
- [ ] T118 [US3] 在 `src/components/api-keys/caller-key-inventory.tsx` 实现调用方、Key 片段、环境、状态和筛选后选中保留逻辑
- [ ] T119 [US3] 在 `src/components/api-keys/caller-key-form.tsx` 实现新建 Caller Key 表单，覆盖 callerName、environment、scope、quotaPolicy 字段
- [ ] T120 [US3] 在 `src/components/api-keys/caller-key-detail.tsx` 实现 selected key 详情、最近 24h 使用、轮换结果、受控 reveal/copy、停用和轮换动作
- [ ] T121 [US3] 在 `src/components/api-keys/reveal-secret.tsx` 实现 reveal window、只读明文展示、copy 成功反馈和窗口结束后隐藏逻辑
- [ ] T122 [US3] 在 `src/app/(admin)/api-keys/page.tsx` 实现 Desktop/Tablet/Mobile 响应式行为，覆盖 inventory 与详情堆叠、Mobile 明文可读和高风险确认
- [ ] T123 [US3] 运行 `npm run api:spec`、`npm run api:client`、`npm run typecheck`、`npm test -- tests/contract/caller-keys.contract.test.ts tests/contract/subtitles.contract.test.ts tests/unit/caller-keys/caller-key-service.test.ts tests/unit/subtitles/subtitle-gateway.test.ts tests/integration/subtitle-gateway-flow.test.ts tests/ui/api-keys-page.test.tsx tests/ui/api-keys-responsive.test.tsx` 并修复 `docs/api/openapi.yaml`、`src/server/caller-keys/`、`src/server/subtitles/`、`src/app/(admin)/api-keys/`

**检查点**: US3 可独立演示，统一字幕出口可被有效调用方查询与下载，停用 Key 后立即拒绝新请求。

---

## 阶段 6: 用户故事 4 - 管理后台成员与基础会话风险 (Priority: P4)

**目标**: 管理员可以查看后台成员和邀请，创建成员邀请，暂停/恢复成员，并处置需要关注的后台会话；不得扩展为权限矩阵、审批流、完整 RBAC、审计导出、高级风险分析或风控策略系统。

**独立测试**: 登录后进入 `/users`，创建 pending invitation，暂停一个成员使其不能访问后台，恢复成员后恢复访问，撤销或标记处理一个需要关注的后台会话并看到摘要刷新。

### 用户故事 4 的测试 (REQUIRED) ⚠️

- [ ] T124 [P] [US4] 在 `tests/contract/users.contract.test.ts` 为 users list、invitations create、user suspend、user restore、session remediate 编写契约测试
- [ ] T125 [P] [US4] 在 `tests/unit/users/admin-invitation-service.test.ts` 测试 AdminInvitation pending、accepted、expired、revoked 状态和重复 pending 邀请约束
- [ ] T126 [P] [US4] 在 `tests/unit/users/admin-user-service.test.ts` 测试后台成员暂停、恢复、暂停后会话失效和动作结果记录
- [ ] T127 [P] [US4] 在 `tests/unit/users/admin-session-remediation.test.ts` 测试基础会话处置、需要关注会话拒绝高风险动作和不触发高级风控流程
- [ ] T128 [P] [US4] 在 `tests/integration/users-management-flow.test.ts` 编写邀请、暂停、恢复、基础会话处置完整集成测试
- [ ] T129 [P] [US4] 在 `tests/ui/users-page.test.tsx` 测试 `/users` default、loading、empty、error、permission、needs-attention-session、no-active-session-attention、session-remediated 状态
- [ ] T130 [P] [US4] 在 `tests/ui/users-responsive.test.tsx` 测试 Users Tablet 筛选横排、Mobile 单列顺序、批量操作收敛和暂停/恢复二次确认

### 用户故事 4 的实现

- [ ] T131 [US4] 在 `docs/api/openapi.yaml` 补齐 Users list、invitations create、user suspend、user restore、session remediate 的路径、请求、响应和错误 schema
- [ ] T132 [US4] 在 `src/server/users/admin-user-repository.ts` 实现 AdminUser、AdminInvitation、AdminSession 的 Users 页读写查询
- [ ] T133 [US4] 在 `src/server/services/admin-invitation-service.ts` 实现成员邀请创建、重复 pending 邀请拒绝、过期判断、撤销和 `admin_invitation_created`、`admin_invitation_revoked` 动作记录
- [ ] T134 [US4] 在 `src/server/services/admin-user-service.ts` 实现成员列表、成员暂停、成员恢复、暂停后会话失效和 `admin_user_suspended`、`admin_user_restored` 动作记录
- [ ] T135 [US4] 在 `src/server/services/admin-session-service.ts` 实现后台会话摘要、risk 会话基础处置、revoke/mark_resolved 行为和 `admin_session_remediated` 动作记录
- [ ] T136 [US4] 在 `src/app/api/admin/users/route.ts` 实现后台成员、邀请和基础会话摘要查询接口
- [ ] T137 [US4] 在 `src/app/api/admin/users/invitations/route.ts` 实现成员邀请创建接口
- [ ] T138 [US4] 在 `src/app/api/admin/users/[userId]/suspend/route.ts` 实现成员暂停接口
- [ ] T139 [US4] 在 `src/app/api/admin/users/[userId]/restore/route.ts` 实现成员恢复接口
- [ ] T140 [US4] 在 `src/app/api/admin/sessions/[sessionId]/remediate/route.ts` 实现基础会话处置接口
- [ ] T141 [US4] 在 `src/lib/api/users.ts` 封装 Users API 调用并接入 `src/lib/api/generated/`
- [ ] T142 [US4] 在 `src/app/(admin)/users/page.tsx` 实现 Users 页头、成员摘要卡、成员与邀请列表、邀请流程、选中成员详情、设备与会话区、风险动作区
- [ ] T143 [US4] 在 `src/components/users/member-summary-cards.tsx` 实现活跃成员、待接受邀请、值守覆盖、需要关注会话摘要卡和 Badge 状态说明
- [ ] T144 [US4] 在 `src/components/users/member-list.tsx` 实现成员与邀请列表、Tabs 筛选、成员状态 Badge、邀请状态 Badge 和选中状态保留
- [ ] T145 [US4] 在 `src/components/users/invitation-form.tsx` 实现邀请表单，包含 identifier、rolePreset、accessPreset，并明确禁止策略编辑语义
- [ ] T146 [US4] 在 `src/components/users/member-detail.tsx` 实现选中成员详情、预设角色、最近活动、负责模块和当前状态展示
- [ ] T147 [US4] 在 `src/components/users/session-remediation.tsx` 实现需要关注会话列表、基础处置按钮、处置确认和处置结果反馈
- [ ] T148 [US4] 在 `src/components/users/member-risk-actions.tsx` 实现成员暂停/恢复的 `AlertDialog` 二次确认、成功反馈和失败对象保留
- [ ] T149 [US4] 在 `src/app/(admin)/users/page.tsx` 实现 Users Desktop/Tablet/Mobile 响应式行为，覆盖 Tablet 筛选横排、Mobile 模块顺序、批量操作收敛和高风险动作可达性
- [ ] T150 [US4] 在 `src/app/(admin)/users/page.tsx` 移除或拒绝权限矩阵、审批流、完整 RBAC、审计导出、高级风险分析、风控策略系统和 access-control 主流程入口
- [ ] T151 [US4] 运行 `npm run api:spec`、`npm run api:client`、`npm run typecheck`、`npm test -- tests/contract/users.contract.test.ts tests/unit/users/admin-invitation-service.test.ts tests/unit/users/admin-user-service.test.ts tests/unit/users/admin-session-remediation.test.ts tests/integration/users-management-flow.test.ts tests/ui/users-page.test.tsx tests/ui/users-responsive.test.tsx` 并修复 `docs/api/openapi.yaml`、`src/server/users/`、`src/app/(admin)/users/`

**检查点**: US4 可独立演示，Users 范围严格停留在 MVP 基础成员管理与基础会话处置。

---

## 阶段 7: 用户故事 5 - 确认系统状态并找到正确配置入口 (Priority: P5)

**目标**: 管理员可以在 Settings 页只读确认部署状态、管理员初始化状态、Provider 可用性、Caller Key 可用性和统一出口就绪度，并被分流到正确治理页。

**独立测试**: 登录后进入 `/settings`，读取环境、版本、管理员初始化状态、服务就绪度和未就绪原因；点击 Provider、API Keys、Users 分流入口进入对应页面；页面不提供深配置表单或保存动作。

### 用户故事 5 的测试 (REQUIRED) ⚠️

- [ ] T152 [P] [US5] 在 `tests/contract/settings.contract.test.ts` 为 `GET /api/admin/settings/status` 编写契约测试
- [ ] T153 [P] [US5] 在 `tests/unit/settings/system-readiness.test.ts` 测试 Provider、Caller Key、管理员初始化、统一出口就绪度组合和局部读数失败
- [ ] T154 [P] [US5] 在 `tests/integration/settings-readiness-flow.test.ts` 编写 Settings 只读状态、未就绪原因和配置分流集成测试
- [ ] T155 [P] [US5] 在 `tests/ui/settings-page.test.tsx` 测试 `/settings` default、loading、empty、error、permission、只读分流和后续能力预留状态
- [ ] T156 [P] [US5] 在 `tests/ui/settings-responsive.test.tsx` 测试 Settings Desktop/Tablet/Mobile 单列分组、无保存动作和页面根无横向滚动

### 用户故事 5 的实现

- [ ] T157 [US5] 在 `docs/api/openapi.yaml` 补齐 Settings status 接口路径、响应和局部失败错误 schema
- [ ] T158 [US5] 在 `src/server/services/settings-service.ts` 实现 SystemReadiness 聚合读模型，覆盖 environment、version、adminInitialized、activeProviderCount、activeCallerKeyCount、gatewayReady、missingConditions、lastCheckedAt
- [ ] T159 [US5] 在 `src/app/api/admin/settings/status/route.ts` 实现 Settings 只读状态接口
- [ ] T160 [US5] 在 `src/lib/api/settings.ts` 封装 Settings status API 调用并接入 `src/lib/api/generated/`
- [ ] T161 [US5] 在 `src/app/(admin)/settings/page.tsx` 实现 Settings 页头、系统基础状态卡、范围说明、配置分流、基础服务核查、部署读数和后续能力预留区
- [ ] T162 [US5] 在 `src/components/settings/readiness-cards.tsx` 实现环境、版本、首个管理员状态和服务就绪度卡片
- [ ] T163 [US5] 在 `src/components/settings/config-routing.tsx` 实现 Provider Detail、API Keys、Users 和后续 access-control 的明确分流入口，后续能力必须弱化且不可编辑
- [ ] T164 [US5] 在 `src/components/settings/readiness-checklist.tsx` 实现 Provider、Caller Key、管理员认证和统一出口只读核查项
- [ ] T165 [US5] 在 `src/app/(admin)/settings/page.tsx` 实现部署读数失败时保留已知可用信息并指出失败对象
- [ ] T166 [US5] 在 `src/app/(admin)/settings/page.tsx` 移除或拒绝 Provider、API Key、用户、权限深配置表单和任何保存动作
- [ ] T167 [US5] 运行 `npm run api:spec`、`npm run api:client`、`npm run typecheck`、`npm test -- tests/contract/settings.contract.test.ts tests/unit/settings/system-readiness.test.ts tests/integration/settings-readiness-flow.test.ts tests/ui/settings-page.test.tsx tests/ui/settings-responsive.test.tsx` 并修复 `docs/api/openapi.yaml`、`src/server/services/settings-service.ts`、`src/app/(admin)/settings/page.tsx`

**检查点**: US5 可独立演示，Settings 页保持只读确认与配置分流定位。

---

## 阶段 8: 收尾与横切关注点

**目的**: 补齐跨故事的 API、响应式、图标、设计稿资产、文档、review 和验收闭环。

- [ ] T168 在 `docs/api/openapi.yaml` 对齐 `specs/001-mvp-admin-console/contracts/api-contract.md` 的全部路径、错误码、请求、响应和 tag 分组
- [ ] T169 在 `orval.config.ts` 与 `src/lib/api/generated/` 重新生成并提交最新 API client/types，确保生成目录不含手写业务逻辑
- [ ] T170 在 `src/lib/api/` 检查手写封装层覆盖 admin auth、dashboard、providers、caller-keys、users、settings，不直接引用未封装的 generated client
- [ ] T171 在 `src/app/docs/api/page.tsx` 验证 Scalar `/docs/api` 展示 OpenAPI 最新路径、认证方式和错误 schema
- [ ] T172 [P] 在 `tests/contract/openapi-generated-client.test.ts` 增加 OpenAPI、Orval 生成类型与手写封装层一致性测试
- [ ] T173 在 `src/components/admin/` 检查 Admin Shell、Sidebar、Page Header、Drawer、EmptyStateCard、StatusBadge 跨页面复用，避免页面私有复制
- [ ] T174 在 `src/app/(admin)/dashboard/page.tsx`、`src/app/(admin)/providers/page.tsx`、`src/app/(admin)/providers/[providerId]/page.tsx`、`src/app/(admin)/api-keys/page.tsx`、`src/app/(admin)/users/page.tsx`、`src/app/(admin)/settings/page.tsx` 统一 Desktop、Tablet、Mobile 断点行为并消除页面根横向滚动
- [ ] T175 在 `src/components/icons/lucide.tsx` 和 `design/main.pen` 对齐 Lucide 图标资产，确认 `cloud-off`、`key-round`、`users`、`layout-dashboard`、`server`、`settings`、`menu`、`panel-left`、`moon`、`sun` 均有一致命名
- [ ] T176 [P] 在 `tests/ui/responsive-regression.test.tsx` 增加 360px、390px、430px、768px、834px、1024px、1180px、1280px 断点回归测试
- [ ] T177 [P] 在 `tests/ui/accessibility.test.tsx` 增加键盘焦点、颜色非唯一状态表达、按钮可达性和 reduced motion 基线测试
- [ ] T178 [P] 在 `tests/security/secrets.test.ts` 增加 ProviderCredential、CallerKey、reveal window 和日志输出不泄露明文测试
- [ ] T179 在 `specs/001-mvp-admin-console/quickstart.md` 执行并核对实现后验收路径，修复 `package.json`、`docs/api/openapi.yaml`、`src/app/`、`tests/` 中发现的不一致
- [ ] T180 在 `DESIGN.md`、`docs/layouts/admin-layout.md`、`docs/pages/*.md` 检查实现是否引入新跨页面规则；若没有新规则，不修改设计真源
- [ ] T181 在 `design/main.pen` 检查深/浅主题与 Tablet/Mobile 设计稿对照结果，必要时同步新增 Lucide 可复用图标资产
- [ ] T182 在 `src/app/`、`src/components/`、`src/server/`、`docs/api/openapi.yaml` 运行 UI review，对照 `DESIGN.md`、`docs/layouts/admin-layout.md`、`docs/pages/*.md`、`design/main.pen` 修复保真、响应式与图标偏差
- [ ] T183 在 `src/app/`、`src/server/`、`src/lib/api/`、`tests/` 运行 code review，检查行为正确性、状态流转、测试缺口、API 契约链路、安全边界和 Users MVP 范围
- [ ] T184 在 `package.json` 执行 `npm run format`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run api:check` 并修复所有失败项
- [ ] T185 在 `specs/001-mvp-admin-console/tasks.md` 回填实现过程中发现的任务拆分偏差，确保后续 task issue 同步仍限定在 `specs/001-mvp-admin-console/`

---

## 依赖与执行顺序

### 阶段依赖

- **阶段 1 初始化**: 无依赖，可立即开始。
- **阶段 2 基础能力**: 依赖阶段 1，阻塞全部用户故事。
- **US1 首次开通控制台**: 依赖阶段 2，建议作为第一个可演示 MVP 切片。
- **US2 Provider 与凭据池**: 依赖阶段 2；与 US1 共享认证和 Admin Shell，业务上可在 US1 后演示。
- **US3 统一字幕出口与调用方 Key**: 依赖阶段 2 和 US2 的 Provider 调度基础；API Keys 页面和对外字幕 API 可并行实现但必须在集成前对齐 Caller Key 授权。
- **US4 Users 基础成员管理**: 依赖阶段 2；不得依赖或引入 `access-control` 页面、权限矩阵、审批流或高级风控系统。
- **US5 Settings 状态确认与分流**: 依赖阶段 2，并读取 US2、US3、US4 的聚合状态；可先做只读骨架，最终集成需等待对应服务可用。
- **阶段 8 收尾**: 依赖目标用户故事完成。

### 用户故事依赖

- **US1 (P1)**: Foundational 完成后可启动，不依赖其他用户故事。
- **US2 (P2)**: Foundational 完成后可启动，最终演示建议在 US1 登录闭环之后。
- **US3 (P3)**: 依赖 Provider 调度接口和 Caller Key 授权，可在 US2 后端调度基础完成后集成。
- **US4 (P4)**: Foundational 完成后可启动，范围独立于 US2/US3。
- **US5 (P5)**: 可先实现页面与接口骨架，完整 readiness 验证依赖 US1、US2、US3、US4 的状态读数。

### 每个用户故事内的顺序

- 测试任务先写，并在实现前确认失败。
- OpenAPI 契约先于 Route Handler 和前端 API client。
- 数据层先于 service。
- service 先于 Route Handler。
- Route Handler 先于前端真实 API 接入。
- 页面骨架先于子状态完善。
- 响应式与图标一致性必须在每个故事检查点前完成。

### 可并行机会

- 阶段 1 中 T012-T020 可并行。
- 阶段 2 中 T024-T026、T033-T039、T041-T045 可并行。
- US1 的 T047-T050 可并行，T052-T060 与 T061-T066 在契约确认后可分后端/前端并行。
- US2 的 T068-T074 可并行，T076-T086 后端与 T088-T096 前端可在 `docs/api/openapi.yaml` 草案稳定后并行。
- US3 的 T098-T104 可并行，Caller Key 管理、字幕网关、API Keys 页面可分三条线并行。
- US4 的 T124-T130 可并行，Users 后端服务与 Users 页面组件可在契约稳定后并行。
- US5 的 T152-T156 可并行，Settings service 与 Settings 组件可并行。
- 阶段 8 中 T172、T176、T177、T178 可并行。

---

## 并行示例

### 用户故事 1

```bash
Task: "T047 [US1] 在 tests/contract/admin-auth.contract.test.ts 为认证接口编写契约测试"
Task: "T048 [US1] 在 tests/integration/admin-auth-flow.test.ts 编写首轮开通集成测试"
Task: "T049 [US1] 在 tests/ui/login-page.test.tsx 编写 Login 页面状态测试"
Task: "T050 [US1] 在 tests/ui/dashboard-page.test.tsx 编写 Dashboard 页面状态测试"
```

### 用户故事 2

```bash
Task: "T076 [US2] 在 src/server/providers/provider-repository.ts 实现 Provider 与凭据读写"
Task: "T077 [US2] 在 src/server/providers/opensubtitles-adapter.ts 实现 OpenSubtitles adapter"
Task: "T088 [US2] 在 src/app/(admin)/providers/page.tsx 实现 Providers 页面"
Task: "T092 [US2] 在 src/app/(admin)/providers/[providerId]/page.tsx 实现 Provider Detail 页面"
```

### 用户故事 3

```bash
Task: "T106 [US3] 在 src/server/caller-keys/caller-key-repository.ts 实现 Caller Key 读写"
Task: "T108 [US3] 在 src/server/subtitles/subtitle-gateway.ts 实现统一字幕查询网关"
Task: "T109 [US3] 在 src/server/subtitles/subtitle-download.ts 实现统一字幕下载"
Task: "T117 [US3] 在 src/app/(admin)/api-keys/page.tsx 实现 API Keys 页面"
```

### 用户故事 4

```bash
Task: "T133 [US4] 在 src/server/services/admin-invitation-service.ts 实现成员邀请"
Task: "T134 [US4] 在 src/server/services/admin-user-service.ts 实现成员暂停与恢复"
Task: "T135 [US4] 在 src/server/services/admin-session-service.ts 实现基础会话处置"
Task: "T142 [US4] 在 src/app/(admin)/users/page.tsx 实现 Users 页面"
```

### 用户故事 5

```bash
Task: "T158 [US5] 在 src/server/services/settings-service.ts 实现 SystemReadiness 聚合"
Task: "T161 [US5] 在 src/app/(admin)/settings/page.tsx 实现 Settings 页面"
Task: "T163 [US5] 在 src/components/settings/config-routing.tsx 实现配置分流"
Task: "T164 [US5] 在 src/components/settings/readiness-checklist.tsx 实现基础服务核查"
```

---

## 实施策略

### MVP 优先（用户故事 1）

1. 完成阶段 1 初始化。
2. 完成阶段 2 基础能力。
3. 完成阶段 3 用户故事 1。
4. 验证 `/login`、首个管理员创建、受保护路由和 `/dashboard` 未就绪引导。
5. 再进入 Provider、Caller Key、Users 与 Settings 增量交付。

### 增量交付

1. Setup + Foundational 完成后，先交付 US1 形成受控后台入口。
2. 交付 US2，形成上游 Provider 与凭据池运营闭环。
3. 交付 US3，形成下游 Caller Key 与统一字幕查询/下载出口。
4. 交付 US4，形成后台成员邀请、暂停/恢复和基础会话处置闭环。
5. 交付 US5，形成系统状态确认与配置分流闭环。
6. 最后完成 API 契约、响应式、图标、UI review、code review 和 quickstart 验收。

### 团队并行策略

1. 共同完成阶段 1 和阶段 2。
2. 契约负责人维护 `docs/api/openapi.yaml`、`orval.config.ts`、`src/lib/api/generated/` 和 `/docs/api`。
3. 后端负责人按 US2、US3、US4、US5 服务边界并行推进。
4. 前端负责人按页面规范实现 Login、Dashboard、Providers、Provider Detail、API Keys、Users、Settings。
5. UI review 与 code review 在每个用户故事检查点执行，不等到最终阶段才集中处理。

---

## 备注

- 本 feature 建议整体继承 `scope:mvp`。
- `access-control` 页面、权限矩阵、审批流、完整 RBAC、审计导出、完整身份治理中心、高级风险分析和风控策略系统不属于当前 feature。
- Users 任务只允许覆盖成员列表/状态、成员邀请、成员暂停/恢复、基础会话处置及其直接测试与评审。
- 正式 issue 同步前应补齐主 Issue，并按仓库标签体系至少设置 `type:*`、`area:*`、`priority:*`、`scope:mvp`。
- 若实现发现需要新增跨页面设计规则，应先更新 `DESIGN.md` 或 `docs/layouts/admin-layout.md`，再继续实现。

## Extension Hooks

**Optional Hook**: git
Command: `/speckit.git.commit`
Description: Auto-commit after task generation

Prompt: Commit task changes?
To execute: `/speckit.git.commit`
