# Research — Subtitle API Validator

## 决策 1：新增 admin validator facade，而不是复用正式 `subtitles` caller-key 路由

- **Decision**: 新增 `src/server/subtitles/admin-subtitle-validator.ts` 与 `src/app/api/admin/subtitle-validator/*` 路由，供 Subtitle API Validator 页面独立使用。
- **Rationale**: 现有 `src/app/api/subtitles/search/route.ts`、`src/app/api/subtitles/download/route.ts` 及其底层 `subtitle-gateway.ts` / `subtitle-download.ts` 面向 caller-key 正式业务流，语义上偏正式用户 API；validator 需要 admin session、provider-aware 单 provider 验证、空结果独立态、下载链路诊断态与更强错误分类，不应把这些诊断语义直接塞进正式 API。
- **Alternatives considered**:
  - 直接复用正式 `subtitles` 路由：会引入 caller-key 依赖，并受 `NO_RESULTS` → 404 等既有语义牵制，不利于 validator 页把空结果表达为成功但无匹配。
  - 让前端直连 provider adapter：会破坏服务端受控边界，且有 secret / token 泄漏风险。

## 决策 2：provider 列表复用现有 provider repository / service，再拼接 adapter 能力摘要

- **Decision**: validator provider 列表以 `listProviders()` / `ProviderRepository` 的状态真源为基础，并结合 registry / adapter 输出 capability summary。
- **Rationale**: spec 要求列出系统当前 provider，且 disabled / restricted provider 也可用于排障验证；这些运行状态已经在 provider 管理链路中维护，应避免新建平行 provider 清单。
- **Alternatives considered**:
  - 静态写死 provider 列表：无法正确表达启停 / 受限 / 健康状态，也会与 provider 管理页漂移。

## 决策 3：采用“基础通用参数 + provider 扩展参数”的服务端映射

- **Decision**: 在 validator schema 中定义基础通用字段（至少 keyword），扩展字段按 provider capability / page spec 动态收敛，再由服务端映射到 adapter / gateway 实际需要的输入。
- **Rationale**: spec 明确不要求所有 provider 共用完全一致字段模型，也不强求进一步收敛到最小统一集；页面应保持稳定通用参数区，同时允许 provider-aware 扩展参数自然切换。
- **Alternatives considered**:
  - 单一超级表单：会弱化控制台效率与 provider 差异化能力。
  - 纯前端自由拼接参数：会导致契约不可控、测试困难与错误分类不稳定。

## 决策 4：下载验证区分 `browser_download` 与 `url_check`

- **Decision**: validator 下载验证动作至少区分两种模式：浏览器直接下载触发与下载 URL 可达性校验。
- **Rationale**: spec 与 page spec 都明确要求管理员既能做实际下载触发，也能做轻量 URL 验证；尤其是 Xunlei 这类 provider，目前统一下载入口不适配，更需要保留 URL check 诊断路径。
- **Alternatives considered**:
  - 只做浏览器下载：无法覆盖“URL 通但浏览器触发链路异常”的诊断需要。
  - 只做 URL check：会损失管理员直接感知下载链路的关键动作。

## 决策 5：最小审计仅记录动作摘要，不新建重量级持久化历史

- **Decision**: 如需记录验证动作，只保留 actor、provider、action、result、time、error summary 等最小必要字段；优先复用现有 admin action / audit 能力，不新增 validator 历史中心。
- **Rationale**: spec 明确不引入复杂历史归档、报表或重持久化逻辑；但最小可追溯性有助于内部排障与责任定位。
- **Alternatives considered**:
  - 完全不记日志：实现更简单，但在管理员高风险排障动作上缺少基础追踪。
  - 新建完整 validator history 表：超出当前 release scope，且与 spec 的最小化原则冲突。

## 决策 6：正式 `subtitles` API 行为保持完全隔离

- **Decision**: validator 的 API 路径、状态语义、错误分类与 UI 诊断反馈全部收敛在 admin-only 路径，不修改 `src/app/api/subtitles/*` 的 caller-key 契约与响应约定。
- **Rationale**: spec 的 AC-9、FR-33、SC-004 明确要求 validator 上线不能影响正式搜索 API 行为；这也是本 feature 最大的兼容性约束。
- **Alternatives considered**:
  - 在正式 `subtitles` API 上加 query flag 切换 validator 行为：会把内部诊断语义泄漏到正式接口层，增加兼容性风险。
