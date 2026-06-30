# SubHub 设计文档

## 1. 文档目的与边界

本文档是 SubHub 的**项目级设计真源**，用于定义可长期复用的视觉、交互、布局与组件规则。

它回答的是：

- SubHub 的后台整体应该呈现什么气质
- 全局主题、色彩、层级、密度、组件与状态反馈应如何统一
- 编码代理在实现页面时必须遵守哪些跨页面规则

它**不负责**以下内容：

- 单个页面的模块顺序
- 单个页面的业务流程与例外状态
- 某个 feature 的临时实现细节

这些内容应写入：

- `docs/pages/*.md`：页面级布局、状态、交互与例外约束
- `spec.md` / `plan.md` / `tasks.md`：功能范围、实现路径与任务拆分
- `design/main.pen`：设计稿主文件，包含深/浅主题 Dashboard 设计稿，所有设计稿工件统一放入 `design/` 目录

若页面级要求与本文档冲突，以本文档为上位规则；若确需例外，必须在对应 `docs/pages/*.md` 中明确记录原因与边界。

### 1.1 设计文档分层与边界

为保证设计规则长期可维护并避免职责重叠，SubHub 设计文档采用以下分层：

- `DESIGN.md`：负责全局视觉与交互系统规则，包括主题语义、组件方向、信息层级与跨产品通用原则。
- `docs/layouts/admin-layout.md`：负责后台产品共享布局规则与响应式骨架，包括后台 Shell、列表/详情/设置等共享页面骨架与断点行为。
- `docs/pages/*.md`：负责页面级职责、模块顺序、关键状态、交互细节与布局例外。

分层执行约束如下：

- 后台 Shell、列表页、详情页、设置页等共享布局规则，优先参考 `docs/layouts/admin-layout.md`。
- 当 page spec 未定义某项布局特例时，默认回到 `docs/layouts/admin-layout.md`，不得临时自行决定。
- 不将单页特有布局细节持续回灌到 `DESIGN.md`。
- 不将系统级共享布局规则分散写入多个 `docs/pages/*.md`。
- 若问题属于共享布局层，优先更新 `docs/layouts/admin-layout.md`，再由页面规范声明必要例外。

### 1.2 维护流程（文档更新判定）

为降低规则漂移与重复维护成本，涉及界面变更时按以下顺序判定更新目标：

1. 属于全局视觉与交互系统规则变更（影响多个产品域或组件族）时，更新 `DESIGN.md`。
2. 属于后台跨页面共享布局与响应式骨架变更（影响 Shell 或多类页面骨架）时，更新 `docs/layouts/admin-layout.md`。
3. 属于单页模块顺序、页面状态、交互细节或断点例外变更时，更新对应 `docs/pages/*.md`。

若一次变更同时涉及多层规则，先更新上层基线，再在下层文档记录受控落地与例外，不反向覆盖上层定义。

---

## 2. 产品定位与界面原则

SubHub 是一个面向运营者、集成负责人和平台管理员的**自托管字幕网关控制台**。它不是营销站、也不是通用后台模板。

界面层必须长期坚持以下原则：

1. **运维事实优先**
   - 先展示系统是否健康、哪里异常、下一步去哪处理。
   - 不用抽象口号掩盖真实状态。

2. **信息密度高，但不混乱**
   - 可以信息丰富，但层级必须清晰。
   - 先突出关键状态，再呈现辅助诊断信息。

3. **高风险动作必须可见、可确认、可恢复**
   - Provider 配置、Token / Key 管理、用户权限与全局设置都属于高风险对象。
   - 不能让关键动作藏在弱提示或隐式交互里。

4. **一致性优先于炫技**
   - 优先复用既有控件和模式。
   - 不为单页效果发明新的视觉语言。

5. **控制台气质优先**
   - 保持专业、克制、可信赖。
   - 避免营销页式 hero、夸张渐变、情绪化插画或大面积装饰动效。

6. **响应式不改变产品结构**
   - 允许布局折叠，但不允许改变导航目的地与核心任务路径。

---

## 2.1 品牌识别规范

### 2.1.1 Logo 图标（Timeline S）

SubHub 的品牌图标称为 **Timeline S**：由多条水平错位分段条构成 S 轮廓，中轴有克制的竖向同步线，整体抽象呈现 subtitle timeline / workflow segment 的视觉语义。

