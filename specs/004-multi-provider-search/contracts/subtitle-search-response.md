# Contract: 聚合字幕搜索响应模型

**日期**: 2026-06-27
**对应 plan**: `specs/004-multi-provider-search/plan.md`
**对应 spec**: `specs/004-multi-provider-search/spec.md`

> 第 1 阶段产物。本文档定义 `v0.2.2` 聚合字幕搜索响应模型的对外契约。

---

## 1. 概述

`v0.2.2` 在 `v0.2.1` `SubtitleSearchResponse` 基础上增量扩展：

- `SubtitleSearchResult.provider` enum 扩展为 `[opensubtitles, xunlei]`
- 新增 `SubtitleSearchResult.raw` 可选对象（保留 provider 原始字段）
- 新增 `SubtitleSearchResult.score` 可选 number（provider 原始评分透传）
- 新增 `SubtitleSearchData.provider_failures` 可选数组（暴露 provider 失败信息）
- `SubtitleSearchData.status` 扩展为 `[success, partial]`

老调用方按 `v0.2.1` 行为消费结果（只看 `id` / `language` / `releaseName` / `format` / `downloadUrl`），响应结构 MUST 保持向后兼容。

---

## 2. 响应顶层结构

### 2.1 `SubtitleSearchResponse`

```yaml
SubtitleSearchResponse:
  type: object
  required: [data]
  properties:
    data:
      $ref: "#/components/schemas/SubtitleSearchData"
```

### 2.2 `SubtitleSearchData`

```yaml
SubtitleSearchData:
  type: object
  required: [status, results]
  properties:
    status:
      type: string
      enum: [success, partial]
      description: |
        success: 所有 provider 成功或无 provider；partial: 至少一个 provider 失败但其他 provider 返回了结果。
    results:
      type: array
      items:
        $ref: "#/components/schemas/SubtitleSearchResult"
    provider_failures:
      type: array
      description: 单 provider 失败信息；与 results 并存但不阻塞主流程。
      items:
        $ref: "#/components/schemas/ProviderFailureInfo"
```

### 2.3 `SubtitleSearchResult`

```yaml
SubtitleSearchResult:
  type: object
  required: [id, provider, language, releaseName, format, downloadUrl]
  properties:
    id:
      type: string
      description: |
        网关生成的字幕引用，可直接用于下载接口 subtitleId。
        OpenSubtitles: opensubtitles:{providerId}:{file_id}
        Xunlei: xunlei:{providerId}:{gcid} 或 xunlei:{providerId}:{cid}（优先 gcid）
    provider:
      type: string
      enum: [opensubtitles, xunlei]
      description: 由 SubHub 显式注入；不允许直接复用 provider 原始数据中的同名字段。
    language:
      type: string
      nullable: true
    releaseName:
      type: string
      nullable: true
    format:
      type: string
      description: 字幕文件格式（如 srt / ass / sub）；缺失时默认 srt。
    downloadUrl:
      type: string
      description: |
        已包含完整 subtitleId 查询参数的下载路径，调用方可直接请求。
        统一下载入口，由网关根据 subtitleId 前缀路由到对应 provider 的下载流程。
    raw:
      type: object
      additionalProperties: true
      nullable: true
      description: |
        provider 原始字段；老调用方可忽略。
        OpenSubtitles: download_count, upload_date, feature_id, file_id, original_payload 等
        Xunlei: cid, gcid, url, ext, duration, languages, source, score, fingerprintf_score, extra_name, mt, original_payload 等
    score:
      type: number
      nullable: true
      description: provider 原始评分；迅雷透传 score；OpenSubtitles 暂无。
```

### 2.4 `ProviderFailureInfo`

```yaml
ProviderFailureInfo:
  type: object
  required: [provider, reason]
  properties:
    provider:
      type: string
      enum: [opensubtitles, xunlei]
    reason:
      type: string
      enum:
        - upstream_failed
        - timeout
        - rate_limited
        - skipped_missing_fields
        - skipped_disabled
        - authentication_failed
      description: |
        upstream_failed: 上游 5xx 或网络异常
        timeout: 请求超时
        rate_limited: 上游限流
        skipped_missing_fields: provider 因必要条件缺失而跳过（不计入错误）
        skipped_disabled: provider 被禁用或无凭据
        authentication_failed: 认证失败
    message:
      type: string
      description: 失败信息摘要；不含堆栈。
```

---

## 3. 状态码语义

| 状态码 | 触发场景 |
|--------|----------|
| 200 | 搜索成功（`status: success` 或 `status: partial`） |
| 400 | 请求校验失败（如 `type=movie` + `season`/`episode` 冲突、必填字段缺失） |
| 401 | caller key 无效或缺失 |
| 403 | caller key 被暂停 |
| 404 | 无可用 provider 或上游返回 no results |
| 502 | 所有 provider 均失败（`UPSTREAM_FAILED`） |
| 503 | 服务未就绪（`SERVICE_NOT_READY`） |

> **`status: partial` 不阻塞 200**：单个 provider 失败但其他 provider 返回结果时，HTTP 仍为 200；调用方通过 `data.provider_failures[]` 感知失败细节。

---

## 4. 老调用方兼容性

`v0.2.1` 调用方按以下模式消费结果（伪代码）：

```ts
const response = await searchSubtitles(request);
const results = response.data.results;
// 每个 result 包含：id, provider, language, releaseName, format, downloadUrl
for (const result of results) {
  // provider 始终是 "opensubtitles"
  // 走 downloadUrl 下载
}
```

