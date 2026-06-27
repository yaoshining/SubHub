# Contract: Provider Adapter Interface

**日期**: 2026-06-27
**对应 plan**: `specs/004-multi-provider-search/plan.md`
**对应 spec**: `specs/004-multi-provider-search/spec.md`

> 第 1 阶段产物。本文档定义 `v0.2.2` provider 适配层接口契约。

---

## 1. 概述

`v0.2.2` 引入 `SubtitleProviderAdapter` 接口，作为 SubHub 聚合搜索 gateway 与 provider 实现之间的稳定边界。该接口：

- 隔离 provider 特定行为（字段映射、凭据处理、响应解析）到 adapter 内部
- 让 gateway 仅依赖统一的接口形态，避免承担 provider 特定知识
- 表达 provider 三种返回语义：成功、失败、跳过（必要条件缺失）

---

## 2. 接口定义

### 2.1 `SubtitleProviderKey`

```ts
type SubtitleProviderKey = "opensubtitles" | "xunlei";
```

> `v0.2.2` 首批两个 provider；后续扩展通过 provider-registry 追加。

### 2.2 `ProviderSearchResult`

adapter 返回的 provider 内原始结果：

```ts
type ProviderSearchResult = {
  id: string;                                    // provider 内字幕 ID
  language: string | null;
  releaseName: string | null;
  format: string;                                // 字幕格式（srt / ass / sub）
  downloadUrl: string | null;                    // provider 原始 URL；OpenSubtitles 为 null（走 SubHub 网关）
  raw?: Record<string, unknown>;                 // provider 原始字段（仅 adapter 内部使用）
  score?: number | null;                         // provider 原始评分（迅雷透传 score）
};
```

### 2.3 `ProviderSearchOutcome`

adapter 三种返回语义：

```ts
type SkippedReason =
  | "missing_required_field"                     // 必要条件字段缺失（如迅雷缺 query / languages）
  | "disabled"                                    // provider 被禁用
  | "credential_missing";                         // 凭据缺失

type ProviderSearchError = {
  reason: "upstream_failed" | "timeout" | "rate_limited" | "authentication_failed";
  message: string;                                // 不含堆栈
};

type ProviderSearchOutcome =
  | { ok: true; skipped: false; results: ProviderSearchResult[] }
  | { ok: false; skipped: false; error: ProviderSearchError }
  | { ok: true; skipped: true; reason: SkippedReason; results: [] };
```

### 2.4 `SubtitleProviderAdapter`

```ts
interface SubtitleProviderAdapter {
  readonly key: SubtitleProviderKey;

  search(
    credential: SelectedProviderCredential | null,
    input: SubtitleSearchInput,
    options?: { fetchImpl?: typeof fetch; timeoutMs?: number }
  ): Promise<ProviderSearchOutcome>;
}
```

- `credential` 为 `null` 表示 provider 当前无需凭据（迅雷场景）；OpenSubtitles 必须非空
- `input` 是 SubHub 聚合请求模型 `SubtitleSearchInput`；adapter 内部按需消费
- `options.fetchImpl` 用于测试注入 mock fetch
- `options.timeoutMs` 用于覆盖默认超时（默认 5000ms）

---

## 3. 适配器实现约定

### 3.1 字段消费约定

- adapter MUST 仅消费其支持的字段；不支持字段 MUST 静默忽略（不传上游、不 warn、不计入错误）
- adapter MUST 把 provider 原始响应解析为 `ProviderSearchResult` 形态
- adapter MUST NOT 感知其他 provider 的存在
- adapter MUST NOT 直接与数据库交互；凭据、审计由 gateway 统一处理

### 3.2 必要条件处理

当 adapter 缺少"必须"字段时：

```ts
// 例如：迅雷 provider 缺少 query
if (!input.query?.trim()) {
  return {
    ok: true,
    skipped: true,
    reason: "missing_required_field",
    results: [],
  };
}
```

gateway 收到 `skipped: true` 后 MUST：