| 属性 | 规范 |
|---|---|
| 图标源文件 | `design/logo-light.png`（浅色主题）/ `design/logo-dark.png`（深色主题） |
| 尺寸规格 | sidebar 内使用 `width: 23px, height: 24px`；其他场景按比例 650:673 缩放 |
| 颜色方案（浅色） | 深海军蓝主体 `#06101F` / 电蓝条块 `#1748E8` / 浅白底板 |
| 颜色方案（深色） | 近白主体 `#F8FAFC` / 青蓝条块 `#3672FC` / 深色底板 |
| 禁止行为 | 不得重新着色、拉伸变形、用纯文字代替图标、用通用 SaaS 图标替代 |

### 2.1.2 Wordmark（"SubHub"）

| 属性 | 规范 |
|---|---|
| 字体 | **Space Grotesk Semibold**（`fontWeight: 600`） |
| 字号（sidebar） | `18px` |
| 双色规则 | "Sub" 与 "Hub" 分为独立 text 节点，颜色独立定义 |
| 浅色主题 | Sub: `#06101F`，Hub: `#1748E8` |
| 深色主题 | Sub: `$--font-primary`（近白），Hub: `#3672FC` |
| 禁止行为 | 不得将 "SubHub" 改为单一颜色；不得使用 Inter 等非 Space Grotesk 字体作为 wordmark 字体 |

### 2.1.3 Logo 组合规则（sidebar Logo Area）

| 属性 | 规范 |
|---|---|
| 布局 | icon + wordmark 水平排列，`gap: 8px`，`alignItems: center` |
| 容器高度 | `56px`，与侧边栏顶部同高 |
| 内边距 | `padding: [0, 20px]`（水平） |
| 底部边界线 | `stroke bottom 1px`，颜色使用 `$--border-default` |
| 主题隔离 | 浅色/深色主题必须使用对应版本的 logo 图片文件，禁止跨主题混用 |

### 2.1.4 品牌字体范围约束

- **Space Grotesk 仅限品牌场景**：Wordmark、Logo 组合区域。
- 产品界面其余文本（导航、表格、标题、正文）继续沿用主字体（见 § 4 字体规范）。
- 不得将 Space Grotesk 扩展至全站正文或表单，避免品牌字体与内容字体混淆。

---

## 3. 主题与色彩系统

### 3.1 主题策略

- 默认主题：**深色**
- 备选主题：**浅色**
- 主题状态必须跨页面持久化
- 登录页与后台页必须共享同一套主题逻辑，不能形成两套独立视觉体系

#### 主题切换入口规则

- **唯一入口位置**：侧边栏底部（Sidebar Footer）的用户信息行旁，与 Avatar 同行放置。
- **控件形态**：`Button variant="ghost" size="icon"`，图标使用 `Moon`（深色时）/ `Sun`（浅色时），来自 `lucide-react`。
- **禁止位置**：不得把主题切换放入任何页面级 Header（包括 Dashboard 顶部摘要区）。原因是主题是全局用户偏好，放入页面 Header 会导致其他页面无法切换，与"跨页面持久化"要求冲突。
- **持久化方式**：切换后偏好应持久化至 `localStorage` 或用户账号设置，页面刷新后保持。

### 3.2 色彩角色

SubHub 采用**角色化色板**，而不是“页面私有颜色”。

全局颜色至少分为以下角色：

- **主画布色**：页面最外层背景
- **次级画布色**：面板外层、分区背景
- **表面色**：卡片、表格、弹层、输入容器
- **边框色**：面板、输入、分割线、表格线
- **主文本色**：标题、关键数值、主要说明
- **次文本色**：描述、辅助信息、次级标签
- **弱文本色**：占位、元信息、低优先级提示
- **强调色**：主 CTA、链接、当前选中、高亮
- **信息色**：中性提示、说明性状态
- **成功色**：可用、通过、已完成、已启用
- **警告色**：预警、额度逼近、风险上升
- **危险色**：失败、停用、不可恢复、删除类操作

### 3.3 色彩使用规则

- 强调色只用于需要用户优先关注或操作的对象，不能大面积滥用。
- 成功 / 警告 / 危险色必须与具体系统状态绑定，不能仅用于装饰。
- 深色模式下优先通过**亮度对比**和**边框层次**区分模块，而不是靠高饱和度颜色堆叠。
- 浅色模式下保持同样的语义映射，不允许“同一状态在不同主题下换语义”。
- 颜色必须和文案一起表达状态，不能只靠颜色传达信息。

### 3.4 不应采用的色彩策略

- 不要把整页做成大面积高饱和渐变画布。
- 不要使用与状态无关的随机彩色标签。
- 不要在深色模式下依赖重阴影替代边界。

### 3.5 设计 Token 对照表

Token 命名遵循 shadcn/ui 规范，可直接映射至 CSS 变量（如 `--background`、`--primary`）或 Tailwind 扩展配置。

