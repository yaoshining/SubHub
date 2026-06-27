# Quickstart: 多字幕 provider 搜索入口模型基础版（含迅雷字幕 provider 接入）

**日期**: 2026-06-27
**对应 plan**: `specs/004-multi-provider-search/plan.md`
**对应 spec**: `specs/004-multi-provider-search/spec.md`

> 第 1 阶段产物。本文档给出 `v0.2.2` 端到端验证的可执行步骤。
> 实现细节不在此处展开，参考 `plan.md` 与 `data-model.md`。

---

## 1. 前置条件

### 1.1 仓库与分支

- 当前工作目录：`/Users/yaoshining/Workspaces/MyProjects/SubHub`
- 当前分支：`004-multi-provider-search`
- `feat`/`fix` worktree 由使用方按需创建；本文档假设在主 worktree 内验证。

### 1.2 环境

- Node.js 与包管理器：以 `package.json` 中 `packageManager` 字段为准；按 `.github/copilot-instructions.md` 仓库级约定使用 `pnpm`。
- 数据库：本地 Postgres 或 Neon Postgres（依据 `docs/runtime/environment-mapping.md`）
- 环境变量：以 `.env.example` 与 `src/lib/env.ts` 为准

### 1.3 凭据

- OpenSubtitles API 凭据：通过 SubHub Admin Console 配置至少 1 个 provider + 至少 1 个活跃 credential
- 迅雷字幕 provider：当前无需凭据；Provider 表中需存在 `type=xunlei` 的 provider 记录

### 1.4 数据库 schema

执行 migration 以扩展 `providerTypes` enum：

```bash
pnpm db:generate
pnpm db:migrate
```

预期：`providerTypes` enum 从 `["opensubtitles"]` 扩展为 `["opensubtitles", "xunlei"]`。

---

## 2. 准备 Provider 数据

### 2.1 OpenSubtitles Provider

确保至少 1 个 OpenSubtitles provider 处于 `enabled` 状态，且有 ≥ 1 个 `active` 凭据。

可通过 SubHub Admin Console 或直接通过数据库 / seed 脚本验证。

### 2.2 迅雷 Provider

确保 Provider 表中存在 1 条 `type=xunlei` 的记录，状态为 `enabled`：

- 若尚未配置，先在数据库中插入（或更新 `scripts/db/seed-dev.ts` 追加）：

```sql
INSERT INTO providers (id, name, type, status, priority, weight, concurrency_limit, rotation_enabled, cooldown_seconds, created_at, updated_at)
VALUES ('provider_xunlei_default', 'xunlei-default', 'xunlei', 'enabled', 100, 100, 1, true, 60, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

- 验证 provider 状态可调用：

```bash
pnpm --filter . tsx scripts/db/readiness.ts
```

预期输出包含 `provider_xunlei_default` 且状态为 `enabled`。

---

## 3. 端到端验证场景

### 3.1 场景 1：OpenSubtitles ID 定位路径（v0.2.1 行为回归）

**目的**: 验证 `v0.2.1` 风格的 IMDb ID 定位路径在 `v0.2.2` 多 provider 抽象下行为 100% 不变。

**步骤**:

1. 启动开发服务器：`pnpm dev`
2. 获取 caller key（通过 SubHub Admin Console 或 seed 数据）
3. 调用搜索接口：

```bash
curl -sS "http://localhost:3000/api/subtitles/search?title=tt0111161&imdb_id=tt0111161&language=en" \
  -H "Authorization: Bearer ${CALLER_KEY}"
```

**预期**:

- HTTP 200
- 响应 `data.results[].provider === "opensubtitles"`
- 响应 `data.status === "success"`
- 响应 `data.provider_failures` 不存在或为空

### 3.2 场景 2：迅雷 provider 名称检索

**目的**: 验证迅雷 provider 在收到 `query + language` 时能基于 `name + languages` 路径返回结果。

**步骤**:

```bash
curl -sS "http://localhost:3000/api/subtitles/search?title=test&query=权力的游戏&language=zh" \
  -H "Authorization: Bearer ${CALLER_KEY}"