- 不计入错误
- 不记录到 `provider_failures`（除非原因需要记录）
- 继续处理其他 provider

### 3.3 错误处理

adapter 内部 MUST 用 try/catch 包裹上游调用：

```ts
try {
  const upstreamResults = await fetchUpstream(input);
  return {
    ok: true,
    skipped: false,
    results: upstreamResults.map(toProviderSearchResult),
  };
} catch (error) {
  return {
    ok: false,
    skipped: false,
    error: {
      reason: classifyError(error),
      message: summarizeError(error),
    },
  };
}
```

- adapter MUST 不抛出未处理错误（所有错误 MUST 转为 `ProviderSearchOutcome`）
- adapter MUST 不在错误信息中暴露堆栈
- `reason` 字段 MUST 落在预定义枚举内

### 3.4 超时处理

adapter MUST 实现超时控制（默认 5000ms）：

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
try {
  const response = await fetch(url, { signal: controller.signal });
  // ...
} catch (error) {
  if (error.name === "AbortError") {
    return {
      ok: false,
      skipped: false,
      error: { reason: "timeout", message: "上游请求超时" },
    };
  }
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

---

## 4. provider-registry 轻量注册表

```ts
// src/server/providers/provider-registry.ts
const adapters: Record<SubtitleProviderKey, SubtitleProviderAdapter> = {
  opensubtitles: new OpenSubtitlesAdapter(),
  xunlei: new XunleiAdapter(),
};

export function getAdapter(key: SubtitleProviderKey): SubtitleProviderAdapter {
  return adapters[key];
}

export function listProviderKeys(): SubtitleProviderKey[] {
  return Object.keys(adapters) as SubtitleProviderKey[];
}
```

- 不引入插件化框架；首批硬编码两个 provider key
- 后续扩展 provider 仅需：
  1. 在 `SubtitleProviderKey` 联合类型追加新 key
  2. 实现 `SubtitleProviderAdapter` 接口
  3. 在 `provider-registry.ts` 注册新 adapter
- 若数据库层也需要支持新 provider type，则同步扩展 `providerTypes` enum

---

## 5. gateway 调用约定

### 5.1 串行调用

```ts
for (const providerKey of providerKeys) {
  const adapter = getAdapter(providerKey);
  const credential = await selectCredential(providerKey); // OpenSubtitles；迅雷为 null

  let outcome: ProviderSearchOutcome;
  try {
    outcome = await adapter.search(credential, input);
  } catch (unexpectedError) {
    // adapter MUST NOT 抛错，但作为防御性兜底
    outcome = {
      ok: false,
      skipped: false,
      error: { reason: "upstream_failed", message: "adapter 内部错误" },
    };
  }

  if (outcome.skipped) {
    // 不计入失败
    continue;
  }

  if (!outcome.ok) {
    providerFailures.push({
      provider: providerKey,
      reason: mapToPublicReason(outcome.error.reason),
      message: outcome.error.message,
    });
    continue;
  }

  for (const result of outcome.results) {
    aggregatedResults.push(normalize(providerKey, result));
  }
}
```

### 5.2 凭据池隔离

- OpenSubtitles：gateway MUST 调用 `selectProviderCredential`；调用后 MUST 走 `markCredentialUsed` / `markCredentialFailure`
- 迅雷：gateway MUST 传 `credential: null`；不操作凭据池

### 5.3 错误分类映射

adapter 返回的 `error.reason`（adapter 内部语义）映射到对外 `ProviderFailureInfo.reason`：

| adapter `error.reason` | 对外 `ProviderFailureInfo.reason` |
|------------------------|-----------------------------------|
| `upstream_failed` | `upstream_failed` |
| `timeout` | `timeout` |
| `rate_limited` | `rate_limited` |
| `authentication_failed` | `authentication_failed` |

adapter `outcome.skipped` 映射：

| adapter `outcome.skipped.reason` | 对外 `ProviderFailureInfo.reason` |
|----------------------------------|-----------------------------------|
| `missing_required_field` | `skipped_missing_fields` |
| `disabled` | `skipped_disabled` |
| `credential_missing` | `skipped_disabled` |

---

## 6. 各 provider 适配器实现要求

### 6.1 `OpenSubtitlesAdapter`

- 必须实现 `SubtitleProviderAdapter` 接口
- 沿用 `v0.2.1` 已落地的字段映射（`query` / `imdb_id` / `tmdb_id` / `season` / `episode` / `language` / `type` / `year`）
- `credential` 必须非空（OpenSubtitles 必须有凭据）
- `query` < 3 字符时 MUST 不透传上游（避免触发凭据池降级）
- 凭据池行为（`markCredentialUsed` / `markCredentialFailure`） MUST 在 gateway 侧处理；adapter 不直接操作

### 6.2 `XunleiAdapter`

- 必须实现 `SubtitleProviderAdapter` 接口
- 仅消费 `query`（映射 `name`）与 `language`（映射 `languages`）
- 其他字段（`imdb_id` / `tmdb_id` / `season` / `episode` / `type` / `year` / `title`） MUST 静默忽略
- 必要条件缺失（`query` 或 `languages` 为空） MUST 返回 `{ skipped: true, reason: 'missing_required_field' }`
- `credential` 接受 `null`（当前接口可能无需凭据）
- 入口：`https://api-shoulei-ssl.xunlei.com/oracle/subtitle`

详见 `xunlei-provider-quirks.md`。

---

## 7. 错误隔离保证

| 场景 | 行为 |
|------|------|
| adapter 抛出未处理错误 | gateway 防御性兜底，视为 `upstream_failed` |
| 上游返回 5xx | adapter 捕获，返回 `upstream_failed` |
| 上游返回 4xx | adapter 捕获，分类（如 401 → `authentication_failed`、429 → `rate_limited`） |
| 上游超时 | adapter 返回 `timeout` |
| 必要条件缺失 | adapter 返回 `skipped: true` |
| 上游返回非预期响应结构 | adapter 解析失败，返回 `upstream_failed` |

---

## 8. 测试约定

### 8.1 adapter 单元测试

- 字段消费：仅传入 `query` + `language`，验证上游 URL 正确
- 字段忽略：传入 `imdb_id` 等不消费字段，验证上游 URL 不包含
- 必要条件缺失：传入 `query` 空，验证返回 `skipped: true`
- 上游 5xx：mock fetch 返回 5xx，验证 adapter 返回 `upstream_failed`
- 上游超时：mock fetch 延迟，验证 adapter 返回 `timeout`

### 8.2 gateway 编排测试

- 多 provider 串行：mock 所有 adapter，验证调用顺序与结果合并
- 单 provider 失败：mock 一个 adapter 失败，验证其他 adapter 继续工作
- 单 provider 跳过：mock adapter 返回 skipped，验证不计入失败

### 8.3 contract 测试

- `provider_failures` 结构与 OpenAPI schema 一致
- `status: partial` / `status: success` 区分正确

---

## 9. 适配器扩展流程（post-mvp）

新增 provider 的步骤：

1. 在 `SubtitleProviderKey` 联合类型追加新 key
2. 在 `provider-registry.ts` 注册新 adapter 实例
3. 在 `src/server/providers/` 创建新 adapter 文件，实现 `SubtitleProviderAdapter` 接口
4. 若需要数据库持久化，扩展 `providerTypes` enum + 编写 Drizzle migration
5. 若需要凭据池，扩展凭据池逻辑（独立 spec）
6. 编写单元测试 / contract 测试
7. 更新 OpenAPI 与 generated client
8. 更新文档（本 contracts/ 目录）

---

## 10. 参考资料

- `specs/004-multi-provider-search/spec.md`
- `specs/004-multi-provider-search/plan.md`
- `specs/004-multi-provider-search/data-model.md`
- `contracts/subtitle-search-request.md`
- `contracts/subtitle-search-response.md`
- `contracts/xunlei-provider-quirks.md`
- `src/server/providers/opensubtitles-adapter.ts`（现有实现参考）