#### 画布与表面

| Token | Dark | Light | 用途 |
|---|---|---|---|
| `background` | `#0B1020` | `#F5F7FB` | 应用最外层画布 |
| `surface` | `#121A2B` | `#FFFFFF` | 卡片、内容面板、表格容器、侧栏主体 |
| `surface-elevated` | `#182235` | `#FCFDFE` | 浮层、激活面板、关键摘要块 |
| `surface-muted` | `#0F1726` | `#EEF2F7` | 次级区块、嵌套容器、低优先背景 |

#### 边框与结构

| Token | Dark | Light | 用途 |
|---|---|---|---|
| `border` | `#25324A` | `#D9E1EC` | 面板轮廓、表格分隔、输入框边界 |
| `border-strong` | `#334766` | `#C3CEDD` | 选中态、关键分区、结构强化 |

#### 文本层级

| Token | Dark | Light | 用途 |
|---|---|---|---|
| `foreground` | `#E8EEF8` | `#0F172A` | 标题、关键数字、主要说明 |
| `foreground-muted` | `#A7B4C8` | `#475569` | 辅助描述、次级标签 |
| `foreground-subtle` | `#7F8CA3` | `#64748B` | 元信息、占位、非关键注释 |

#### 品牌与强调

| Token | Dark | Light | 用途 |
|---|---|---|---|
| `primary` | `#5AA9FF` | `#2563EB` | 主操作、激活态、关键链接 |
| `primary-foreground` | `#08111F` | `#F8FAFF` | primary 承载块上的文字/图标 |
| `accent` | `#7C8CFF` | `#4F46E5` | 辅助高亮、选中、关系型强调 |
| `accent-foreground` | `#F5F7FF` | `#F7F7FF` | accent 承载块上的文字/图标 |

#### 状态反馈

| Token | Dark | Light | 用途 |
|---|---|---|---|
| `success` / `success-foreground` | `#35C58A` / `#071B13` | `#1F9D68` / `#F3FFF9` | 健康、成功、已启用 |
| `warning` / `warning-foreground` | `#F0B24A` / `#211505` | `#C98512` / `#FFF9ED` | 预警、额度逼近、风险上升 |
| `destructive` / `destructive-foreground` | `#E46876` / `#25090E` | `#D1435B` / `#FFF4F6` | 失败、删除、停用 |
| `info` / `info-foreground` | `#59C3E6` / `#071920` | `#0F8FB8` / `#F2FBFF` | 中性提示、说明性状态 |

#### 交互与工具

| Token | Dark | Light | 用途 |
|---|---|---|---|
| `ring` | `#6FB4FF` | `#3B82F6` | 键盘焦点、可访问性高亮 |
| `input` | `#1A263A` | `#FFFFFF` | 输入框、选择器内部底色 |
| `muted` | `#162133` | `#EEF2F7` | 标签底、辅助区块、次级提示背景 |
| `muted-foreground` | `#92A0B6` | `#5B6B80` | muted 容器中的辅助文本 |

#### 使用约束

- `background / surface / surface-elevated / surface-muted` 负责层级建立，不得用强调色替代。
- `primary` 用于主操作与激活态；`accent` 用于辅助强调，两者不可互换。
- `success / warning / destructive / info` 只用于状态反馈，不用于装饰色块。
- `ring` 必须在所有可聚焦控件上保持可见。
- 页面特有色彩例外写入 `docs/pages/*.md`，不得回流全局文档。

> **与 `.pen` 设计稿的关系**：`.pen` 变量系统当前使用旧命名（`--bg-canvas`、`--accent` 等），待下次设计稿迭代时应对齐至本表 token 命名规范。

---

## 4. 字体与信息层级

### 4.1 字体原则

- 标题与正文以**高可读无衬线字体**为主。
- **品牌字体 Space Grotesk**（Semibold）仅用于 Wordmark 与 Logo 组合区域，详见 § 2.1。
- 等宽字体只用于技术性内容，例如：
  - Token / API Key 标识片段
  - 状态码
  - 路径
  - 时间戳
  - 查询或调试片段

不使用“代码字体主导整站标题”的做法，避免界面整体过度工具化、牺牲可读性。

### 4.2 层级规则

建议至少具备以下文本层级：

- **H1**：页面主标题，回答“这是哪一页 / 当前最重要的上下文是什么”
- **H2**：区块标题，回答“这个模块是干什么的”
- **H3 / Row Title**：局部对象标题，如卡片标题、选中对象名称
- **Body**：主要说明文本
- **Secondary / Meta**：辅助描述、更新时间、来源、补充信息
- **Caption / Helper**：输入提示、状态解释、边注
- **Code / Mono**：技术标识