```

**预期**:

- HTTP 200
- 响应 `data.results[]` 中至少包含 `provider === "xunlei"` 的结果
- 迅雷结果 `id` 格式为 `xunlei:{providerId}:{gcid}` 或 `xunlei:{providerId}:{cid}`
- 迅雷结果 `format` 来自 `ext` 字段（默认 `srt`）
- 迅雷结果 `raw` 字段保留 `cid` / `gcid` / `url` / `score` 等原始字段
- 响应 `data.status === "success"` 或 `partial`（取决于 OpenSubtitles 是否也有结果）

### 3.3 场景 3：单 provider 失败隔离

**目的**: 验证单 provider 失败不影响其他 provider。

**步骤**:

模拟迅雷 provider 上游 5xx：
- 临时修改迅雷 provider 上游 URL（构造 mock 故障），或
- 在数据库中暂时将迅雷 provider `availableCredentialCount` 设为 0（导致 gateway 跳过）：

```sql
UPDATE provider_credentials SET status = 'disabled' WHERE provider_id = 'provider_xunlei_default';
```

然后调用搜索接口：

```bash
curl -sS "http://localhost:3000/api/subtitles/search?title=tt0111161&imdb_id=tt0111161&language=en" \
  -H "Authorization: Bearer ${CALLER_KEY}"
```

**预期**:

- HTTP 200
- OpenSubtitles 结果正常返回
- 响应 `data.provider_failures[]` 含 `provider === "xunlei"` 与 `reason`（如 `upstream_failed` 或 `skipped_disabled`）
- 响应 `data.status === "partial"`（因为至少一个 provider 失败）

**恢复**（测试完成后）：

```sql
UPDATE provider_credentials SET status = 'active' WHERE provider_id = 'provider_xunlei_default';
```

### 3.4 场景 4：必要条件缺失跳过

**目的**: 验证迅雷 provider 在缺 `query` 或 `language` 时跳过而非报错。

**步骤**:

```bash
curl -sS "http://localhost:3000/api/subtitles/search?title=tt0111161&imdb_id=tt0111161" \
  -H "Authorization: Bearer ${CALLER_KEY}"
```

**预期**:

- HTTP 200
- OpenSubtitles 结果正常返回（基于 IMDb ID）
- 响应 `data.provider_failures[]` 含 `provider === "xunlei"` 与 `reason === "skipped_missing_fields"`
- 响应 `data.status === "success"`（OpenSubtitles 成功；迅雷跳过不计入失败）

### 3.5 场景 5：所有 provider 均失败

**目的**: 验证所有 provider 均失败时返回明确错误。

**步骤**:

临时禁用所有 provider：

```sql
UPDATE provider_credentials SET status = 'disabled';
```

然后调用搜索接口：

```bash
curl -sS "http://localhost:3000/api/subtitles/search?title=tt0111161&imdb_id=tt0111161&language=en" \
  -H "Authorization: Bearer ${CALLER_KEY}"
```

**预期**:

- HTTP 502
- 响应符合 `ErrorResponse` schema（统一错误结构）

**恢复**:

```sql
UPDATE provider_credentials SET status = 'active';
```

### 3.6 场景 6：老调用方零改动回归

**目的**: 验证 `v0.2.1` 风格的请求在 `v0.2.2` 多 provider 抽象下行为 100% 不变。

**步骤**:

```bash
curl -sS "http://localhost:3000/api/subtitles/search?title=The%20Shawshank%20Redemption&year=1994&language=en" \
  -H "Authorization: Bearer ${CALLER_KEY}"
