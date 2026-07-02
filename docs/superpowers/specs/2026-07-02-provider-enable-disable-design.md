# Provider Enable/Disable & Gateway Participation Design

> 对应 Issue: [#158](https://github.com/yaoshining/SubHub/issues/158)
> 目标版本: v0.2.3 | Scope: P2-B | 优先级: P0

---

## 1. 架构设计

### 1.1 分层职责

```
┌─────────────────────────────────────────────────┐
│                   Gateway                         │
│   仅消费"已归一化后的可用 provider 列表"            │
│   负责调度与调用，不做启停判断                      │
└──────────────────────┬──────────────────────────┘
                       │ candidates[]
┌──────────────────────▼──────────────────────────┐
│          Service / Repository                     │
│   从 providers 表读取 status，产出可调度列表       │
│   disabled provider 不进入 candidate               │
│   OS 无凭据时 enable 失败                          │
└──────────────────────┬──────────────────────────┘
                       │ 读写
┌──────────────────────▼──────────────────────────┐
│           providers 表（唯一真源）                  │
│   status 字段：enabled / disabled / needs_config   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│           Provider Registry                      │
│   退化：type → adapter 映射，不再承载启停判断     │
└─────────────────────────────────────────────────┘
```

**关键约束**:
- providers 表是 provider status 的**唯一真源**，任何启停变更通过 repository → service 写入 DB
- gateway 不再查询 DB、不再过滤 status、不再内置启停判断
- provider-registry 只负责 type → adapter 映射，不承载任何启停逻辑

### 1.2 调度过滤语义

| 条件 | gateway 行为 |
|------|-------------|
| provider status = `disabled` | 不进入 candidate 列表 |
| provider status = `disabled` 且搜索中 | 不调用 adapter，不写入 `provider_failures[]` |
| 所有 provider 均为 disabled | 返回明确错误（非空结果） |
| 重新 enable | 恢复调度，进入下次候选 |
| Xunlei 无凭据时 enable | 允许（Xunlei 可以在运行时发现无凭据） |
| OS 无 active credential 时 enable | 失败，返回明确错误 |

---

## 2. API 契约

### 2.1 Enable / Disable

```
POST /api/admin/providers/{providerId}/enable
POST /api/admin/providers/{providerId}/disable
```

**成功响应 (200)**:
```json
{
  "id": "provider-id",
  "type": "opensubtitles",
  "status": "enabled",
  "priority": 100,
  "weight": 1,
  "healthStatus": "unknown",
  "lastHealthCheckedAt": null,
  "lastErrorSummary": null,
  // ... 其余 provider 字段
}
```

**错误响应**:
- `400` — OS enable 但无 active credential，body: `ErrorResponse`
- `404` — provider 不存在
- `409` — 当前状态已经是目标状态

### 2.2 PATCH 保持现有 `PATCH /api/admin/providers/{providerId}` 用于更新非 status 字段

---

## 3. 前端交互

### 3.1 交互流程

```
用户点击启用/禁用
  │
  ▼
弹出确认弹窗（高风险动作必须可见）
  │
  ▼ [确认]
操作按钮 → pending 状态（disabled）
  │
  ▼ [POST enable/disable]
┌────── 成功 ──────┐  ┌────── 失败 ──────┐
│                   │  │                   │
│ 即时更新状态标签    │  │ Toast 显示错误    │
│ 不刷新页面         │  │ 保持原 UI 状态    │
│ 不进入 dirty state │  │ 按钮恢复可用      │
└───────────────────┘  └───────────────────┘
```

### 3.2 约束

- 启停前必须有确认弹窗
- 请求 pending 期间按钮 disabled
- **非乐观更新**：以服务端成功响应为准
- 成功后即时更新状态，不依赖整页刷新
- 失败时 toast + 保持原状态，不进入 dirty state
- 启停操作不影响当前正在编辑的草稿配置

---

## 4. 测试计划

| Task | 文件 | 覆盖内容 |
|------|------|---------|
| T017 | `tests/unit/providers/provider-service.test.ts` | OS 无凭据 enable 失败、Xunlei 无凭据 enable 成功、两类 disable 均可 |
| T018 | `tests/unit/subtitles/subtitle-gateway.test.ts` + `tests/integration/subtitle-gateway-flow.test.ts` | disabled skip、re-enable restore、all disabled error |
| T019 | `tests/ui/providers-page.test.tsx` + `tests/ui/provider-detail-page.test.tsx` | 确认弹窗、pending、success sync、failure rollback-free |
| — | `tests/contract/providers.contract.test.ts` | enable/disable 请求体、响应体、错误码契约 |

---

## 5. 实施顺序

```
T020 (service/repository 可调度列表) ──→ T018 (gateway 测试)
    │                                       │
    │                                       ▼
    └──→ T017 (service 测试) ──→ T021 (前端启停交互)
                                    │
                                    ▼
                               T019 (UI 测试)
```

实际执行时 test 可先行（TDD），但逻辑依赖链如上。