### 4.3 文本使用规则

- 关键数字、关键对象名称与高优先级状态必须优先被看见。
- 元信息必须弱化，但不能弱到不可读。
- 页面标题与模块标题必须直指任务，不使用空泛标题。
- 后台文案应使用运维语言、系统语言、动作语言，不使用品牌宣传语言。

---

## 5. 空间、圆角、边框与阴影

### 5.1 间距系统

全局采用统一的空间等级，至少覆盖：

- `xs`：极紧凑内联间距
- `sm`：图标与文字、小标签间距
- `md`：默认控件 padding、标准模块内间距
- `lg`：面板内大区块间距
- `xl`：模块与模块之间的大间距
- `2xl`：页面级大块留白或强分区间隔

规则：

- 同一类组件使用同一层级间距，不随页面任意漂移。
- 列表页更重密度，详情页更重分区。
- 不为追求“高级感”引入与密度目标冲突的大留白。

### 5.2 圆角规则

- 小型控件：小圆角
- 卡片 / 面板：中圆角
- Modal / Drawer / 高层级浮层：较大圆角

原则：

- 圆角是层级语言，不是装饰。
- 同一层级组件圆角应一致。
- 不要在一个页面里同时混用过多圆角尺度。

### 5.3 边框规则

- 边框是 SubHub 的主要层级工具之一。
- 面板、输入、表格、选中态、分割区域都应优先使用清晰边框建立结构。
- 重要选中态可以加粗边框或配合强调色，但不能因此破坏整体稳定感。

### 5.4 阴影规则

- 阴影是**弱辅助**，不是主要层级手段。
- 常规卡片只允许轻阴影或无阴影。
- Modal、浮层、抽屉可使用更明显阴影，但仍需保持克制。
- 禁止通过明显上浮、重投影营造营销式“悬浮感”。

---

## 6. 布局与密度原则

### 6.1 全局外壳

- 桌面端使用固定左侧导航。
- 窄屏下导航收拢为隐藏式抽屉。
- 抽屉必须具备：菜单按钮、遮罩、关闭动作、Esc 关闭。
- Tablet 与 Mobile 的顶部导航栏菜单触发按钮必须使用图标（Lucide `menu`，18×18），不得使用文字标签（如"Menu"）。按钮容器为 32×32 正方形，图标颜色使用 `$--font-primary` token 以自适应深/浅主题。
- 点击导航后移动端抽屉应自动关闭。
- 桌面与移动端的目的地结构必须一致。

### 6.1.1 共享布局基线（Admin Layout）

- 后台 Shell 的共享结构与区域关系以 `docs/layouts/admin-layout.md` 为准。
- 当 `docs/pages/*.md` 未声明某项布局特例时，默认回退并遵循 `docs/layouts/admin-layout.md`。
- 共享布局问题优先回写 `docs/layouts/admin-layout.md`，页面规范仅记录页面特例与受控例外。

### 6.2 页面布局模式

SubHub 长期支持以下几类布局：

1. **总览页**
   - 顶部摘要 + 指标卡 + 快照区 + 下一步动作

2. **列表治理页**
   - 顶部筛选 / 操作区 + 列表 / 表格 + 选中态或右侧详情

3. **详情配置页**
   - 顶部对象上下文 + 关键指标 + 主配置区 + 运行状态 / 辅助说明区

4. **表单与设置页**
   - 分组表单 + 保存反馈 + 依赖说明，不使用无尽长表单堆叠

### 6.3 密度原则

- 后台默认允许较高信息密度，但必须能一眼区分主次信息。
- 表格、列表和卡片不可同时高密度到失去层级。
- 关键操作按钮区必须保留足够点击空间。
- 在中小屏上优先减少并列数量，而不是压缩文字尺寸与点击区域。

### 6.4 响应式检查范围

至少在以下宽度下检视布局稳定性：

- 360px
- 390px–430px
- 768px–834px
- 1024px–1180px
- 1280px 以上

补充约束：

- SubHub 目标是响应式 Web，而不是原生 App 视觉压缩。
- 若页面规范未声明断点例外，默认遵循 `docs/layouts/admin-layout.md` 的响应式骨架规则。

禁止出现：

- 水平滚动作为默认阅读方式
- 固定导航遮挡主要内容
- 仅桌面悬停可见的关键信息或关键动作

---

## 7. 组件原则

### 7.1 按钮

按钮层级固定为：