```

**预期**:

- HTTP 200
- 响应结构与 `v0.2.1` 完全一致
- 响应 `data.results[].provider === "opensubtitles"`
- 响应 `data.status === "success"`
- 不出现 `data.provider_failures` 字段或为空数组

### 3.7 场景 7：provider 来源区分

**目的**: 验证多 provider 并存时，每个结果都可区分来源。

**步骤**:

构造一个同时能让 OpenSubtitles 与迅雷 provider 返回结果的请求：

```bash
curl -sS "http://localhost:3000/api/subtitles/search?title=The%20Shawshank%20Redemption&query=肖申克的救赎&language=zh&imdb_id=tt0111161" \
  -H "Authorization: Bearer ${CALLER_KEY}"
```

**预期**:

- HTTP 200
- 响应 `data.results[]` 中同时包含 `provider === "opensubtitles"` 与 `provider === "xunlei"` 的结果
- 每个结果的 `id` 前缀与 `provider` 一致

---

## 4. 测试套件运行

### 4.1 单元测试

```bash
pnpm test tests/unit/subtitle-result-normalizer.test.ts
pnpm test tests/unit/provider-registry.test.ts
```

**预期**: 全部通过

### 4.2 Contract 测试

```bash
pnpm test tests/contract/xunlei-adapter.contract.test.ts
pnpm test tests/contract/subtitles.contract.test.ts
pnpm test tests/contract/openapi-generated-client.test.ts
```

**预期**: 全部通过；`subtitles.contract.test.ts` 中的 `v0.2.1` 行为回归用例 MUST 100% 通过

### 4.3 Integration 测试

```bash
pnpm test tests/integration/multi-provider-isolation.test.ts
```

**预期**: 全部通过；覆盖多 provider 并存路径与单 provider 失败隔离

### 4.4 OpenAPI / generated 校验

```bash
pnpm api:check
```

**预期**: 通过；OpenAPI 真源与 generated client 同步

### 4.5 全量测试

```bash
pnpm test
```

**预期**: 全部通过；包括回归门禁

### 4.6 静态检查与格式化

```bash
pnpm lint
pnpm typecheck
pnpm format:write
```

**预期**: 全部通过

---

## 5. 验证清单

在提交 PR 前，确认以下清单逐项验证：

- [ ] 场景 1：OpenSubtitles ID 定位路径（v0.2.1 行为回归）通过
- [ ] 场景 2：迅雷 provider 名称检索通过
- [ ] 场景 3：单 provider 失败隔离通过
- [ ] 场景 4：必要条件缺失跳过通过
- [ ] 场景 5：所有 provider 均失败返回 502 通过
- [ ] 场景 6：老调用方零改动回归通过
- [ ] 场景 7：provider 来源区分通过
- [ ] 单元测试 / Contract 测试 / Integration 测试全部通过
- [ ] `pnpm api:check` 通过
- [ ] `pnpm lint` + `pnpm typecheck` + `pnpm format:write` 通过

---

## 6. 已知限制

`v0.2.2` 明确不实现以下能力，相关场景在本版本中不可验证：

- 并行调用 provider（首批仅串行）
- 跨 provider 评分编排 / 去重 / 排序
- Provider 熔断 / 自适应降级
- Fallback 链
- 字段改名（`season` → `season_number` 等）
- `filename` / `moviehash` / `hearing_impaired` / `foreign_parts_only` 字段暴露
- 手动上传字幕（属 `v0.3.0`）
- AI 字幕处理（属 `v0.4.0`）

---

## 7. 参考资料

- `specs/004-multi-provider-search/spec.md`：功能规格
- `specs/004-multi-provider-search/plan.md`：实施计划
- `specs/004-multi-provider-search/data-model.md`：数据模型
- `specs/004-multi-provider-search/research.md`：研究产物
- `specs/004-multi-provider-search/contracts/`：契约文件
- `docs/api/openapi.yaml`：API 契约真源
- `docs/runtime/environment-mapping.md`：运行时环境映射
- `.github/copilot-instructions.md`：仓库级约定
- `docs/releases/versioning.md`：版本约定
- https://api-shoulei-ssl.xunlei.com/oracle/subtitle：迅雷字幕 provider 入口
