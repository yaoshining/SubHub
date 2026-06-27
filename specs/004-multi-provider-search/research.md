# Research: 多字幕 provider 搜索入口模型基础版（含迅雷字幕 provider 接入）

**日期**: 2026-06-27
**对应 plan**: `specs/004-multi-provider-search/plan.md`
**对应 spec**: `specs/004-multi-provider-search/spec.md`

> 第 0 阶段产物。回答 plan 中标记为需研究 / 需澄清的技术问题。

---

## R-1. 迅雷字幕 provider 接口契约

### 决策

以 `https://api-shoulei-ssl.xunlei.com/oracle/subtitle` 为基线入口；已确认至少可工作的请求形式为 `?name=<剧名>&languages=<语言码>`（如 `name=权力的游戏&languages=简体`）。本计划首批字段映射仅覆盖 `name` 与 `languages`，不假设其他字段可用。

### Rationale

- 已探测到的现实约束：迅雷接口当前更像 `name + languages` 主路径；`filename` / `moviehash` 等结构化字段暂未确认可作为有效检索入口。
- 即使某些字段可传，也不代表迅雷 provider 会真正消费或稳定支持；这与 spec FR-3「字段可传 != provider 一定消费」的契约一致。
- 本计划对 `name` 与 `languages` 之外的字段采取"忽略而非报错"的策略，对应 plan §4.6。

### Alternatives considered

- **A. 假设所有 OpenSubtitles 字段都能在迅雷上消费**：被否决，因为没有真实接口探测证据；引入风险高。
- **B. 把所有未确认字段在 gateway 层提前剔除**：与本计划的「adapter 内部静默忽略」策略等价，但放在 gateway 会让 gateway 承担 provider 特定知识，违反 plan §4.5 的边界。
- **C. 引入 provider 配置描述文件（YAML/JSON）**：超出 `v0.2.2` 范围；首批以代码层 adapter 显式消费为准。

### 已知风险

- 迅雷接口的鉴权 / 反爬策略尚未完全确认；当前实现假设无需凭据（`XunleiAdapter.search` 接受 `credential: null`）；后续若发现需要凭据，独立 spec 处理。
- 迅雷返回的原始字段命名（`cid` / `gcid` / `url` / `ext` / `name` / `duration` / `languages` / `source` / `score` / `fingerprintf_score` / `extra_name` / `mt`）来自探测结果；可能在不同版本上游会变化。归一化逻辑保留 `raw` 字段，原始数据全量透传，便于后续兼容。

---

## R-2. provider 适配层抽象边界

### 决策

引入 `SubtitleProviderAdapter` 接口（`src/server/providers/provider-adapter.ts`）与轻量 `provider-registry.ts` 注册表；不引入插件化框架；不引入 provider 配置描述文件。

```ts
type SubtitleProviderKey = 'opensubtitles' | 'xunlei';

interface SubtitleProviderAdapter {
  readonly key: SubtitleProviderKey;
  search(
    credential: SelectedProviderCredential | null,
    input: SubtitleSearchInput,
    options: { fetchImpl?: typeof fetch; timeoutMs?: number }
  ): Promise<ProviderSearchOutcome>;
}
```

### Rationale

- 宪章原则 VI 要求"provider 集成 MUST 隔离在稳定接口之后，防止来源特定行为泄漏到核心 API"；抽象层是这一原则的具体落地。
- `v0.2.2` 仅需硬编码两个 provider key；引入插件化框架（如 dynamic import / DI 容器）超出范围。
- 轻量注册表是后续扩展的最小入口：新增 provider 仅需 `provider-registry.ts` 追加一行 + 实现 adapter。

### Alternatives considered

- **A. 把 provider 分支直接写进 `subtitle-gateway.ts`**：被否决，gateway 会承担 provider 特定知识（如"如何跳过迅雷"、"如何映射 name"），违反宪章原则 VI。
- **B. 引入 plugin system / dynamic provider loading**：超出 `v0.2.2` 范围，且会引入运行时安全风险。
- **C. 用 strategy pattern 通过配置切换 provider**：配置驱动会让 provider 能力差异难以在编译期暴露。

---

## R-3. provider 串行 vs 并行调用

### 决策

首批采用 **串行调用** provider；不引入并行调用；不引入超时预算。

### Rationale

- 实现简单：不需要 `Promise.all` / `AbortController` 协调，错误隔离逻辑清晰。
- 性能边界明确：串行调用的总耗时是各 provider 耗时之和，便于在 contract test 与 SC-002 中断言。
- 错误隔离清晰：每个 provider 调用独立 try/catch，不会因一个 provider 的 reject 影响其他 provider。
- 与 `.github/copilot-instructions.md` 强调的"简洁与可替换"约定一致。