- **Primary**：当前上下文最重要动作
- **Secondary**：同级辅助动作
- **Ghost / Tertiary**：轻量操作、工具性动作
- **Danger**：删除、停用、撤销等风险动作

规则：

- 一个局部上下文中通常只有一个 Primary。
- 不要把多个高风险动作都做成 Primary。
- Hover 可以有轻量反馈，但不能出现明显位移导致布局注意力漂移。
- **移动端按钮顺序**：在水平排列的按钮组中，Primary 按钮必须靠右（拇指热区 + 视觉确认位）；Secondary / Ghost 按钮靠左。此规则适用于卡片行内操作、表单底部操作区、成功反馈操作区。Desktop 不强制此顺序，但推荐保持一致。

### 7.2 卡片与面板

- 卡片用于承载单个信息对象或单个模块。
- 面板用于承载有边界的操作区域或信息分区。
- 卡片与面板必须通过背景、边框、标题层级而非装饰阴影建立区分。
- 可点击卡片必须有明确点击 affordance；不可点击卡片不得伪装成可点击对象。

### 7.3 输入框、选择器与表单

- 输入控件必须有清晰标签，不依赖 placeholder 充当唯一说明。
- 焦点状态必须可见。
- 错误反馈必须与字段位置关联。
- 设置类表单应按主题分组，而不是无结构长列表。

### 7.4 表格与列表

- 表格适用于结构化对象比较。
- 列表适用于对象选择、诊断摘要和可展开内容。
- 行内必须明确主字段、状态字段、辅助字段与动作区。
- Hover 高亮可以使用，但不能让排版和行高发生跳动。

### 7.5 状态标签、Badge、Chip

- 用于表达对象状态、类别、风险等级、环境、作用域等短标签信息。
- 标签颜色必须服从状态语义，不可仅为美观而变化。
- 一个对象同时出现的 chip 数量必须受控，避免变成“彩色噪音”。

### 7.6 Inline Callout 与 Notice

- 用于解释当前状态、提醒风险、说明下一步。
- 应靠近相关模块出现，不要散落在页面无关位置。
- Callout 不是正文段落替代品，必须聚焦一个明确意图。

### 7.7 Modal、Drawer 与浮层

- 只用于需要中断当前任务并集中确认的场景。
- Modal 承载确认、短流程、关键补充信息。
- Drawer 承载次级详情、导航或不应打断当前上下文的扩展信息。
- 禁止把完整主流程长期塞进 modal。

### 7.8 导航

- 导航必须反映真实产品结构，而不是演示目录。
- 当前页、可返回路径与上级结构必须清楚。
- 任何新增页面若形成稳定产品对象，必须同步更新设计文档与导航真源。
- **导航与页面标题统一使用中文**：侧边栏导航项与各页面顶部标题（Page Header）均采用中文，标准映射如下：
  | 英文 | 中文 |
  |------|------|
  | Dashboard | 仪表盘 |
  | Providers | 服务商 |
  | Provider Detail | 服务商详情 |
  | API Keys | API 密钥 |
  | Users | 用户 |
  | Settings | 设置 |
  | Access Control | 访问控制 |
- **侧边栏图标统一使用 Lucide**：导航项图标与主题切换图标使用以下命名映射，避免页面间语义漂移：
   | 场景 | Lucide 名称 |
   |------|-------------|
   | Dashboard | `layout-dashboard` |
   | Providers | `server` |
   | API Keys | `key-round` |
   | Users | `users` |
   | Theme Toggle（深色） | `moon` |
   | Theme Toggle（浅色） | `sun` |
- **Sidebar 组件化维护**：Sidebar 应作为可复用组件维护，页面内优先使用组件实例而非复制新结构；需要页面特定高亮态时，通过实例覆写实现，不再维护多份独立 Sidebar 结构。
- **Sidebar 组件命名规范**：统一采用 `Sidebar / <Theme> / <Active Route>` 命名（例如 `Sidebar / Dark / Users`、`Sidebar / Light / API Keys`）；禁止使用 `Master`、临时后缀或与主题不一致的命名。
- **Sidebar 选中态规则**：各页面必须保证与当前路由一致的导航项为选中态（含图标与文字高亮、背景与描边状态）；组件化后通过实例覆写维护选中项，不得在多个独立 Sidebar 副本中分散维护。
- **Sidebar active menu 覆写方式**：基础组件默认不预设激活项；页面实例通过 `descendants` 覆写当前路由对应菜单样式，等效于 `activeMenu` 参数化配置。

### 7.9 组件系统基线

