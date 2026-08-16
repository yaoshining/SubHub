# TinySpec: 迅雷上游超时重试与超时配置化

**Branch**: feature/yaoshining-xunlei-timeout-retry
**Date**: 2026-08-16
**Status**: done
**Complexity**: small
**Issue**: #206 迅雷上游超时导致偶发 502 UPSTREAM_FAILED

## What

迅雷上游（xunlei）响应慢/抖动，网关 5s 超时不够导致偶发 502。给 `XunleiAdapter` 加超时/失败重试（默认重试 1 次，指数退避）、放宽默认超时（5s → 8s），并把超时/重试/退避做成环境变量可配置。

## Context

| File | Role |
|------|------|
| `src/server/providers/xunlei-adapter.ts` | 修改 — 加重试循环与指数退避、放宽默认超时 |
| `src/server/providers/provider-registry.ts` | 修改 — 工厂构造时从 env 注入超时/重试/退避配置 |
| `src/lib/env.ts` | 修改 — 新增 `XUNLEI_API_TIMEOUT_MS` / `XUNLEI_API_MAX_RETRIES` / `XUNLEI_API_RETRY_BACKOFF_MS` |
| `.env.example` | 修改 — 记录三个可选环境变量 |
| `tests/contract/xunlei-adapter.contract.test.ts` | 修改 — 加重试/不重试/退避测试 |
| `tests/unit/env/read-env.test.ts` | 修改 — 覆盖 xunlei env 解析与默认值 |
| `src/server/providers/provider-adapter.ts` | 上下文 — `ProviderSearchOutcome` 错误 reason 语义 |

## Requirements

1. 单次请求失败（`timeout` 或 `upstream_failed`）时自动重试 1 次；重试后仍失败返回最后一次错误。
2. 重试成功后返回正常结果，对外与单次成功不可区分。
3. `authentication_failed`（401/403）与 `rate_limited`（429）不重试。
4. 默认超时由 5000ms 放宽到 8000ms。
5. 重试之间加入指数退避（基数 200ms、上限 2000ms），避免上游过载时雪上加霜。
6. 超时/重试/退避通过环境变量 `XUNLEI_API_TIMEOUT_MS`、`XUNLEI_API_MAX_RETRIES`、`XUNLEI_API_RETRY_BACKOFF_MS` 覆盖；在 `provider-registry` 工厂构造时注入，构造函数不调用 `readEnv()`。

## Plan

1. 在 `env.ts` 的 schema / `AppEnv` / `readEnv` 增加三个 `XUNLEI_*` 字段（默认 8000 / 1 / 200），并在 `.env.example` 记录。
2. 将 `xunlei-adapter.ts` 现有单次 fetch 逻辑抽为私有 `searchAttempt`，返回 `ProviderSearchOutcome`。
3. 在 `search()` 中按 `maxRetries` 循环：结果 ok 直接返回；`timeout`/`upstream_failed` 且还有重试次数则 `sleep` 指数退避后重试；否则返回该错误。
4. 构造器新增 `maxRetries` / `retryBackoffMs` 选项，默认取常量；`provider-registry` 工厂用 `readEnv()` 注入 env 值。
5. 补契约测试并跑全量相关测试。

## Tasks

- [x] `env.ts` 增加三个 `XUNLEI_*` 字段与默认值，`.env.example` 记录
- [x] `xunlei-adapter.ts` 抽出 `searchAttempt` 单次请求方法
- [x] `search()` 实现可重试循环、指数退避与 `maxRetries` / `retryBackoffMs` 选项
- [x] `provider-registry.ts` 工厂注入 env 配置，构造函数不再调用 `readEnv()`
- [x] 默认超时 5000 → 8000 并接入 env
- [x] 补测试：超时重试成功 / 5xx 重试成功 / 401、429 不重试 / 重试耗尽 / 退避等待 / env 解析与默认值
- [x] 跑 `pnpm test` 相关套件与 lint/typecheck

## Done When

- [x] 全部任务勾选完成
- [x] `tests/contract/xunlei-adapter.contract.test.ts` 全绿
- [x] lint / typecheck 无错误
