# Contract — `POST /api/admin/subtitle-validator/search`

## Purpose

对单个 provider 发起搜索验证，返回结果列表或空结果诊断态。

## Authentication

- 必须通过 admin session 访问

## Request

```json
{
  "providerId": "provider_001",
  "baseParams": {
    "keyword": "The Matrix"
  },
  "providerParams": {
    "language": "en",
    "season": 1
  }
}
```

## Success 200 — has results

```json
{
  "data": {
    "provider": {
      "id": "provider_001",
      "name": "OpenSubtitles Primary",
      "type": "opensubtitles",
      "status": "enabled",
      "healthStatus": "healthy",
      "lastHealthCheckedAt": "2026-07-14T10:00:00.000Z",
      "supportsDownloadValidation": true,
      "supportsBrowserDownload": true,
      "supportsUrlCheck": true,
      "availabilityLabel": "已启用",
      "restrictionNote": null,
      "capabilitySummary": ["关键词搜索", "语言过滤", "浏览器下载", "URL 校验"]
    },
    "request": {
      "providerId": "provider_001",
      "providerName": "OpenSubtitles Primary",
      "baseParams": {
        "keyword": "The Matrix"
      },
      "providerParams": {
        "language": "en",
        "season": 1
      },
      "requestedAt": "2026-07-14T10:00:01.000Z",
      "durationMs": 842,
      "requestId": "val_01J..."
    },
    "status": "success",
    "results": [
      {
        "id": "result_001",
        "title": "The Matrix",
        "language": "en",
        "releaseName": "BluRay",
        "sourceLabel": "OpenSubtitles Primary",
        "metadata": {
          "hearingImpaired": false,
          "downloads": 120
        },
        "downloadUrlAvailable": true,
        "downloadMode": "browser_download",
        "downloadReference": "ref_abc123",
        "rawDownloadUrl": null
      }
    ],
    "diagnostics": {
      "requestId": "val_01J...",
      "providerCode": "opensubtitles",
      "statusLabel": "搜索成功",
      "durationMs": 842,
      "upstreamStatus": 200,
      "errorCode": null,
      "errorSummary": null,
      "nextActionHint": "可继续执行下载验证"
    }
  }
}
```

## Success 200 — empty results

```json
{
  "data": {
    "status": "empty",
    "results": [],
    "diagnostics": {
      "errorCode": null,
      "statusLabel": "无匹配结果"
    }
  }
}
```

## Error semantics

- `400 INVALID_PARAMS`: 参数非法或 provider 扩展字段不符合 schema
- `408 TIMEOUT`: 上游 provider 超时
- `502 PROVIDER_ERROR`: provider 返回异常 / 结构不可解析
- `500 UNKNOWN_ERROR`: 未知错误

## Notes

- 空结果必须保持 200 成功结构，不映射为正式业务 API 中的 404。
- 不允许改变正式 `subtitles/search` 路由既有语义。
