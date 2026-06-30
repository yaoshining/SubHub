# Contract: 迅雷字幕 Provider Quirks

**日期**: 2026-06-27
**对应 plan**: `specs/004-multi-provider-search/plan.md`
**对应 spec**: `specs/004-multi-provider-search/spec.md`

> 第 1 阶段产物。本文档记录迅雷字幕 provider 的特殊行为、字段映射与归一化细节。

---

## 1. 入口与已知基线

### 1.1 入口 URL

```
https://api-shoulei-ssl.xunlei.com/oracle/subtitle
```

### 1.2 已知可工作请求形式

```
https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name=权力的游戏&languages=简体
```

### 1.3 已知现实约束

- 迅雷接口当前更偏名称检索型（`name + languages` 主路径）
- `filename` / `moviehash` 等结构化字段暂未确认可作为有效检索入口
- 某些结构化字段即使可传，也不代表迅雷 provider 会真正消费或稳定支持

---

## 2. 字段映射（adapter 内部）

### 2.1 SubHub → 迅雷上游

| SubHub 字段 | 迅雷上游字段 | 必需 | 处理 |
|-------------|--------------|------|------|
| `input.query` | `name` | ✅ | trim 后非空才传；缺失返回 `skipped` |
| `input.language` | `languages` | ✅ | trim 后非空才传；缺失返回 `skipped` |
| `input.imdbId` | — | 否 | MUST 忽略，不传上游 |
| `input.tmdbId` | — | 否 | MUST 忽略，不传上游 |
| `input.season` | — | 否 | MUST 忽略 |
| `input.episode` | — | 否 | MUST 忽略 |
| `input.type` | — | 否 | MUST 忽略 |
| `input.year` | — | 否 | MUST 忽略 |
| `input.title` | — | 否 | MUST 忽略（迅雷只识别 `query`） |

### 2.2 迅雷上游 → SubHub `ProviderSearchResult`

| 迅雷上游字段 | `ProviderSearchResult` 字段 | 处理 |
|--------------|------------------------------|------|
| `gcid` | `id` | 优先使用 |
| `cid` | `id` | `gcid` 缺失时回退 |
| `ext` | `format` | 缺失时默认 `srt` |
| `name` | `releaseName` | 缺失时为 `null` |
| `languages` | `language` | 取第一个语言码；保留在 `raw.languages` |
| `score` | `score` + `raw.score` | 顶层 `score` 透传；原始保留 |
| `url` | adapter 内部 `providerDownloadUrl`（**绝不暴露给 client**） | 迅雷的 `url` 是 provider 原始下载地址，仅在 adapter 内部使用；adapter 将其放入 `ProviderSearchResult.providerDownloadUrl`（adapter 内部字段，不进入公共响应）。公共响应的 `downloadUrl` 由 SubHub gateway 统一生成为 `/api/subtitles/download?subtitleId={xunlei:providerId:gcid\|cid}`；download 路由根据 `subtitleId` 前缀判断 provider 后再走 adapter 的 URL 拉取。迅雷原始 `url` 仅保留在 `AggregatedSubtitleResult.raw.url`（用于调试与审计，不直接是下载入口） |
| `cid` / `gcid` / `url` / `ext` / `name` / `duration` / `languages` / `source` / `score` / `fingerprintf_score` / `extra_name` / `mt` | `raw.*` | 全量保留 |

### 2.3 `id` 生成规则

`ProviderSearchResult.id` 由 adapter 生成，格式为 `xunlei:{providerId}:{gcid}` 或 `xunlei:{providerId}:{cid}`：

- 优先使用 `gcid`（更长，更稳定）
- `gcid` 缺失时回退 `cid`
- `providerId` 来自 SubHub Provider 表的 `id` 字段（gateway 调用 adapter 时传入）
- 完整 id 在 gateway `subtitle-result-normalizer.ts` 中组装：`xunlei:{providerId}:{gcid|cid}`

---

## 3. 必要条件处理

### 3.1 必要条件字段

| 字段 | 必需 | 缺失时行为 |
|------|------|------------|
| `query` | ✅ | adapter 返回 `{ skipped: true, reason: 'missing_required_field' }` |
| `language` | ✅ | adapter 返回 `{ skipped: true, reason: 'missing_required_field' }` |

