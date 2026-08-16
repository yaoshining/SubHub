# Changelog

本文件记录 SubHub 面向使用者的重要变更。版本规划见 [版本约定](docs/releases/versioning.md)，每个版本的详细说明见 [`docs/releases/`](docs/releases/)。

## [Unreleased]

### 修复

- 缓解迅雷上游（xunlei）响应抖动导致的偶发 `502 UPSTREAM_FAILED`：增加失败/超时自动重试（默认 1 次）与指数退避，放宽默认超时（5s → 8s），并将超时、重试次数与退避基数做成环境变量可配置（`XUNLEI_API_TIMEOUT_MS` / `XUNLEI_API_MAX_RETRIES` / `XUNLEI_API_RETRY_BACKOFF_MS`）。

## [v0.2.3] - 2026-07-19

### 新增

- Provider 管理台支持统一查看和管理 OpenSubtitles 与迅雷：可查看状态与健康信息、启用或禁用 Provider，并维护基础调度配置。
- 新增两步式 OpenSubtitles Provider 创建流程；迅雷作为受限的预置单实例，不允许通过界面重复创建。
- 管理后台新增“字幕 API 验证”工作台，用于管理员诊断字幕 Provider 的能力、配置、搜索与下载校验结果。

### 改进

- 根据 Provider 类型展示对应能力与限制，避免将迅雷误解为需要凭据池的 OpenSubtitles 实例。
- Dashboard 摘要卡片内联展示系统就绪状态，改善首屏信息关联性。
- 提升 Provider 管理页面及 CI 定向测试在资源紧张环境中的稳定性。

### 文档

- 校准 Provider 管理页面规范、README 与 API 文档，完成 v0.2.3 范围内的发布质量验证。

## [v0.2.2] - 2026-06-30

- 建立多 Provider 聚合字幕搜索模型，并接入迅雷字幕 Provider。
- 支持 Provider 结果归一化、来源标识、失败隔离及最小 fallback/聚合策略。
- 统一下载路由支持迅雷下载链接解析，并同步 OpenAPI 与生成客户端。

## [v0.2.1] - 2026-06-23

- 字幕搜索 API 新增 `imdb_id`、`tmdb_id` 和 `type` 结构化检索字段。
- 明确结构化字段的校验边界及不同 Provider 的能力差异。

## [v0.2.0] - 2026-06-15

- 完成 Neon Postgres 与 Vercel 运行时、环境映射、迁移和部署就绪链路的生产化基线。

## [v0.1.0] - 2026-05-31

- 发布首个管理控制台 MVP：认证、Dashboard、Providers、API Keys、Users、Settings，以及统一字幕查询与下载出口。

[Unreleased]: https://github.com/yaoshining/SubHub/compare/v0.2.3...HEAD
[v0.2.3]: https://github.com/yaoshining/SubHub/compare/v0.2.2...v0.2.3
[v0.2.2]: https://github.com/yaoshining/SubHub/compare/v0.2.1...v0.2.2
[v0.2.1]: https://github.com/yaoshining/SubHub/compare/v0.2.0...v0.2.1
[v0.2.0]: https://github.com/yaoshining/SubHub/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/yaoshining/SubHub/releases/tag/v0.1.0