### Alternatives considered

- **A. 并行调用 `Promise.all`**：被否决；首批优先追求实现简单；并行调用需要超时预算、优先级、部分结果合并策略，超出 `v0.2.2` 范围。
- **B. 串行 + 短路优化（第一个 provider 返回结果即跳过）**：被否决；这会引入"哪个 provider 优先"的主观决策；`v0.2.2` 保持所有 provider 一视同仁。
- **C. 并行调用 + 部分合并**：被否决；与 A 类似，超出范围。

### 后续

并行调用 / 超时预算 / 熔断放入 post-mvp 议题（独立 spec）。

---

## R-4. `providerTypes` enum 与 schema 变更（`v0.2.2` 不变更）

### 决策（`v0.2.2` 不变）

本次 `v0.2.2` **不**扩展 `providerTypes` enum、**不**新增 migration、不变更 `providers` / `provider_credentials` / `subtitle_search_requests` 表结构。迅雷 provider 走「不依赖数据库 schema 的最小接入路径」：provider key → adapter 映射由 `provider-registry.ts` 在代码层硬编码。迅雷 provider 的启用 / 禁用 / 限流 / 冷却等控制仅由代码层 feature flag / 环境变量决定，不依赖数据库持久化。

### Rationale

- `versioning.md` 明确 `v0.2.x` 不引入数据库 schema 变更，`v0.2.2` 作为 patch 版本必须遵守该边界。
- 在多 provider 架构收口过程中，数据库 schema 不应是阻碍因素：provider key 映射可以在代码层完成。
- 若在 `v0.2.2` 引入 schema 变更，会跨过 `v0.2.x → v0.3.0` 的边界，破坏 patch 版本约束。

### Alternatives considered

- **A. 把 provider type 改为字符串列 + 应用层 enum 校验**：被否决；牺牲数据库层校验能力，应用层校验有遗漏风险。
- **B. 扩展 enum（被否决于本次 `v0.2.2`）**：应作为 post-`v0.2.2` / `v0.3.0` 议题处理。
- **B. 不持久化迅雷 provider，代码层硬编码（被采纳于本次 `v0.2.2`）**：适配 `versioning.md` 中 `v0.2.x` 不变 schema 的约束；后续 `v0.3.0` 可考虑重考虑是否需持久化。
- **C. 引入独立 `xunlei_providers` 表**：被否决；`v0.2.2` 不新增数据库 schema。

### 未来路径

若后续需将迅雷 provider 元数据持久化（启用 / 禁用、priority、weight、concurrency limit、fallbackProviderId 等），必须由 post-`v0.2.2` 独立 spec 推进，且先升级 `versioning.md` 中 `v0.2.2` 范围（很可能升 `v0.3.0`），届时才允许扩展 `providerTypes` enum 与新增 migration
---

## R-5. `provider_failures` 暴露位置

### 决策

在 `SubtitleSearchData` 中新增 `provider_failures` 可选数组；`status` 扩展为 `success | partial`。

### Rationale

- 多 provider 错误隔离要求调用方可观测每个 provider 的状态；隐藏失败信息会让调用方无法判断"结果是否完整"。
- `provider_failures` 与 `results` 并存而非互斥：部分 provider 成功部分失败时，两者同时返回。
- `status: partial` 不阻塞 200 响应，符合"失败不拖垮整体搜索"的核心原则。
- 不暴露堆栈等敏感信息，仅结构化 `{ provider, reason, message }`。

### Alternatives considered

- **A. 仅在响应 header 中暴露**（如 `X-Subhub-Provider-Failures`）：被否决；调用方 SDK 处理 header 不便；header 也容易在中间件层丢失。
- **B. 在 body 顶层 `meta` 字段暴露**：与 `provider_failures` 等价；命名差异无实质影响；选 `provider_failures` 是因为语义更直接。
- **C. 完全不暴露，仅返回成功结果**：被否决；调用方无法区分"所有 provider 都成功"与"部分 provider 失败但有部分成功"。

### 回退

若 review 不同意暴露，见 plan §9.2。

---

## R-6. `downloadUrl` 统一性

### 决策

保持 `downloadUrl` 是 SubHub 网关统一下载入口（`/api/subtitles/download?subtitleId=...`）；迅雷原始 `url` 保留在 `raw.url`；download 路由根据 `subtitleId` 前缀判断 provider。

### Rationale

