# Contract — `POST /api/admin/subtitle-validator/download-validation`

## Purpose

对搜索结果项执行下载链路验证，不等同于正式字幕入库流程。

## Authentication

- 必须通过 admin session 访问

## Request

```json
{
  "providerId": "provider_001",
  "resultId": "result_001",
  "mode": "url_check",
  "downloadReference": "ref_abc123"
}
```

## Success 200

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
      "capabilitySummary": ["关键词搜索", "浏览器下载", "URL 校验"]
    },
    "resultId": "result_001",
    "mode": "url_check",
    "status": "success",
    "httpStatus": 200,
    "message": "下载链接可用",
    "diagnostics": {
      "requestId": "val_01J...",
      "providerCode": "opensubtitles",
      "statusLabel": "下载验证成功",
      "durationMs": 233,
      "upstreamStatus": 200,
      "errorCode": null,
      "errorSummary": null,
      "nextActionHint": "如需进一步确认，可触发浏览器下载"
    },
    "browserDownloadUrl": null
  }
}
```

## Alternate success states

- `status: "missing_download"`: 结果项没有下载地址
- `status: "unsupported"`: provider 或结果不支持当前验证模式
- `status: "failed"`: provider 返回异常 / 非 2xx / timeout / 未知错误

## Notes

- `browserDownloadUrl` 仅在允许前端直接触发下载时返回。
- 对 Xunlei 等不支持统一下载入口的 provider，应允许 `url_check` 成功而 `browser_download` 返回 `unsupported`。
- 不记录或返回敏感凭据原文。
