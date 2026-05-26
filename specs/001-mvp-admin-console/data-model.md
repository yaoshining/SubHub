# MVP 管理控制台与统一字幕出口 - 数据模型

## AdminUser

**用途**: 可登录管理控制台的受控身份。

**字段**:
- `id`: 稳定唯一标识
- `identifier`: 登录标识，支持邮箱或用户名
- `displayName`: 后台显示名称
- `passwordHash`: 密码哈希，不存储明文
- `status`: `active` | `suspended`
- `role`: MVP 固定为 `admin` 或受限预设角色，不实现完整权限矩阵
- `createdAt`
- `updatedAt`
- `lastLoginAt`

**验证规则**:
- 首轮初始化必须至少创建一个 `active` 管理员。
- `identifier` 必须唯一。
- `suspended` 用户不得登录或执行高风险操作。

**状态转换**:
- `active -> suspended`: 管理员暂停成员。
- `suspended -> active`: 管理员恢复成员。

## AdminInvitation

**用途**: 管理员创建的后台成员邀请，用于 MVP 基础成员管理；不承载审批工作流、权限矩阵或完整身份治理流程。

**字段**:
- `id`
- `identifier`: 被邀请成员的邮箱或登录标识
- `status`: `pending` | `accepted` | `expired` | `revoked`
- `rolePreset`: MVP 预设角色，例如 `admin` 或 `operator`；不得在邀请中定义自定义权限策略
- `accessPreset`: MVP 预设接入范围，例如 `admin_console`
- `invitedByAdminUserId`
- `acceptedAdminUserId`
- `expiresAt`
- `acceptedAt`
- `revokedAt`
- `createdAt`
- `updatedAt`

**验证规则**:
- 同一 `identifier` 不应同时存在多个有效 `pending` 邀请。
- `expired` 或 `revoked` 邀请不得被接受。
- 接受邀请后必须创建或绑定一个后台成员，并将邀请状态更新为 `accepted`。
- `rolePreset` 与 `accessPreset` 只能引用 MVP 预设候选，不得引入权限矩阵编辑、审批流或多租户成员治理。

**状态转换**:
- `pending -> accepted`: 被邀请成员完成接受流程。
- `pending -> expired`: 邀请超过有效期。
- `pending -> revoked`: 管理员撤销邀请。

## AdminSession

**用途**: 管理后台登录会话；MVP 中的风险状态仅用于标记需要管理员基础处置的后台会话，不代表完整风险评分、设备指纹或风控策略系统。

**字段**:
- `id`
- `adminUserId`
- `status`: `active` | `revoked` | `expired` | `needs_attention` | `remediated`
- `createdAt`
- `expiresAt`
- `lastSeenAt`
- `deviceLabel`
- `attentionReason`: 基础关注原因，用于解释为什么该会话需要管理员处置；对应早期文案中的 `riskReason`，不得扩展为高级风险分析模型。

**验证规则**:
- 受保护后台页面与管理 API 必须校验 active session。
- `revoked`、`expired`、`needs_attention` session 不得继续访问高风险动作。
- `needs_attention` session 只表示需要基础会话处置，不触发权限矩阵、审批流、审计导出或完整风控流程；处置完成后进入 `remediated`。

## Provider

**用途**: 上游字幕来源实例，首版为 OpenSubtitles。

**字段**:
- `id`
- `name`
- `type`: MVP 固定首发 `opensubtitles`
- `status`: `enabled` | `disabled` | `needs_config` | `degraded`
- `priority`
- `weight`
- `concurrencyLimit`
- `rotationEnabled`
- `cooldownSeconds`
- `fallbackProviderId`
- `lastHealthStatus`
- `lastErrorSummary`
- `createdAt`
- `updatedAt`

**验证规则**:
- Provider 名称在同类型内应可区分。
- `enabled` Provider 必须至少存在一个可参与调度的 active credential 才能视为可服务。
- 新建 Provider 可处于 `needs_config`，不得伪装为稳定可服务。

**状态转换**:
- `needs_config -> enabled`: 补齐必要策略和至少一个活跃凭据。
- `enabled -> degraded`: 活跃凭据不足、上游异常或额度风险。
- `enabled/degraded -> disabled`: 管理员停用。
- `disabled -> enabled`: 管理员启用且满足基础条件。

## ProviderCredential

**用途**: 绑定到 Provider 的上游 Token / API Key，可独立启停和隔离。

**字段**:
- `id`
- `providerId`
- `label`
- `secretHash`
- `secretEncrypted`
- `displayPrefix`
- `displaySuffix`
- `status`: `active` | `cooldown` | `isolated` | `disabled` | `exhausted`
- `remainingQuota`
- `lastUsedAt`
- `lastErrorAt`
- `lastErrorSummary`
- `cooldownUntil`
- `createdAt`
- `updatedAt`

