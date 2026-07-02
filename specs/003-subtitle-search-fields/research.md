# 研究产物: 字幕搜索接口扩展检索字段

**分支**: `003-subtitle-search-fields` | **日期**: 2026-06-22

## 研究任务

### R-1: OpenSubtitles 上游对结构化 ID 检索的支持能力

**Decision**: OpenSubtitles REST API `/subtitles` 端点支持 `imdb_id`、`tmdb_id`、`season_number`、`episode_number`、`type`、`languages` 等 query 参数。

**Rationale**: 基于 OpenSubtitles 公开 API 文档，`/subtitles` 端点接受 `imdb_id`（格式 `tt` + 数字）、`tmdb_id`（数字）、`season_number`、`episode_number`、`type`（`movie` / `episode` / `all`）、`languages`（ISO 639-3 语言码）等参数。当传入 ID 参数时，上游优先按 ID 定位，`query` 作为辅助。

**Alternatives considered**:

- 仅用 `query` + `languages`（现状）：无法利用 ID 定位能力，命中率低
- 1:1 透传上游所有 params：违反 spec"不直接暴露上游所有原始 query params"约束

### R-2: 字段改名 breaking 风险评估

**Decision**: 保持现有命名 `season` / `episode` / `language` 不变，不改名为 `season_number` / `episode_number` / `languages`。

**Rationale**:

- 现有契约 `title` / `year` / `season` / `episode` / `language` 已对外发布，改名属于 breaking API 变更
- 宪章原则 IV 要求保持 API 一致性且避免 breaking
- 网关层已有命名映射职责（`season` → 上游 `season_number`），改名不影响实现能力
- 改名对齐上游的收益（命名一致性）不足以抵消 breaking 风险

**Alternatives considered**:

- 改名 + 提供兼容别名：增加 route 层校验复杂度，且属于 soft breaking
- 改名 + 明确 breaking：与 spec"不做 breaking API 变更"原则冲突

### R-3: `title` 字段是否改为 optional 以支持 ID-only 场景

**Decision**: 保持 `title` 为 required，不改为 optional。

**Rationale**:

- `title` 在审计表 `subtitleSearchRequests.mediaTitle` 中为 `NOT NULL`
- 将 `title` 改为 optional 涉及数据库 schema 变更，与 spec"不做新数据库 schema 设计"冲突
- 调用方传入 `imdb_id` 时仍可传 `title` 作为作品名用于审计；后端优先以 `imdb_id` 定位，`title` 不参与上游 query 构造

**Alternatives considered**:

- `title` 改 optional + 审计表 `mediaTitle` 改 nullable：涉及 schema 变更，超出本次范围
- `title` 改 optional 但审计时填默认值：语义不清，且仍属 breaking

### R-4: `imdb_id` 与 `tmdb_id` 同时存在时的优先级

**Decision**: `imdb_id` 优先，`tmdb_id` 作为辅助。

**Rationale**:

- IMDb ID 格式校验更严格（`tt` + 数字），语义更稳定
- IMDb 覆盖度更广（电影 + 剧集），TMDb 在剧集季集定位上更常用
- 两者同时存在时，上游会综合处理；SubHub 显式声明 `imdb_id` 优先以避免歧义

**Alternatives considered**:

- `tmdb_id` 优先：TMDb 在剧集场景更常用，但 IMDb 覆盖度更广
- 同时透传不声明优先级：语义不清，难以在测试中断言

### R-5: `type` 字段与季集字段冲突校验位置

**Decision**: 在 route 层 Zod schema 用 `.refine()` 实现跨字段冲突校验。

**Rationale**:

- route 层是唯一校验入口，冲突校验应在请求进入网关前完成
- Zod `.refine()` 支持跨字段校验，错误复用现有 `VALIDATION_FAILED` 路径
- 在 gateway 层校验会导致审计记录逻辑复杂化（需在记录前判断是否校验失败）

**Alternatives considered**:

- gateway 层校验：审计记录逻辑复杂化
- adapter 层校验：错误信息不可控，上游可能返回 400 而非 SubHub 统一错误结构

### R-6: 上游不支持某些字段时的降级策略

**Decision**: adapter 层始终把 SubHub 字段映射到上游参数并透传；若上游返回 400 或忽略未知参数，由现有 `UPSTREAM_FAILED` / `NO_RESULTS` 错误路径处理。

**Rationale**:

- 不在 adapter 层做上游能力探测或字段裁剪，避免增加复杂度与上游耦合
- 现有错误路径已能处理上游 400 与无结果场景
- 若上游对 `type` 支持不稳定，在后续 feature 中评估结果过滤

**Alternatives considered**:

- adapter 层上游能力探测：增加复杂度，且上游能力可能动态变化
- adapter 层字段裁剪：与"SubHub 稳定字段模型"理念冲突
