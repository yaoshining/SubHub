# TinySpec: 迅雷上游超时重试与超时配置化

**Branch**: feature/yaoshining-xunlei-timeout-retry
**Date**: 2026-08-16
**Status**: done
**Complexity**: small
**Issue**: #206 迅雷上游超时导致偶发 502 UPSTREAM_FAILED

## What

迅雷上游（xunlei）响应慢/抖动，网关 5s 超时不够导致偶发 502。给 `XunleiAdapter` 加超时/失败重试（默认重试 1 次）、放宽默认超时（5s → 8s），并把重试次数与超时做成环境变量可配置。

## Context

| File | Role |
|------|------|
| `src/server/providers/xunlei-adapter.ts` | 修改 — 加重试循环、放宽默认超时、读取配置 |
| `src/lib/env.ts` | 修改 — 新增 `XUNLEI_API_TIMEOUT_MS` / `XUNLEI_API_MAX_RETRIES` |
| `.env.example` | 修改 — 记录两个可选环境变量 |
| `tests/contract/xunlei-adapter.contract.test.ts` | 修改 — 加重试/不重试/配置化测试 |
| `src/server/providers/provider-adapter.ts` | 上下文 — `ProviderSearchOutcome` 错误 reason 语义 |

## Requirements

1. 单次请求失败（`timeout` 或 `upstream_failed`）时自动重试 1 次；重试后仍失败返回最后一次错误。
2. 重试成功后返回正常结果，对外与单次成功不可区分。
3. `authentication_failed`（401/403）与 `rate_limited`（429）不重试。
4. 默认超时由 5000ms 放宽到 8000ms。
5. 超时与重试次数可通过环境变量 `XUNLEI_API_TIMEOUT_MS`、`XUNLEI_API_MAX_RETRIES` 覆盖，缺失时使用默认值。

## Plan

1. 在 `env.ts` 的 schema / `AppEnv` / `readEnv` 增加 `XUNLEI_API_TIMEOUT_MS`（默认 8000）与 `XUNLEI_API_MAX_RETRIES`（默认 1），并在 `.env.example` 记录。
2. 将 `xunlei-adapter.ts` 现有单次 fetch 逻辑抽为私有 `searchAttempt`，返回 `ProviderSearchOutcome`。
3. 在 `search()` 中按 `maxRetries` 循环：结果 ok 直接返回；`timeout`/`upstream_failed` 且还有重试次数则重试；否则返回该错误。
4. 构造器新增 `maxRetries` 选项，默认读 `readEnv().XUNLEI_API_MAX_RETRIES`；`timeoutMs` 默认读 `readEnv().XUNLEI_API_TIMEOUT_MS`。
5. 补契约测试并跑全量相关测试。

## Tasks

- [x] `env.ts` 增加两个 env 字段与默认值，`.env.example` 记录
- [x] `xunlei-adapter.ts` 抽出 `searchAttempt` 单次请求方法
- [x] `search()` 实现可重试循环与 `maxRetries` 构造选项
- [x] 默认超时 5000 → 8000 并接入 env
- [x] 补测试：超时重试成功 / 5xx 重试成功 / 401、429 不重试 / 重试耗尽返回最后错误 / env 配置生效
- [x] 跑 `pnpm test` 相关套件与 lint/typecheck

## Done When

- [x] 全部任务勾选完成
- [x] `tests/contract/xunlei-adapter.contract.test.ts` 全绿
- [x] lint / typecheck 无错误
