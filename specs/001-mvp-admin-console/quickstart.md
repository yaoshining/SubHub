# MVP 管理控制台与统一字幕出口 - Quickstart

本 quickstart 用于实现完成后的本地验收路径，不代表当前仓库已经具备可运行应用。当前仓库仍处于规划/早期开发阶段，因此 tasks 需要先补齐 Next.js 工程、依赖、持久化与 API 契约链路；在这些任务完成前，下列命令和路由是目标验收路径，而不是当前现状。

## 前置条件

- Node.js 使用项目 `package.json`/工具链固定的版本。
- 已安装依赖。
- 已配置本地持久化存储。
- 已配置至少一个 OpenSubtitles 可用凭据。

## 实现后契约链路验证

```bash
npm install
npm run api:spec
npm run api:client
npm run api:docs
```

预期结果：
- `docs/api/openapi.yaml` 可校验。
- `src/lib/api/generated/` 已生成。
- `/docs/api` 可展示 Scalar 文档。
- 若上述脚本、OpenAPI 文件或生成目录尚未落地，应回到 `tasks` 补齐实现前置项，而不是把当前规划态视为运行失败。

## 启动本地服务

```bash
npm run dev
```

预期结果：
- 后台登录入口可通过 `/login` 访问。
- API 文档可通过 `/docs/api` 访问。

## 首轮开通验证

1. 访问 `/login`。
2. 当系统未初始化时，页面展示“创建首个管理员”表单。
3. 创建管理员后，使用同一入口登录。
4. 登录成功后进入 `/dashboard` 或原受保护目标页。

预期结果：
- 未登录访问 `/dashboard`、`/providers`、`/api-keys`、`/users`、`/settings` 会被要求先认证。
- 已登录访问 `/login` 会重定向。

## Provider 配置验证

1. 进入 `/providers`。
2. 点击“新增 OpenSubtitles”。
3. 输入 Provider 名称和至少一个 API Key。
4. 创建成功后确认列表自动选中新 Provider，并显示“继续配置”CTA。
5. 进入 `/providers/:providerId`，补齐权重、并发、冷却、失败切换与回退目标。
6. 新增第二个 Provider 凭据。
7. 隔离其中一个凭据。

预期结果：
- 被隔离凭据立即从活跃池移出。
- 其他 active 凭据继续参与服务。
- Provider Detail 显示最近异常、未保存变更、保存成功/失败状态。

## 调用方 Key 验证

1. 进入 `/api-keys`。
2. 创建一个调用方 Key。
3. 在受控 reveal window 内复制完整明文。
4. 轮换当前 Key。
5. 停用旧 Key 或当前 Key。

预期结果：
- inventory 默认只展示受控片段。
- 新建/轮换后的完整明文只在受控窗口内可见。
- 停用 Key 后，新的外部查询/下载请求被拒绝。

## 统一字幕出口验证

使用有效调用方 Key 发起查询：

```bash
curl -H "Authorization: Bearer <caller-key>" \
  "http://localhost:3000/api/subtitles/search?title=Example&language=zh-CN"
```

预期结果：
- 有字幕时返回统一结果集。
- 无字幕时返回 `status: "no_results"`。
- 未配置 Provider 时返回 `SERVICE_NOT_READY`。
- 无效或停用 Key 返回授权失败。

下载查询结果：

```bash
curl -H "Authorization: Bearer <caller-key>" \
  "http://localhost:3000/api/subtitles/download?subtitleId=<subtitle-ref>" \
  -o subtitle.srt
```

预期结果：
- 可用字幕返回文件内容。
- 不可用字幕返回明确失败原因。

## Settings 与 Dashboard 验证

1. 进入 `/dashboard`，确认未就绪、异常、Provider 快照和下一步入口。
2. 进入 `/settings`，确认环境、版本、管理员初始化状态、Provider 可用性、调用方 Key 可用性和统一出口状态。

预期结果：
- Settings 不提供深配置表单，只提供状态确认和明确分流。
- 当系统缺少 Provider 或调用方 Key 时，Dashboard 与 Settings 都能指出未就绪原因。

## 响应式验证

分别在 Desktop、Tablet、Mobile 宽度验证：

- Sidebar：Desktop 常驻；Tablet 可收拢/遮罩；Mobile Drawer，导航后自动关闭。
- Header：Mobile 单列，主操作可达，次级动作不抢占首屏。
- 列表页：Mobile 卡片化或关键列 + 展开详情。
- Provider Detail：Tablet 次级栏下沉；Mobile 单列，运行策略可 Accordion 分组。
- API Keys：Tablet inventory 与详情垂直堆叠；Mobile reveal 明文可读。
- Users：Mobile 批量操作收敛，暂停/恢复保留二次确认。

## 交付前检查

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run api:check
```

预期结果：
- 所有质量门禁通过。
- UI review 已对照 `DESIGN.md`、`docs/layouts/admin-layout.md`、`docs/pages/*.md`、`design/main.pen`。
- Code review 已检查 API 契约链路、状态流转、测试覆盖、响应式与 Lucide 命名一致性。
