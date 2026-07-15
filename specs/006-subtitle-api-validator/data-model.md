# Data Model — Subtitle API Validator

## 1. ValidatorProviderSummary

用于左侧 Provider Rail 与顶部当前 provider 摘要。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | provider 实例 ID，例如 `xunlei-default` |
| `name` | `string` | 管理台展示名称 |
| `type` | `"opensubtitles" | "xunlei"` | provider 类型 |
| `status` | `"enabled" | "disabled" | "degraded" | "needs_config"` | 当前启停 / 降级状态 |
| `healthStatus` | `"healthy" | "degraded" | "failing" | "unknown" | null` | 最近健康摘要 |
| `lastHealthCheckedAt` | `string | null` | ISO 时间戳 |
| `supportsDownloadValidation` | `boolean` | 是否允许结果项触发下载验证 |
| `supportsBrowserDownload` | `boolean` | 是否支持浏览器直接下载触发 |
| `supportsUrlCheck` | `boolean` | 是否支持下载 URL 有效性校验 |
| `availabilityLabel` | `string` | 例如“已启用”“已禁用”“受限可验证” |
| `restrictionNote` | `string | null` | disabled / restricted provider 的提示文案 |
| `capabilitySummary` | `string[]` | 支持的搜索字段 / 下载能力摘要 |

## 2. ValidatorProviderDetail

用于 Provider Overview / Capability Panel。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `provider` | `ValidatorProviderSummary` | 基础摘要 |
| `description` | `string` | provider 简介 |
| `supportedSearchFields` | `ValidatorSearchFieldDefinition[]` | 基础 + 扩展参数定义 |
| `supportsKeywordSearch` | `boolean` | 至少一个 provider 应为 true |
| `supportsDownloadValidation` | `boolean` | 是否展示下载验证入口 |
| `supportsBrowserDownload` | `boolean` | 浏览器直接下载能力 |
| `supportsUrlCheck` | `boolean` | URL 校验能力 |
| `limitations` | `string[]` | 限制说明，不含敏感凭据 |
| `defaultExamples` | `ValidatorExampleInput[]` | 示例参数按钮来源 |

## 3. ValidatorSearchFieldDefinition

定义表单字段，不要求所有 provider 共用同一模型。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `key` | `string` | 字段 key |
| `label` | `string` | 展示名称 |
| `group` | `"base" | "provider_extension"` | 基础通用参数 / provider 扩展参数 |
| `inputType` | `"text" | "number" | "select" | "boolean"` | UI 控件类型 |
| `required` | `boolean` | 是否必填 |
| `placeholder` | `string | null` | 占位文案 |
| `options` | `Array<{ label: string; value: string }>` | select 可选项 |
| `helpText` | `string | null` | 辅助说明 |

## 4. ValidatorSearchRequest

页面提交给 admin validator search API 的负载。

```ts
interface ValidatorSearchRequest {
  providerId: string;
  baseParams: {
    keyword: string;
  };
  providerParams: Record<string, string | number | boolean | null>;
}
```

约束：
- `keyword` 为当前唯一强制基础字段。
- `providerParams` 仅允许当前 provider 定义中存在的扩展字段。
- 不在前端或 API 响应中回显 secret / token / credential 原文。

## 5. ValidatorSearchResponse

```ts
interface ValidatorSearchResponse {
  provider: ValidatorProviderSummary;
  request: ValidatorRequestSnapshot;
  status: "success" | "empty";
  results: ValidatorSearchResultItem[];
  diagnostics: ValidatorDiagnosticsSummary;
}
```

说明：
- `status: "empty"` 表示请求成功但无匹配结果，HTTP 仍返回 200。
- provider error / timeout / invalid params / unknown error 不进入该成功结构，而进入统一错误响应。

## 6. ValidatorSearchResultItem

用于 Search Results Console 列表项。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 结果项稳定标识 |
| `title` | `string` | 标题 |
| `language` | `string | null` | 语言 |
| `releaseName` | `string | null` | 版本 / 发布名 |
| `sourceLabel` | `string` | 来源 provider 名称 |
| `metadata` | `Record<string, string | number | boolean | null>` | 基础元信息展示槽位 |
| `downloadUrlAvailable` | `boolean` | 是否存在下载地址 |
| `downloadMode` | `"browser_download" | "url_check" | "unsupported"` | 默认下载验证模式 |
| `downloadReference` | `string | null` | 服务端诊断用引用，不暴露敏感 token |
| `rawDownloadUrl` | `string | null` | 仅在允许前端直接触发下载时提供 |

## 7. ValidatorDownloadValidationRequest

```ts
interface ValidatorDownloadValidationRequest {
  providerId: string;
  resultId: string;
  mode: "browser_download" | "url_check";
  downloadReference?: string | null;
}
```

说明：
- `resultId` 用于关联前一次 search response 中的结果项。
- `downloadReference` 优先使用服务端稳定引用；仅在 provider 明确要求直链模式时回传脱敏 URL 或引用 token。

## 8. ValidatorDownloadValidationResult

```ts
interface ValidatorDownloadValidationResult {
  provider: ValidatorProviderSummary;
  resultId: string;
  mode: "browser_download" | "url_check";
  status: "success" | "failed" | "unsupported" | "missing_download";
  httpStatus: number | null;
  message: string;
  diagnostics: ValidatorDiagnosticsSummary;
  browserDownloadUrl?: string | null;
}
```

状态语义：
- `success`: 下载链路验证通过
- `failed`: provider 返回异常 / 4xx / 5xx / timeout / 未知错误
- `unsupported`: 当前 provider / 当前结果不支持该验证模式
- `missing_download`: 结果项没有可用下载地址

## 9. ValidatorRequestSnapshot

用于 Diagnostic Summary，不暴露 secret。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `providerId` | `string` | provider ID |
| `providerName` | `string` | provider 名称 |
| `baseParams` | `Record<string, string>` | 基础参数摘要 |
| `providerParams` | `Record<string, string | number | boolean | null>` | 扩展参数摘要 |
| `requestedAt` | `string` | 发起时间 |
| `durationMs` | `number | null` | 耗时 |
| `requestId` | `string` | 诊断追踪 ID |

## 10. ValidatorDiagnosticsSummary

统一承载搜索和下载验证的调试摘要。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `requestId` | `string` | 唯一请求 ID |
| `providerCode` | `string` | provider type / adapter code |
| `statusLabel` | `string` | 面向管理员的状态摘要 |
| `durationMs` | `number | null` | 请求耗时 |
| `upstreamStatus` | `number | null` | 上游 HTTP 状态码（若可得） |
| `errorCode` | `string | null` | `TIMEOUT` / `INVALID_PARAMS` / `PROVIDER_ERROR` 等 |
| `errorSummary` | `string | null` | 脱敏错误摘要 |
| `nextActionHint` | `string | null` | 下一步建议，例如“检查 provider 凭据状态” |

## 11. ValidatorAuditEvent（可选最小审计）

若复用现有 admin action/audit 能力，可映射以下最小事件模型：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `actorAdminUserId` | `string` | 管理员 ID |
| `action` | `"validator.search" | "validator.download_check"` | 操作类型 |
| `providerId` | `string` | provider ID |
| `result` | `"success" | "empty" | "failed"` | 结果摘要 |
| `requestId` | `string` | 关联诊断 ID |
| `errorCode` | `string | null` | 错误码 |
| `createdAt` | `string` | 发生时间 |

约束：
- 不新增完整历史报表或搜索会话持久化。
- 不记录 secret / token / download 原始敏感链接。
