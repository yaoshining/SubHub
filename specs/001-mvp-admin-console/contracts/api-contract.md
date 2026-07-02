# MVP 管理控制台与统一字幕出口 - API 契约规划

本文件是 feature 级规划契约，不是 OpenAPI 真源。正式机器可读契约必须写入 `docs/api/openapi.yaml`，并通过 `orval.config.ts` 生成到 `src/lib/api/generated/`，由 `/docs/api` Scalar 展示。

## 通用约定

### 认证

- 管理端 API 使用管理员会话认证。
- 对外字幕 API 使用下游调用方 Key 认证。
- Provider 上游凭据不得暴露给外部调用方。

### 通用错误结构

```json
{
  "error": {
    "code": "SERVICE_NOT_READY",
    "message": "当前实例尚未具备对外字幕服务条件",
    "target": "provider_pool"
  }
}
```

**错误代码基线**:

- `AUTHENTICATION_REQUIRED`
- `FORBIDDEN`
- `VALIDATION_FAILED`
- `SERVICE_NOT_READY`
- `CALLER_KEY_INVALID`
- `CALLER_KEY_SUSPENDED`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_CREDENTIAL_EXHAUSTED`
- `NO_RESULTS`
- `SUBTITLE_NOT_FOUND`
- `UPSTREAM_FAILED`

## 认证与初始化

### `GET /api/admin/bootstrap/status`

返回是否已创建首个管理员。

**200 response**:

```json
{
  "initialized": false
}
```

### `POST /api/admin/bootstrap`

创建首个管理员；仅允许未初始化时调用。

**request**:

```json
{
  "identifier": "admin@example.com",
  "displayName": "Admin",
  "password": "strong-password"
}
```

**201 response**:

```json
{
  "adminUserId": "admin_001",
  "status": "active"
}
```

### `POST /api/admin/auth/login`

管理员登录。

**request**:

```json
{
  "identifier": "admin@example.com",
  "password": "strong-password"
}
```

**200 response**:

```json
{
  "admin": {
    "id": "admin_001",
    "identifier": "admin@example.com",
    "displayName": "Admin",
    "role": "admin"
  }
}
```

### `POST /api/admin/auth/logout`

撤销当前会话。

### `GET /api/admin/auth/me`

返回当前登录管理员。

## Dashboard 与 Settings

### `GET /api/admin/dashboard/summary`

返回 Dashboard 所需健康、Provider、Key、队列/缓存摘要。

### `GET /api/admin/settings/status`

返回 Settings 只读状态。

**200 response**:

```json
{
  "environment": "production",
  "version": "0.1.0",
  "adminInitialized": true,
  "activeProviderCount": 1,
  "activeCallerKeyCount": 1,
  "gatewayReady": true,
  "missingConditions": [],
  "lastCheckedAt": "2026-05-26T00:00:00.000Z"
}
```

## Provider 管理

### `GET /api/admin/providers`

返回 Provider 列表、Token 池摘要和当前状态。

### `POST /api/admin/providers`

创建 OpenSubtitles Provider。

**request**:

```json
{
  "name": "OpenSubtitles Primary",
  "type": "opensubtitles",
  "initialCredential": {
    "label": "primary token",
    "secret": "provider-api-key"
  }
}
```

**201 response**:

```json
{
  "id": "provider_001",
  "name": "OpenSubtitles Primary",
  "type": "opensubtitles",
  "status": "needs_config"
}
```

### `GET /api/admin/providers/{providerId}`

返回单个 Provider 配置、Token 池和最近行为。

### `PATCH /api/admin/providers/{providerId}`

更新 Provider 运行策略。

### `POST /api/admin/providers/{providerId}/enable`

启用 Provider。

### `POST /api/admin/providers/{providerId}/disable`

停用 Provider。

## Provider 凭据池

### `GET /api/admin/providers/{providerId}/credentials`

返回 Provider 上游凭据列表。

### `POST /api/admin/providers/{providerId}/credentials`

新增上游凭据。

### `POST /api/admin/providers/{providerId}/credentials/{credentialId}/isolate`

隔离异常凭据，立即移出活跃池。

### `POST /api/admin/providers/{providerId}/credentials/{credentialId}/restore`

恢复凭据参与调度。

## 下游调用方 Key

### `GET /api/admin/caller-keys`

返回调用方 Key inventory、摘要与当前选中详情。

### `POST /api/admin/caller-keys`

创建新调用方 Key。

**request**:

```json
{
  "callerName": "Jellyfin Home",
  "environment": "production",
  "scope": "subtitles:read",
  "quotaPolicy": "default"
}
```

**201 response**:

```json
{
  "id": "ck_001",
  "callerName": "Jellyfin Home",
  "status": "active",
  "key": "subhub_live_full_secret_once",
  "revealUntil": "2026-05-26T00:10:00.000Z"
}
```

### `POST /api/admin/caller-keys/{keyId}/rotate`

轮换当前 Key，返回一次性可见明文。

### `POST /api/admin/caller-keys/{keyId}/suspend`

停用当前 Key，立即拒绝新外部请求。

### `GET /api/admin/caller-keys/{keyId}/usage`

返回最近使用摘要。

## 用户管理

MVP 用户管理接口只覆盖后台访问生命周期的最小治理：成员可见、成员邀请、暂停/恢复与基础会话处置。该契约不得被解释为完整身份治理中心、权限矩阵、审批工作流、审计导出或高级风险分析/风控策略系统。

### `GET /api/admin/users`

返回后台成员、待接受邀请、成员状态与需要管理员关注的基础会话摘要。

**200 response**:

```json
{
  "members": [
    {
      "id": "admin_001",
      "identifier": "admin@example.com",
      "displayName": "Admin",
      "status": "active",
      "rolePreset": "admin",
      "lastActiveAt": "2026-05-26T00:00:00.000Z"
    }
  ],
  "invitations": [
    {
      "id": "invite_001",
      "identifier": "operator@example.com",
      "status": "pending",
      "rolePreset": "operator",
      "accessPreset": "admin_console",
      "expiresAt": "2026-05-27T00:00:00.000Z"
    }
  ],
  "sessionsNeedingAttention": [
    {
      "id": "session_001",
      "memberId": "admin_001",
      "status": "needs_attention",
      "reason": "unusual_location",
      "lastSeenAt": "2026-05-26T00:00:00.000Z"
    }
  ]
}
```

### `POST /api/admin/users/invitations`

创建成员邀请；MVP 只允许预设角色和接入范围，不允许在 Users 接口中定义角色策略或权限矩阵。

**request**:

```json
{
  "identifier": "operator@example.com",
  "rolePreset": "operator",
  "accessPreset": "admin_console"
}
```

**201 response**:

```json
{
  "id": "invite_001",
  "identifier": "operator@example.com",
  "status": "pending",
  "rolePreset": "operator",
  "accessPreset": "admin_console",
  "expiresAt": "2026-05-27T00:00:00.000Z"
}
```

### `POST /api/admin/users/{userId}/suspend`

暂停成员，并使其不再能够登录或执行受保护后台管理动作。

### `POST /api/admin/users/{userId}/restore`

恢复已暂停成员的后台访问状态。

### `POST /api/admin/sessions/{sessionId}/remediate`

执行基础会话处置，用于当前后台安全维护需要，例如撤销需要关注的后台会话或标记为已处理；不包含风险评分、设备指纹、自动风控策略或完整审计调查流。

**request**:

```json
{
  "action": "revoke",
  "reason": "admin_review"
}
```

**200 response**:

```json
{
  "sessionId": "session_001",
  "status": "remediated",
  "action": "revoke"
}
```

## 对外字幕 API

### `GET /api/subtitles/search`

使用下游调用方 Key 查询字幕。

**query parameters**:

- `title`: string
- `year`: number, optional
- `season`: number, optional
- `episode`: number, optional
- `language`: string, optional

**200 response**:

```json
{
  "status": "success",
  "results": [
    {
      "id": "subtitle_ref_001",
      "provider": "opensubtitles",
      "language": "zh-CN",
      "releaseName": "Example.Release",
      "format": "srt",
      "downloadUrl": "/api/subtitles/download?subtitleId=subtitle_ref_001"
    }
  ]
}
```

**200 no results response**:

```json
{
  "status": "no_results",
  "results": []
}
```

### `GET /api/subtitles/download`

下载字幕内容。

**query parameters**:

- `subtitleId`: string

**200 response**:

- Body: subtitle file content
- Headers: content type and filename suitable for subtitle download

**failure response**:

```json
{
  "error": {
    "code": "SUBTITLE_NOT_FOUND",
    "message": "未找到可下载的字幕项",
    "target": "subtitleId"
  }
}
```

## 契约同步要求

- 上述路径、请求、响应和错误结构必须进入 `docs/api/openapi.yaml`。
- `api:spec` 必须校验 OpenAPI 文件。
- `api:client` 必须从 `orval.config.ts` 生成 `src/lib/api/generated/`。
- `api:docs` 必须验证 `/docs/api` Scalar 文档可展示。
- `api:check` 如落地，应串联 spec、client、docs 三类检查。