`v0.2.2` 后，相同代码 MUST 继续工作：

- `result.provider` 当前值 `opensubtitles` MUST 保持有效
- `result.id` / `result.language` / `result.releaseName` / `result.format` / `result.downloadUrl` 字段集不变
- `response.data.results` 数组结构不变
- 新增字段（`raw` / `score` / `provider_failures`）以可选形式暴露，老调用方可忽略

---

## 5. 增量扩展详解

### 5.1 `provider` enum 扩展

| 版本 | `provider` 取值 |
|------|-----------------|
| `v0.2.1` | `opensubtitles` |
| `v0.2.2` | `opensubtitles` / `xunlei` |

**兼容性**: 老调用方若使用 switch-case 或硬编码枚举，MUST 在 `v0.2.2` 后增加 `xunlei` 分支；使用字面量比较的代码（如 `provider === "opensubtitles"`）继续工作。

### 5.2 `raw` 字段

`raw` 是可选对象，承载 provider 原始字段。调用方应：

- 不依赖 `raw` 的具体字段集合（provider 可能在不同版本变更）
- 仅在调试 / 审计场景访问 `raw`
- 关键字段（如 `score`）已在顶层字段透传，避免依赖 `raw`

### 5.3 `score` 字段

`score` 是可选 number，nullable。语义：

- 迅雷 provider：透传上游 `score`
- OpenSubtitles：暂无（保持 null / undefined）

老调用方可忽略此字段；新调用方可按 `provider` 字段差异化处理评分。

### 5.4 `provider_failures` 字段

`provider_failures` 是可选数组，承载单 provider 失败信息。语义：

- 仅在至少一个 provider 失败时出现
- 与 `results` 并存而非互斥
- 不会因为有失败就把响应改为非 200

### 5.5 `status: partial` 扩展

`status` 从 `[success]` 扩展为 `[success, partial]`：

- `success`: 所有 provider 成功或无 provider 调用
- `partial`: 至少一个 provider 失败，但其他 provider 返回了结果

老调用方若仅依赖 `status === "success"`，`v0.2.2` 后 MUST 接受 `status === "partial"` 也视为"有结果"。

---

## 6. 错误响应（复用现有 ErrorResponse schema）

错误响应（400 / 401 / 403 / 404 / 502 / 503）复用现有 `ErrorResponse` schema；不引入新的错误结构。provider 失败信息通过 `provider_failures` 暴露，不通过堆栈或原始错误对象。

---

## 7. 示例响应

### 7.1 单 provider 成功

```json
{
  "data": {
    "status": "success",
    "results": [
      {
        "id": "opensubtitles:provider_abc:12345",
        "provider": "opensubtitles",
        "language": "en",
        "releaseName": "The.Shawshank.Redemption.1994.720p.BluRay.x264.srt",
        "format": "srt",
        "downloadUrl": "/api/subtitles/download?subtitleId=opensubtitles%3Aprovider_abc%3A12345",
        "raw": {
          "download_count": 1234
        }
      }
    ]
  }
}
```

### 7.2 多 provider 成功

```json
{
  "data": {
    "status": "success",
    "results": [
      {
        "id": "opensubtitles:provider_abc:12345",
        "provider": "opensubtitles",
        "language": "en",
        "releaseName": "The.Shawshank.Redemption.1994.720p.BluRay.x264.srt",
        "format": "srt",
        "downloadUrl": "/api/subtitles/download?subtitleId=opensubtitles%3Aprovider_abc%3A12345",
        "raw": {
          "download_count": 1234
        }
      },
      {
        "id": "xunlei:provider_xyz:abcdef0123456789",
        "provider": "xunlei",
        "language": "zh",
        "releaseName": "肖申克的救赎.srt",
        "format": "srt",
        "downloadUrl": "/api/subtitles/download?subtitleId=xunlei%3Aprovider_xyz%3Aabcdef0123456789",
        "raw": {
          "cid": "...",
          "gcid": "abcdef0123456789",
          "url": "https://...",
          "ext": "srt",
          "score": 0.95
        },
        "score": 0.95
      }
    ]
  }
}
```

### 7.3 部分失败（partial）

```json
{
  "data": {
    "status": "partial",
    "results": [
      {
        "id": "opensubtitles:provider_abc:12345",
        "provider": "opensubtitles",
        "language": "en",
        "releaseName": "The.Shawshank.Redemption.1994.720p.BluRay.x264.srt",
        "format": "srt",
        "downloadUrl": "/api/subtitles/download?subtitleId=opensubtitles%3Aprovider_abc%3A12345"
      }
    ],
    "provider_failures": [
      {
        "provider": "xunlei",
        "reason": "upstream_failed",
        "message": "迅雷字幕 provider 上游返回 5xx"
      }
    ]
  }
}
```

### 7.4 所有 provider 均失败（HTTP 502）

```json
{
  "error": {
    "code": "UPSTREAM_FAILED",
    "message": "字幕查询上游请求失败。",
    "target": "provider"
  }
}
```

---

## 8. 参考资料

- `specs/004-multi-provider-search/spec.md`
- `specs/004-multi-provider-search/plan.md`
- `specs/004-multi-provider-search/data-model.md`
- `contracts/subtitle-search-request.md`：请求模型契约
- `contracts/provider-adapter-contract.md`：provider 适配层契约
- `docs/api/openapi.yaml`
- `specs/003-subtitle-search-fields/spec.md`（`v0.2.1` 规格）