SubHub 将 `TailwindCSS + shadcn/ui` 确立为界面组件化实现的**设计基线**，而非仅作为视觉风格参考。以下规则在设计文档与页面规范层面长期有效，供设计决策与 UI 评审共同遵守。

**组件优先级**

- 按钮、输入框、表单、弹层、表格、标签、导航、分隔线、卡片等基础界面元素，设计上应优先采用可映射到 `shadcn/ui` 组件结构的模式。
- 页面与模块设计优先复用 `shadcn/ui` 的组件心智，而不是频繁发明难以复用的自定义基础组件。
- 允许通过主题 token、variant、slot 或组合层对组件进行定制以满足密度、层级与品牌需求，但不鼓励脱离组件系统的大量视觉特例。

**冲突裁决规则**

当设计意图与 `shadcn/ui` 默认模式存在冲突时，按以下顺序判断：

1. 能否通过 token（颜色、尺寸、圆角等 CSS 变量）调整解决？
2. 能否通过 `variant` 或 `slot` 扩展覆盖？
3. 能否通过多个现有组件组合实现？
4. 只有上述均不适用时，才引入新的自定义基础组件，并在对应 `docs/pages/*.md` 中显式说明引入理由与复用边界。

**TailwindCSS 样式约束**

- TailwindCSS 是默认样式实现方式，不引入其它 CSS-in-JS 框架或全局 SCSS 层作为主样式基础。
- 鼓励通过 design token（CSS 变量映射至 `tailwind.config`）、语义 class（如 `text-muted-foreground`、`bg-card`、`border-border`）和状态变体（`hover:`、`disabled:`、`data-[state=open]:` 等）保持全局一致性。
- 不鼓励大量使用 arbitrary value（如 `w-[137px]`）；确有必要时应在 `tailwind.config` 的 `extend` 中注册为具名 token，不散落于各组件中。
- 新增或修改基础视觉规则时，优先体现为 CSS 变量或 tailwind token 的变更，而非逐页覆写 class。

**文档语言约束**

- 设计文档与页面规范在描述组件时，应优先使用"可组件化、可复用、可变体化"的语言。
- 不以截图代替结构描述，不以"视觉效果"替代"组件语义"。
- 设计评审与 UI 保真检查中，偏差描述应对应到具体的 `shadcn/ui` 组件名或 token 名，而不只是主观描述。

---

## 8. 状态与反馈规则

每个可交互界面都必须考虑以下状态集合中的适用项：

- default
- hover
- focus
- active / selected
- disabled
- loading
- empty
- success
- warning
- error
- permission-restricted

规则：

- 状态变化必须可感知，但不应制造噪音。
- loading 期间必须避免用户误以为已完成或无响应。
- empty 不是“没有内容”，而是“解释当前没有什么、为什么没有、下一步做什么”。
- error 必须说明失败对象、失败原因和恢复动作。
- 权限不足状态必须清晰说明“看不到 / 不能做”的原因，而不是简单消失。

---

## 9. 数据展示与技术信息呈现

SubHub 是高信息密度后台，因此数字、状态、时间、来源、额度与趋势信息必须统一表达。

规则：

- 数值必须配单位或语义上下文，不展示裸数字。
- 趋势信息必须区分“当前值”和“变化方向”。
- 状态码、Token 片段、Key 片段、路径等技术内容用等宽或技术样式承载。
- 危险信息优先展示“影响”与“动作”，而不是只展示诊断术语。
- 未知值应诚实呈现为未知，而不是伪精确数据。

---

## 10. 可访问性与交互底线

### 10.1 可访问性

- 文本对比度必须满足基础可读要求。
- 焦点状态必须对键盘导航可见。
- 不能只靠颜色区分状态。
- 图标必须来自一致图标体系，不使用 emoji 充当系统图标。

### 10.2 动效

- 默认过渡应克制，建议维持在短时长范围内。
- 动效用于帮助理解状态变化，不用于制造“高级感”。
- 必须尊重 `prefers-reduced-motion`。
- 禁止使用造成布局跳动的 hover 缩放、上浮或抖动效果。

### 10.3 指针与交互提示

- 所有可点击对象必须提供明确点击反馈。
- 所有交互元素必须具备与可点击性相符的指针与视觉状态。
- 不允许出现“看起来能点但实际上不能点”的伪交互。

---

## 11. Do / Don’t

### 11.1 Do

- 用边框、表面和层级组织复杂信息
- 用短而明确的文案解释当前状态
- 把高风险动作做成可见、可确认、可恢复
- 让关键数字、关键对象与关键状态优先可见
- 在页面级例外中显式记录偏离全局规则的原因

### 11.2 Don’t

