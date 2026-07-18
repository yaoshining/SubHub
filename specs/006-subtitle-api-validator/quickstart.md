# Quickstart — Subtitle API Validator

## 目标

验证 Subtitle API Validator 在当前版本范围内可用，且不会改变正式字幕搜索 API 的 caller-key 行为。

## 前置条件

- 已安装依赖：`pnpm install`
- 已具备管理员登录能力
- 本地环境已配置 provider 所需运行时变量（如 OpenSubtitles / Xunlei 对应环境配置）
- 数据库已迁移到当前 schema

## 启动方式

1. 启动开发服务：`pnpm dev`
2. 在浏览器打开管理后台并登录管理员账号
3. 进入 `Subtitle API Validator` 页面（预期路由：`/admin/subtitle-api-validator`）

## 验证场景

### 场景 1：页面默认空态

1. 进入页面但尚未选择 provider
2. 预期：
   - 页面显示内部工具提示，不影响正式用户流量
   - Provider Rail 可见
   - Search Input / Results / Diagnostics 为待开始状态
   - 未暴露任何 provider secret

### 场景 2：选择 provider 后等待输入

1. 在 Provider Rail 选择一个 enabled provider
2. 预期：
   - Provider Overview 显示当前 provider 简介、能力摘要、限制说明
   - Search Input Area 显示基础通用参数 `keyword`
   - 若该 provider 有扩展字段，则显示 provider 扩展参数区
   - 当前 provider 状态、健康摘要、限制提示可在 3 秒内扫读

### 场景 3：搜索成功且有结果

1. 输入 `keyword`
2. 点击“验证搜索”
3. 预期：
   - 搜索中状态明确可见
   - 返回后 Results Console 展示结果列表
   - 每条结果至少显示标题、语言、来源和基础元信息
   - Diagnostics Summary 显示 provider、参数摘要、请求时间、耗时、状态
   - 管理员应可在 10 秒内完成一次搜索验证

### 场景 4：搜索成功但无结果

1. 选择一个存在但较冷门的搜索词
2. 触发搜索
3. 预期：
   - API 返回成功语义，UI 显示“无匹配结果”而非失败
   - Diagnostics Summary 标记为空结果诊断态
   - 可继续修改参数重新验证

### 场景 5：搜索失败 / 超时 / 参数非法

1. 分别制造非法参数、上游超时或 provider error
2. 预期：
   - UI 区分 `invalid params`、`timeout`、`provider error`、`unknown error`
   - 错误文案脱敏，不暴露 secret / token
   - Diagnostics Summary 给出 error code、摘要和下一步建议
   - 管理员应可在 20 秒内定位明显链路问题

### 场景 6：下载验证成功

1. 对支持下载的结果项点击下载验证
2. 分别执行：
   - 浏览器下载触发
   - URL 有效性校验（若 provider 支持）
3. 预期：
   - 明确展示成功状态
   - Recent Download Validation / inline result 反馈本次模式与结果
   - 若为浏览器下载模式，前端仅收到允许暴露的下载地址

### 场景 7：下载验证失败 / 无下载地址 / 不支持

1. 选择没有下载地址的结果项，或对不支持该模式的 provider 发起验证
2. 预期：
   - UI 明确区分 `missing_download`、`unsupported`、`failed`
   - Diagnostics Summary 展示失败来源与建议
   - 页面不会误导为正式入库流程失败

### 场景 8：受限 / disabled provider 仍可诊断

1. 在 Provider Rail 选择一个 disabled 或 restricted provider
2. 预期：
   - 状态与限制提示持续可见
   - 若 spec 允许其验证，仍可发起诊断动作
   - 页面持续强调其非线上启用状态

### 场景 9：正式 API 行为不受影响

1. 保持 validator 功能存在的同时，运行正式字幕搜索 / 下载相关既有测试
2. 预期：
   - `src/app/api/subtitles/search/route.ts` 与 `src/app/api/subtitles/download/route.ts` 既有测试保持通过
   - caller-key 语义、错误语义和业务 API 契约无回归

## 建议验证命令

- 格式化：`pnpm format:write`
- 静态检查：`pnpm lint`
- 类型检查：`pnpm typecheck`
- UI 定向测试：`pnpm test -- tests/ui/providers-page.test.tsx`
- Contract 定向测试：`pnpm test -- tests/contract/providers.contract.test.ts`
- Integration 定向测试：`pnpm test -- tests/integration/provider-management-flow.test.ts`
- API 契约链路（若新增 OpenAPI）：`pnpm api:spec && pnpm api:client && pnpm api:check`

## 关联文档

- Spec: `specs/006-subtitle-api-validator/spec.md`
- Plan: `specs/006-subtitle-api-validator/plan.md`
- Research: `specs/006-subtitle-api-validator/research.md`
- Data model: `specs/006-subtitle-api-validator/data-model.md`
- Page spec: `docs/pages/subtitle-api-validator.md`
