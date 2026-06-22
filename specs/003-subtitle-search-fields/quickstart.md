# 快速上手: 字幕搜索接口扩展检索字段

**分支**: `003-subtitle-search-fields` | **日期**: 2026-06-22

## 前置条件

- Node.js + pnpm 已安装
- 仓库依赖已安装：`pnpm install`
- 本地环境变量已配置（`OPENSUBTITLES_API_URL` 等）

## 实现步骤

### 1. 扩展 route Zod schema

编辑 `src/app/api/subtitles/search/route.ts`，在 `searchParamsSchema` 新增 `imdb_id` / `tmdb_id` / `type` 字段，并添加跨字段冲突校验 `.refine()`。

### 2. 扩展 gateway 请求模型与定位路径分流

编辑 `src/server/subtitles/subtitle-gateway.ts`：
- `SubtitleSearchInput` 新增 `imdbId?` / `tmdbId?` / `type?`
- `buildSearchQuery` 重构为 `buildAdapterInput`，按 ID 字段是否存在分流

### 3. 扩展 adapter 参数映射

编辑 `src/server/providers/opensubtitles-adapter.ts`：
- `OpenSubtitlesSearchInput` 新增 `imdbId` / `tmdbId` / `season` / `episode` / `type`
- `search` 方法修改 `URLSearchParams` 构造，映射 SubHub 字段到上游参数

### 4. 更新 OpenAPI 契约

编辑 `docs/api/openapi.yaml`，在 `/api/subtitles/search` 的 `parameters` 新增 `imdb_id` / `tmdb_id` / `type`。

### 5. 重新生成 client

```bash
pnpm api:client
pnpm api:check
pnpm api:docs
```

### 6. 编写测试

- Unit: `tests/unit/subtitle-search-validation.test.ts`（校验逻辑 + `buildAdapterInput` 分流）
- Unit: `tests/unit/opensubtitles-adapter-params.test.ts`（adapter 参数映射）
- Contract: 扩展 `tests/contract/subtitles.contract.test.ts`（新字段 API 行为 + 兼容性）

### 7. 质量门禁

```bash
pnpm format:write
pnpm lint
pnpm typecheck
pnpm test
```

## 验证

### ID 定位路径

```bash
curl -H "Authorization: Bearer <caller-key>" \
  "http://localhost:3000/api/subtitles/search?title=Inception&imdb_id=tt1375666&language=en"
```

### 剧集单集定位

```bash
curl -H "Authorization: Bearer <caller-key>" \
  "http://localhost:3000/api/subtitles/search?title=Breaking%20Bad&tmdb_id=1396&season=1&episode=1&language=en&type=episode"
```

### query fallback（兼容性）

```bash
curl -H "Authorization: Bearer <caller-key>" \
  "http://localhost:3000/api/subtitles/search?title=Inception&year=2010&language=en"
```

### 跨字段冲突

```bash
curl -H "Authorization: Bearer <caller-key>" \
  "http://localhost:3000/api/subtitles/search?title=Inception&type=movie&season=1"
# 期望: 400 VALIDATION_FAILED
```
