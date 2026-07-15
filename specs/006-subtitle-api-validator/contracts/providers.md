# Contract — `GET /api/admin/subtitle-validator/providers`

## Purpose

返回 Subtitle API Validator 页面所需的 provider 列表与默认展示摘要。

## Authentication

- 必须通过 admin session 访问
- 未认证返回 `AUTHENTICATION_REQUIRED`

## Response 200

```json
{
  "data": {
    "items": [
      {
        "id": "xunlei-default",
        "name": "Xunlei",
        "type": "xunlei",
        "status": "enabled",
        "healthStatus": "unknown",
        "lastHealthCheckedAt": null,
        "supportsDownloadValidation": true,
        "supportsBrowserDownload": false,
        "supportsUrlCheck": true,
        "availabilityLabel": "已启用",
        "restrictionNote": null,
        "capabilitySummary": ["关键词搜索", "下载 URL 校验"]
      }
    ],
    "defaultProviderId": "xunlei-default"
  }
}
```

## Notes

- 列表必须包含当前系统可见 provider，包括 disabled / restricted provider。
- 页面默认选中逻辑可在服务端返回 `defaultProviderId`，也可由前端按约定计算；若二者并存，以响应值优先。
- 不返回任何 secret / token / credential 原文。
