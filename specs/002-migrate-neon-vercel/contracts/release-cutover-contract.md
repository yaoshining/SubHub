# 发布与 Cutover 契约

## 1. 目标

本契约定义 SQLite -> Neon Postgres 切换时的发布责任边界，确保数据库变更、数据搬迁、应用部署与上线确认不是一个不可拆分的黑箱步骤。

## 2. 阶段划分

### 阶段 A: 迁移前检查

- 校验目标 tier 是否正确
- 校验 direct URL 是否可用
- 校验 SQLite 源数据备份或快照是否存在
- 校验 Postgres baseline 是否可生成或已同步

### 阶段 B: Schema migration

- 使用 direct URL 执行 Postgres baseline migration
- 校验 schema drift 与关键约束是否成立

### 阶段 C: 数据搬迁

- 从 SQLite 读取 required entities
- 条件迁移 request history
- 不迁移 active session

### 阶段 D: 迁移后校验

- 校验 required entities 数量与关键状态语义
- 校验管理员登录、Provider、Caller Key 与关键设置读模型
- 校验应用 smoke test 通过

### 阶段 E: 应用 promotion

- 只有在前四阶段通过后，才允许把应用视为可用或执行正式 promotion

## 3. 禁止项

- 不允许在 Vercel build/start 中隐式执行 production migration
- 不允许跳过数据备份或迁移后校验直接切换流量
- 不允许把数据库切换失败隐藏成普通应用部署失败

## 4. 回退条件

以下情况必须触发中止或回退判断：

- schema migration 失败
- required entities 导入失败或数量校验失败
- 管理员登录或关键管理路径 smoke test 失败
- 目标环境错误解析到非预期数据库