### 3.2 跳过语义

`skipped: true` 表示：

- gateway MUST 不计入失败
- gateway MUST 不记录到 `provider_failures`（除非原因需要以 `skipped_missing_fields` 暴露）
- gateway MUST 继续处理其他 provider

### 3.3 跳过 vs 错误

| 维度 | 跳过（skipped） | 错误（error） |
|------|------------------|---------------|
| 触发原因 | 必要条件缺失 | 上游 5xx / 超时 / 解析失败 |
| 计入失败 | 否 | 是 |
| 计入 `provider_failures` | 可选（`skipped_missing_fields`） | 是 |
| gateway 后续处理 | 继续处理其他 provider | 继续处理其他 provider |
| `status` 影响 | 不影响（仍为 success） | 至少一个失败时为 partial |

---

## 4. 错误分类

| 上游表现 | adapter 返回 | reason |
|----------|--------------|--------|
| HTTP 5xx | `{ ok: false, error: { reason: 'upstream_failed', message: ... } }` | `upstream_failed` |
| HTTP 4xx（401） | `{ ok: false, error: { reason: 'authentication_failed', message: ... } }` | `authentication_failed` |
| HTTP 4xx（429） | `{ ok: false, error: { reason: 'rate_limited', message: ... } }` | `rate_limited` |
| 请求超时（> timeoutMs） | `{ ok: false, error: { reason: 'timeout', message: ... } }` | `timeout` |
| 响应解析失败（非预期 JSON） | `{ ok: false, error: { reason: 'upstream_failed', message: ... } }` | `upstream_failed` |
| 网络中断 / DNS 失败 | `{ ok: false, error: { reason: 'upstream_failed', message: ... } }` | `upstream_failed` |

---

## 5. 凭据处理

### 5.1 当前状态

- 已知可工作请求形式（`name + languages`）未发现需要 API Key 或 Cookie
- adapter 接受 `credential: null`
- gateway 不为迅雷 provider 调用凭据池

### 5.2 后续扩展（**全部属于 post-v0.2.2**，不属于本次 `v0.2.2` 范围）

> ⚠️ **范围声明**：若实际部署发现迅雷接口需要凭据，必须由独立 spec 推进凭据池接入，且必须先评估是否需要扩展 `versioning.md` 中 `v0.2.2` 范围（很可能升级到 `v0.2.3`）。本次 `v0.2.2` **不**接入凭据池、**不**扩展 `providerTypes` enum、**不**新增 migration、**不**变更数据库 schema。

后续扩展步骤（仅供规划参考，不属于 `v0.2.2`）：

- 扩展 `providerTypes` enum（如需数据库持久化新凭据类型）
- 在凭据池中为迅雷 provider 增加专属调度逻辑
- adapter 接受 `credential: SelectedProviderCredential`，按需使用

---

## 6. 超时控制

### 6.1 默认超时

adapter 默认 `timeoutMs = 5000`（与 OpenSubtitles 一致）。