**验证规则**:
- 明文凭据只允许在写入时处理；列表和详情默认展示受控片段。
- `isolated`、`disabled`、`exhausted`、未到期 `cooldown` 凭据不得参与新请求调度。
- 隔离异常凭据必须立即从活跃池移出，不影响同 Provider 下其他 active 凭据。

**状态转换**:
- `active -> cooldown`: 上游限流或短期失败。
- `active -> isolated`: 管理员隔离异常凭据。
- `active -> exhausted`: 额度耗尽。
- `cooldown -> active`: 冷却结束且未被管理员停用。
- `isolated/disabled -> active`: 管理员恢复且验证通过。

## CallerKey

**用途**: 分配给外部应用的下游访问凭据。

**字段**:
- `id`
- `callerName`
- `environment`: `production` | `staging` | `development`
- `scope`
- `quotaPolicy`
- `keyHash`
- `keyPrefix`
- `keySuffix`
- `status`: `active` | `suspended` | `rotated`
- `createdAt`
- `updatedAt`
- `lastUsedAt`
- `lastRotatedAt`
- `revealUntil`

**验证规则**:
- 外部字幕查询/下载必须提供 active CallerKey。
- `suspended` 或旧版本 `rotated` Key 必须拒绝新请求。
- 完整明文只在新建或轮换后的受控 reveal window 内可见。

**状态转换**:
- `active -> suspended`: 管理员停用，立即拒绝新请求。
- `active -> rotated`: 轮换后旧 Key 失效，新 Key 进入 active。
- `suspended -> active`: 仅在明确恢复动作中允许。

## CallerKeyRotation

**用途**: 记录调用方 Key 轮换结果。

**字段**:
- `id`
- `callerKeyId`
- `oldKeySuffix`
- `newKeySuffix`
- `result`: `success` | `failed`
- `reason`
- `createdAt`
- `performedByAdminUserId`

## SubtitleSearchRequest

**用途**: 外部应用发起的统一字幕查询动作记录。

**字段**:
- `id`
- `callerKeyId`
- `mediaTitle`
- `mediaYear`
- `season`
- `episode`
- `language`
- `status`: `success` | `no_results` | `service_not_ready` | `unauthorized` | `provider_failed`
- `resultCount`
- `providerId`
- `credentialId`
- `durationMs`
- `createdAt`

**验证规则**:
- 未授权请求不得进入 Provider 调度。
- 无可用 Provider 时返回 `service_not_ready`。
- 上游无字幕返回 `no_results`，不得与上游失败混淆。

## SubtitleDownloadRequest

**用途**: 外部应用基于查询结果下载字幕内容的动作记录。

**字段**:
- `id`
- `callerKeyId`
- `subtitleRef`
- `providerId`
- `credentialId`
- `status`: `success` | `not_found` | `service_not_ready` | `unauthorized` | `provider_failed`
- `contentType`
- `durationMs`
- `createdAt`

## AdminActionResult

**用途**: 关键管理动作结果记录。

**字段**:
- `id`
- `actorAdminUserId`
- `actionType`: `provider_enabled` | `provider_disabled` | `credential_isolated` | `credential_restored` | `credential_disabled` | `caller_key_suspended` | `caller_key_rotated` | `admin_invitation_created` | `admin_invitation_revoked` | `admin_user_suspended` | `admin_user_restored` | `admin_session_remediated` | `admin_login` | `bootstrap_admin_created`
- `targetType`
- `targetId`
- `result`: `success` | `failed`
- `message`
- `createdAt`

**验证规则**:
- Provider 启停、凭据隔离/恢复、调用方 Key 停用/轮换、成员邀请、成员暂停/恢复和基础会话处置都必须记录结果。
- 失败结果必须包含可读原因，便于后台错误状态展示。
- Users 相关动作结果只覆盖 MVP 基础成员管理，不扩展为完整审计导出、审批流或身份治理事件流。

## SystemReadiness

**用途**: Settings 与 Dashboard 使用的聚合读模型，不一定作为独立表持久化。

**字段**:
- `adminInitialized`: boolean
- `activeProviderCount`: number
- `activeCallerKeyCount`: number
- `gatewayReady`: boolean
- `environment`
- `version`
- `missingConditions`: string[]
- `lastCheckedAt`

**验证规则**:
- `gatewayReady` 仅在至少一个可用 Provider 且至少一个 active CallerKey 存在时为 true。
- 任一读数失败时，页面必须保留其他已知读数，并指出失败对象。