- 不要把后台做成营销页
- 不要在单页中发明新的视觉体系
- 不要让 hover 导致布局位移
- 不要使用 emoji 充当系统图标
- 不要让焦点状态不可见
- 不要让 loading / empty / error 状态只有空白区域
- 不要把页面职责、模块顺序和单页例外重新塞回全局文档

---

## 12. 文档维护规则

### 12.1 本文档应更新的情况

只有当变更满足以下任一条件时，才更新 `DESIGN.md`：

- 形成跨多个页面复用的视觉规则
- 形成跨多个页面复用的交互模式
- 调整全局主题、密度、层级、组件原则
- 新增全局状态反馈规则或无障碍底线

### 12.2 不应写入本文档的内容

以下内容应写入 `docs/pages/*.md`，而不是本文档：

- 单页模块顺序
- 单页独有状态
- 单页例外交互
- 单页流程细节
- 单页业务文案

### 12.3 与页面规范的关系

- `DESIGN.md` 定义项目级设计规则
- `docs/pages/*.md` 定义页面级结构与例外
- 当页面需要偏离全局规则时，必须在页面规范中显式记录

### 12.4 与实现的关系

- 编码代理实现页面时，必须先遵循本文档，再遵循对应页面规范
- UI 评审时，先按本文档检查系统级一致性，再按页面规范检查页面保真

---

## 13. 当前项目级设计结论

当前 SubHub 的长期设计方向可概括为：

- **专业运维控制台**
- **深色默认、浅色备选**
- **高信息密度但层级清晰**
- **边框与表面分层优先于重阴影**
- **状态可见、动作明确、风险可恢复**
- **页面级例外全部下放到 `docs/pages/*.md`**

本文件应持续保持在这个抽象层级，不再回到“页面大全”或“原型清单”式写法。

---

## 14. v0.2.3 Provider Admin Baseline 设计目标与原则

### 14.1 版本背景

v0.2.3 将管理台从"OpenSubtitles 单 provider"升级为**多 provider（OpenSubtitles / Xunlei）统一管理视角**。这是 SubHub 第一次在同一个界面层中处理两类能力不等价的 provider，设计上需解决以下核心矛盾：

- **统一性**：OpenSubtitles 与 Xunlei 共用同一组页面（providers list / provider detail），不建独立页面，不 split 路由。
- **差异性**：OpenSubtitles 支持凭据池、多实例、凭据轮换；Xunlei 为受限的单实例 provider，无凭据池、无 rotation、baseUrl 不落入 UI。
- **认知安全**：管理员必须一眼知道自己面对的是哪类 provider，哪些能力可用、哪些不可用。

### 14.2 适用范围

- **受影响页面**：`/providers`（列表）、`/providers/:providerId`（详情）、Create Provider Drawer（列表页触发）
- **受影响组件**：全部 provider-related 组件（`provider-list`、`provider-policy-form`、`provider-credential-table`、`provider-activity`、`provider-pool-inspector`、`status-badge`、`empty-state-card`）
- **不涉及页面**：Dashboard、Settings、API Keys、Users — 设计不变

详细页面级设计见 `docs/pages/providers.md`、`docs/pages/provider-detail.md`、`docs/pages/create-provider.md`。

### 14.3 全局设计原则（v0.2.3 新增 / 增强）

#### 14.3.1 冷色画布 + 暖色状态

画布全程用 `background / surface / surface-elevated / surface-muted` 四层冷色建立层级；状态只用 `success / warning / destructive / info` 四个暖色语义表达。禁止用 brand 色或装饰渐变替代状态色。

#### 14.3.2 高信息密度 + 大点击热区

行高、字段间距走 `DESIGN.md §5.1` 中 `gap-3 / gap-4` 步进；任何可点击目标 ≥ 32×32 px。可扫描 ≠ 可压缩。

#### 14.3.3 状态优先于品牌

列表行的第一视觉锚点必须是"provider 当前能不能服务"（状态徽章 + 状态点），而不是名称或 logo。

#### 14.3.4 差异通过形状与图标表达，不用色块

OpenSubtitles / Xunlei 的差异通过「类型徽章的图标 / 边框样式 / 受限锁形符号」表达，颜色仍然只用主品牌与中性灰。禁止依靠不同色块区分 provider 类型。

#### 14.3.5 专业感来自克制，不是装饰

不放 emoji、不放彩色 banner、不放 mock 数据插画；空态用一行精准文案 + 一个明确 CTA。

#### 14.3.6 启停无 dirty state

启用/禁用不可与表单 dirty state 混淆。Switch 切换是即时动作，不进 unsavedChanges，不依赖 Save 按钮。