- 老调用方按 `v0.2.1` 行为消费 `downloadUrl`（GET 路径）；保持入口一致避免破坏。
- 网关统一下载入口让 client 端逻辑保持简单（无需根据 `provider` 字段切换 URL）。
- 迅雷原始 `url` 保留在 `raw.url` 用于审计 / 调试 / 后续直接访问场景。

### Alternatives considered

- **A. provider 各自暴露不同下载路径**：被否决；client 端需要根据 `provider` 切换逻辑，破坏一致性。
- **B. 直接返回迅雷原始 `url`**：被否决；会破坏 `downloadUrl` 的语义（统一入口）；也会暴露上游 URL，增加审计难度。

### 回退

若 review 不同意统一入口，见 plan §9.3。

---

## R-7. 字段命名保持现状 vs 升级为上游语义

### 决策

`v0.2.2` 保持现状命名（`season` / `episode` / `language`），不升级为 `season_number` / `episode_number` / `languages`。

### Rationale

- `v0.2.1` 已明确保持现状命名以避免 breaking；`v0.2.2` 是 patch 级版本延续。
- 字段改名涉及 breaking API 变更，需要独立 spec + 兼容层（dual-write / alias）。
- 当前对外契约（`season` / `episode` / `language`）已被 `v0.2.1` 调用方使用；改名的 ROI 在 patch 阶段不值得。
- gateway 内部命名映射职责可以继续承担"与上游语义对齐"的工作（如 `season → 上游 season_number`）。

### Alternatives considered

- **A. 在 `v0.2.2` 同步升级命名**：被否决；breaking 风险不符合 patch 阶段约束。
- **B. 引入 dual-write（同时接受 `season` 与 `season_number`）**：被否决；超出 `v0.2.2` 范围；dual-write 的语义、优先级、迁移路径需要独立 spec 设计。

### 后续

字段改名阶段由独立 spec 推进，需包括 dual-write、迁移指南、客户端版本兼容矩阵。

---

## R-8. 凭据池是否对迅雷 provider 开放

### 决策

`v0.2.2` 迅雷 provider **不接入凭据池**；`XunleiAdapter.search` 接受 `credential: null`；gateway 不为迅雷 provider 调用 `selectProviderCredential`。

### Rationale

- 当前迅雷接口可能无需凭据（待实际部署验证）；过早接入凭据池会增加复杂度。
- 凭据池行为与 provider 失败语义、冷却策略、限流策略耦合；迅雷 provider 在这些策略上的需求尚未明确。
- 独立 adapter 保持 provider 边界清晰，便于后续按需扩展。

### Alternatives considered

- **A. 迅雷 provider 复用 OpenSubtitles 凭据池**：被否决；provider 隔离被破坏，凭据池语义被扭曲。
- **B. 引入独立迅雷凭据池**：超出 `v0.2.2` 范围；引入新 schema 与新调度逻辑。
- **C. 接入凭据池但仅作为可选凭据存储**：被否决；语义模糊，且当前无需。

### 后续

若实际部署发现迅雷接口需要凭据，由独立 spec 推进凭据池接入。

---

## R-9. 老调用方兼容性的回归门禁

### 决策

在 `tests/contract/subtitles.contract.test.ts` 中固定 `v0.2.1` 行为作为非 breaking 回归门禁；CI 强制执行。

### Rationale

- 宪章原则 IV 要求"对外 API 在不同 Provider 下 MUST 保持可预期行为"。
- `v0.2.1` 行为已上线被调用方依赖；任何破坏性变化 MUST 在 contract test 层面暴露。
- 多 provider 抽象引入的隐性变化（调度顺序、响应字段顺序、错误码）需要回归测试覆盖。

### Alternatives considered

- **A. 仅依赖集成测试覆盖**：被否决；集成测试可能受环境因素影响，回归门禁需要确定性更高的 contract test。
- **B. 仅依赖人工 review**：被否决；自动化测试更可靠。

---

## R-10. 文档同步链路

### 决策

API 契约链路遵循 `.github/copilot-instructions.md` 的 OpenAPI / Orval / Scalar 约定：

- 真源：`docs/api/openapi.yaml`
- 生成：`pnpm api:client` 重新生成 `src/lib/api/generated/`
- 展示：`/docs/api`（Scalar）
- 校验：`pnpm api:check`

### Rationale

- 仓库级约定已明确，遵循即可避免自创路径。
- OpenAPI 是契约真源，generated client 是消费契约，Scalar 是文档展示；三者 MUST 同步。
- `pnpm api:check` 是 CI 强制执行的契约链路校验脚本。

### Alternatives considered

- 无（仓库级约定已锁定）。

---

## R-11. 性能预算的可达性

### 决策