### 6.2 超时实现

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
try {
  const response = await fetch(upstreamUrl, { signal: controller.signal });
  // ...
} catch (error) {
  if (error.name === "AbortError") {
    return {
      ok: false,
      skipped: false,
      error: { reason: "timeout", message: "迅雷 provider 请求超时" },
    };
  }
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

---

## 7. 响应解析示例

### 7.1 假设的迅雷响应

```json
[
  {
    "cid": "abcdef1234567890",
    "gcid": "abcdef0123456789abcdef0123456789",
    "url": "https://...",
    "ext": "srt",
    "name": "肖申克的救赎.srt",
    "duration": 8520,
    "languages": ["zh", "zh-CN"],
    "source": "shoulei",
    "score": 0.95,
    "fingerprintf_score": 0.0,
    "extra_name": "简体&英文",
    "mt": 0
  }
]
```

### 7.2 adapter 解析后 `ProviderSearchResult`

```ts
{
  id: "xunlei:provider_xyz:abcdef0123456789abcdef0123456789",  // 优先 gcid
  language: "zh",                                                // 取第一个语言码
  releaseName: "肖申克的救赎.srt",
  format: "srt",                                                 // 来自 ext
  downloadUrl: null,                                            // 不暴露原始 url
  score: 0.95,                                                   // 顶层 score 透传
  raw: {
    cid: "abcdef1234567890",
    gcid: "abcdef0123456789abcdef0123456789",
    url: "https://...",
    ext: "srt",
    duration: 8520,
    languages: ["zh", "zh-CN"],
    source: "shoulei",
    score: 0.95,
    fingerprintf_score: 0.0,
    extra_name: "简体&英文",
    mt: 0,
  }
}
```

### 7.3 gateway 归一化后 `AggregatedSubtitleResult`

```ts
{
  id: "xunlei:provider_xyz:abcdef0123456789abcdef0123456789",
  provider: "xunlei",                                              // SubHub 显式注入
  language: "zh",
  releaseName: "肖申克的救赎.srt",
  format: "srt",
  downloadUrl: "/api/subtitles/download?subtitleId=xunlei%3Aprovider_xyz%3Aabcdef0123456789abcdef0123456789",
  score: 0.95,
  raw: { /* 同上 */ }
}
```

---

## 8. 测试覆盖

### 8.1 adapter 单元测试

- 字段消费：传入 `query + language`，验证上游 URL 正确
- 字段忽略：传入 `imdb_id` 等不消费字段，验证上游 URL 不包含
- 必要条件缺失（`query` 空）：返回 `skipped: true, reason: 'missing_required_field'`
- 必要条件缺失（`language` 空）：返回 `skipped: true, reason: 'missing_required_field'`
- 上游 5xx：返回 `{ ok: false, error: { reason: 'upstream_failed' } }`
- 上游 401：返回 `{ ok: false, error: { reason: 'authentication_failed' } }`
- 上游 429：返回 `{ ok: false, error: { reason: 'rate_limited' } }`
- 超时：返回 `{ ok: false, error: { reason: 'timeout' } }`
- 响应解析：正常响应解析为 `ProviderSearchResult`
- 字段缺失：`gcid` 缺失时回退 `cid`；`ext` 缺失时 `format = 'srt'`

### 8.2 contract 测试

- `GET /api/subtitles/search` 返回结果含迅雷 provider 结果
- 每个迅雷结果 `provider === "xunlei"`
- 每个迅雷结果 `id` 格式为 `xunlei:{providerId}:{gcid|cid}`
- 每个迅雷结果 `raw` 保留迅雷原始字段
- 迅雷必要条件缺失时 gateway 跳过，`provider_failures` 含 `skipped_missing_fields`

---

## 9. 已知风险

### 9.1 接口稳定性

- 迅雷接口可能变更（鉴权策略、字段命名、返回结构）
- 当前以探测结果为准，正式部署前需进一步验证

### 9.2 反爬策略

- 迅雷可能存在反爬限制（频率限制、UA 检测、Cookie 等）
- adapter 内可根据需要添加 UA / Cookie / 频率控制；这些扩展由独立 spec 处理

### 9.3 凭据缺失（**post-v0.2.2**，不属于本次 `v0.2.2` 范围）

- 当前接口可能无需凭据，但实际部署可能发现需要
- adapter 已设计为接受 `credential: null`；扩展凭据池支持由独立 spec 处理，且需要先升级 `versioning.md` `v0.2.2` 范围或推迟到 post-`v0.2.2`

### 9.4 字段命名变化

- 迅雷原始字段（`cid` / `gcid` / `url` / `ext` / `name` / `duration` / `languages` / `source` / `score` / `fingerprintf_score` / `extra_name` / `mt`）可能在不同版本变化
- `raw` 字段保留全量原始数据，便于后续兼容

---

## 10. 参考资料

- `specs/004-multi-provider-search/spec.md`
- `specs/004-multi-provider-search/plan.md`
- `specs/004-multi-provider-search/data-model.md`
- `contracts/provider-adapter-contract.md`：provider 适配层契约
- `contracts/subtitle-search-response.md`：响应模型契约
- https://api-shoulei-ssl.xunlei.com/oracle/subtitle（迅雷字幕 provider 入口）