#### 14.3.7 凭据池 / 受限说明区块必须 type-aware，结构明显不同

OpenSubtitles 与 Xunlei 在凭据池区块不得套用同一个组件加 if-else 隐藏字段。必须整段替换。OpenSubtitles → 凭据池表格；Xunlei → `RestrictedCapabilityCallout` 受限说明卡。

### 14.4 OpenSubtitles / Xunlei 差异化设计规则

| 维度 | OpenSubtitles | Xunlei |
|------|---------------|--------|
| 类型 | 正常 provider，多实例 | 受限 provider，单实例（migration 预置） |
| 类型标识 | 48×48 `OS` 块 | 48×48 `XL` 块 + Lock 图标 |
| 凭据池 | 完整 CRUD：新增/隔离/恢复/冷却显示 | `RestrictedCapabilityCallout`：「不需要 API Key」 |
| Rotation | 可编辑 Switch | 整行隐藏 |
| Fallback | 可选（可指向 Xunlei 或其它 OS） | 可选（可指向 OS 或 null） |
| 创建入口 | 正常创建（Type Selector 中可点击） | 不可创建；Type Selector 中卡片 disabled + 解释 |
| 删除 | 条件可用（disabled + 无凭据时） | 不暴露删除按钮（运维脚本处理） |
| 凭据提醒 | empty state + 引导 CTA | 不适用，无凭据提醒 |
| baseUrl | 环境变量，不入 UI | 环境变量，不入 UI |

### 14.5 跨组件共享规范

以下复合组件以既有 shadcn/ui 原语组合而成，在 providers / provider-detail / create-provider 三页间复用：

| 组件 | 基于 | 职责 |
|------|------|------|
| `ProviderTypeBlock` | `Card` + `Badge` + Lucide 图标 | 48×48 类型标识块（OS/XL），含底部 4px 状态条；Xunlei 附加 Lock 图标 |
| `ProviderStatusBadge` | `Badge` + Lucide 图标 | 4 状态（enabled/disabled/degraded/needs_config）复合徽章 |
| `HealthBlock` | `Tooltip` + Lucide 图标 + `Text` | 两种形态：`compact`（单行 dot+时间）和 `detailed`（含错误摘要） |
| `PoolSizeIndicator` | `Progress` + `Text` | 三段凭据池规模可视化（active/cooling/quarantined） |
| `RestrictedCapabilityCallout` | `Card` + `Alert` | 受限能力说明卡，用于 Xunlei 凭据池区与 Inspector |
| `SummaryStrip` + `SummaryTile` | `Card` + `Text` | 列表页顶部摘要条（Total/Enabled/Degraded/Disabled） |
| `ProviderContextStrip` | `Card` + `Badge` + `Text` | Detail 页顶部对象上下文条 |
| `TypeSelectorCard` | `Card` + `Alert` | Create Drawer Step 1 类型卡片 |

### 14.6 v0.2.3 设计文档索引

| 设计资源 | 路径 | 职责 |
|----------|------|------|
| 全局设计规则（本文档） | `DESIGN.md` | 视觉 token、布局模式、组件原则、状态反馈规则、v0.2.3 全局原则与差异化规则 |
| 共享布局 | `docs/layouts/admin-layout.md` | 后台 Shell、响应式骨架、列表/详情/设置布局基线 |
| Providers 列表页 | `docs/pages/providers.md` | Summary Strip、Master List、Inspector、筛选/搜索/空态 |
| Provider 详情页 | `docs/pages/provider-detail.md` | Context Strip、Section A/B/C/D stack、Inspector |
| Create Provider | `docs/pages/create-provider.md` | Two-Step Drawer、Type Selector、Instance Form |
| Provider 组件索引 | `src/components/providers/` | 实现层面的组件清单（非设计文档） |

### 14.7 v0.2.3 禁止反模式

- ❌ 用「单一空态卡片」硬塞 OS 和 Xunlei 的差异（必须整段替换）
- ❌ 把 Status Switch 与表单 dirty state 混在一起（启停是即时动作）
- ❌ 在 List 行用传统 Table 列硬塞多类信息（必须用卡片行承载四层信息）
- ❌ 让 Xunlei 卡片可点击进入 Create Step 2 后用 disabled 字段凑合（Step 1 即 disabled + 解释）
- ❌ 在 List Inspector 中塞凭据池完整表格（仅放摘要，Detail 才看完整）
- ❌ 用 brand 色或装饰渐变做"漂亮"
- ❌ 把「创建 OpenSubtitles」作为入口文案（必须统一为「创建 Provider」）