性能预算：
- 单 provider 搜索 p95 延迟 MUST 不高于 `v0.2.1` 同路径
- 多 provider 串行调用端到端 p95 SHOULD 不高于"单 provider 最慢者 + 1s"
- 单 provider 失败 MUST 不引入额外串行阻塞（快速失败）

### Rationale

- 串行调用的总耗时理论上是各 provider 耗时之和；预留 1s 缓冲用于网络抖动与失败快速返回。
- 单 provider 失败的快速失败通过 adapter 内部的 timeout（5000ms 默认）+ try/catch 包裹实现。

### Alternatives considered

- **A. 引入并行调用以降低端到端延迟**：超出 `v0.2.2` 范围；待 post-mvp。
- **B. 引入 provider 优先级（优先调用最快 provider）**：被否决；引入主观决策。

---

## R-12. 测试分层与数据库测试选型

### 决策

遵循 `.github/copilot-instructions.md` 的数据库测试分层约定：

- 单元测试（provider 选择、字段映射、归一化、错误隔离）：mock / no-db
- contract 测试（聚合 API 行为、provider 来源字段）：PGlite 或 mock（取决于具体测试点）
- integration 测试（多 provider 并存路径与单 provider 失败隔离）：真实 Postgres（CI）

### Rationale

- 仓库级约定明确 PGlite 是"快速数据库单测层"，不替代真实 Postgres / Neon 验证。
- 单元测试不依赖数据库，用 mock 即可。
- contract 测试若涉及 provider 元数据存储，可考虑 PGlite；但当前 provider 元数据在 `v0.2.2` 多由 adapter 内部硬编码，contract test 可用 mock。
- integration 测试覆盖端到端的多 provider 并存与失败隔离，保留真实 Postgres 链路。

### Alternatives considered

- 无（仓库级约定已锁定）。

---

## R-13. 与 `v0.2.1` 的边界保护

### 决策

在 `v0.2.2` 实施过程中明确以下保护：

1. **OpenSubtitles adapter 内部逻辑 MUST 100% 等价**于 `v0.2.1`；不允许重构 OpenSubtitles 调用逻辑，仅调整接口形态以适配 `SubtitleProviderAdapter`。
2. **`buildSearchQuery` 与 `buildAdapterInput` 行为 MUST 不变**；可在新 gateway 内复用，但不得修改语义。
3. **凭据池行为（`markCredentialUsed` / `markCredentialFailure` / `syncProviderFailureState`） MUST 不变**。
4. **route Zod schema MUST 不引入新必填字段**；`query` 作为可选字段透传即可。

### Rationale

- 宪章原则 IV 与 spec FR-10 要求不引入 breaking API 变更。
- `v0.2.1` 的 contract test 是回归门禁，任何破坏性变化 MUST 被测试捕获。

### Alternatives considered

- **A. 在 `v0.2.2` 中重构 OpenSubtitles adapter 以适配新接口**：被否决；重构 OpenSubtitles adapter 的代价是引入回归风险。
  - 但若为了适配 `SubtitleProviderAdapter` 接口形态，OpenSubtitles adapter 内部需要调整方法签名（如 `search(credential, input, options)` vs `search(credential, input)`）；这种接口形态调整 MUST 通过等价性测试验证。

---

## 待补充研究

以下议题不在 `v0.2.2` 范围内，留作 post-mvp：

- 并行调用策略与超时预算
- 跨 provider 评分编排 / 去重 / 排序
- Provider 熔断与自适应降级
- Fallback 链（`providers.fallbackProviderId` 字段已存在但未启用）
- 字段改名阶段的 dual-write 与迁移指南
- 第三方 provider 注册中心 / 插件化框架
- 迅雷 provider 凭据池接入（如实际部署需要）

---

## 参考资料

- `docs/api/openapi.yaml`（OpenAPI 真源）
- `src/server/subtitles/subtitle-gateway.ts`（当前单 provider 网关）
- `src/server/providers/opensubtitles-adapter.ts`（OpenSubtitles 适配器）
- `src/server/providers/credential-pool.ts`（凭据池抽象）
- `src/server/providers/provider-repository.ts`（Provider 仓库）
- `src/server/storage/schema.ts`（`providerTypes` enum）
- `src/app/api/subtitles/search/route.ts`（route Zod schema）
- `tests/contract/subtitles.contract.test.ts`（现有契约测试）
- `specs/003-subtitle-search-fields/spec.md`（`v0.2.1` 规格）
- `docs/releases/versioning.md`（版本约定）
- `.github/copilot-instructions.md`（仓库级约定）
- `.specify/memory/constitution.md`（宪章）
- https://api-shoulei-ssl.xunlei.com/oracle/subtitle（迅雷字幕 provider 入口）
