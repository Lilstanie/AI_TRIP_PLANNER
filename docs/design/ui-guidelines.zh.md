<a id="liquid-glass-workspace-design-contract"></a>

# Liquid Glass 工作区设计约定

[English](ui-guidelines.md) | 中文

<a id="overview"></a>

## 概览

工作区遵循 Apple 最新的 iOS 设计语言 Liquid Glass。地图和对话是内容；侧边栏、顶部栏胶囊、输入框、面板、抽屉与浮层以半透明玻璃悬浮于内容之上，底部铺设柔和的环境色。区域切换带有动画：视图交叉淡入淡出、分段控件滑动、浮层弹入并下沉退出。这些效果通过下文的 token、玻璃材质和动效辅助函数实现，不依赖纹理或装饰资源。地点本身的照片属于内容，而非装饰。[Liquid Glass Agent Note](../../.agents/notes/implemented/feature/2026-09-25-liquid-glass-workspace.md) 记录了设计理由。

<a id="ui-reference-resources"></a>

## UI 参考资源

以下网站提供交互模式、动效、组件和视觉方向的参考。它们帮助实现选型，但不能替代本项目自身的无障碍、语义 token 或工作区布局约定。

- [Beautiful UI](https://beautifului.dev)
- [BeUI](https://beui.dev)
- [Rare UI](https://rareui.com)
- [Transitions](https://transitions.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Aceternity UI](https://ui.aceternity.com)：面向落地页的特效库。可用于克制的微交互，例如工具提示和文字渐显。不要采用它的光束、极光与渐变背景、光晕、3D 卡片或视差效果：它们违反下文的禁止事项与减少动效约定。其组件依赖 Framer Motion，本项目未使用该依赖；应将效果移植为 CSS，而非新增依赖。
- [Mindtrip](https://mindtrip.ai)：AI（人工智能）旅行规划产品，也是与本项目最接近的产品。其交互设计是以下功能的主要参考：
  - **回答中内联地点。** 提及地点时附带类别图标和地点名称。悬停打开包含照片、地址和一句描述的预览；点击打开完整地点详情。
  - **在地点出现的位置保存。** 回答末尾显示其提及地点的照片卡片，每张卡片都有保存和添加到旅行的开关。
  - **地图与对话同步。** 每个被提及的地点都有标记，相邻标记聚合并显示数量。
  - **地点详情。** 详情视图包含分节（概览、住宿、餐饮、游玩项目、评价）、当地天气，以及「你可能想问」的后续问题列表；选择问题会发起一轮聊天。
  - **旅行计划。** 单独保留 Ideas 收集区，与逐日行程分开。每站显示时间段和缩略图，并展示站点间距离；存在预订链接时一并提供。
  - **后续问题建议标签**显示在输入框上方。
  - **顶部栏中的旅行信息。** 目的地、日期、旅行者和预算以标签呈现，每个标签仅打开该项信息的编辑器，Preferences 标签保存旅行者自己的偏好列表。Where 和 Trip preferences 像 Mindtrip 一样在遮罩上居中打开；单值编辑器锚定在各自标签下方；在手机上全部使用底部浮层。参见[偏好标签 Agent Note](../../.agents/notes/implemented/feature/2026-09-24-preference-chips.md) 和[旅行偏好列表 Agent Note](../../.agents/notes/implemented/feature/2026-09-24-trip-preference-list.md)。

  将这些交互融入工作区的固定区域。例如，地点详情在抽屉或地图覆盖层中打开，而不是替换地图列。借鉴交互，不借用品牌：不得复用 Mindtrip 的资源、文案和品牌样式。

只有在来源当前许可证允许时，才可复制外部源代码。除非持有相应 Pro 许可证，否则使用公开 / 免费的 BeUI 和 Aceternity UI 组件；保留必需的 MIT 声明，且不得将外部库重新分发为与其竞争的组件套件。

<a id="colors"></a>

## 颜色

仅使用 `apps/web/app/styles/tokens.css` 中的语义 token 作为颜色约定：

- `--page`、`--surface` 和 `--surface-2` 遵循 iOS 分组背景；`--ambient` 是玻璃下方柔和的环境色，永不承载内容。
- `--text`、`--text-dim` 和 `--text-mut` 建立文字层级；正文和重要辅助文字在其表面上必须满足 WCAG AA 对比度。
- `--border` 是区域之间的 1px 细线。
- `--accent`（文字和图标）与 `--accent-bg` 标识主要操作或当前状态；`--accent-fill` 是 `--on-accent` 文字背后的实色填充，在深色模式中比 `--accent` 更深，以确保白色标签满足 AA。
- `--fill-hover` 和 `--fill-press` 是胶囊按钮、行与字段使用的低调灰色填充。
- `--ok`/`--ok-bg` 和 `--warn`/`--warn-bg` 配合文字或形状表达状态；颜色永远不能是唯一状态信号。

必须同时提供浅色和深色 token 值。原生控件必须跟随当前系统主题，焦点环必须始终可见。

<a id="typography"></a>

## 排版

所有内容使用 Apple 系统字体：正文、控件和标签使用 `--font-text`（SF Pro Text），标题使用 `--font-display`（SF Pro Display），并通过 `--tracking-title` 收紧字距。两组字体栈都回退到 PingFang 和 Hiragino，保证中英文混排可用；不加载网络字体。

<a id="layout"></a>

## 布局

现有工作区网格固定为侧边栏、聊天和地图；覆盖式抽屉保留这一工作区域。保持当前响应式断点、侧边栏缩放、抽屉方向和窄屏 Chat/Map 切换。按项目负责人的要求，旅行偏好从顶部栏的信息标签编辑，不使用抽屉。

间距使用 `--space-1` 至 `--space-5`。这些 token 适用时，不要引入另一套间距值。

<a id="elevation--depth"></a>

## 高度与纵深

悬浮层使用玻璃材质（见下文）；其中的内容通过间距、`--fill-hover` 行和细线分隔。`--shadow-sm` 用于小型凸起控件，`--shadow-md` 用于菜单，`--shadow-lg` 用于浮层和抽屉。不得使用噪点、纸张纹理或模拟卷边。

<a id="glass"></a>

### 玻璃

玻璃采用 Liquid Glass，即 iOS 26 中半透明、模糊、略提高饱和度并带明亮镜面边缘的材质。它应用于**每个悬浮层**：侧边栏、Chats 面板、顶部栏胶囊、分段控件、输入框、空状态卡片、提示、地图覆盖层、抽屉、旅行信息浮层、对话框、旅行卡片标题和旅行日历。`apps/web/app/styles/glass.css` 维护该列表。

- 玻璃值仅来自 `tokens.css` 中的语义 token（`--glass-bg`、`--glass-bg-strong`、`--glass-border`、`--glass-edge`、`--glass-highlight`、`--glass-shadow`、`--glass-blur`、`--glass-saturate`），同时提供浅色和深色值。文字密集的层使用 `--glass-bg-strong`。
- 玻璃绝不叠加在玻璃上：玻璃层内的菜单、工具提示和建议列表使用不透明材质；抽屉内的分段轨道使用填充。
- 玻璃上的文字和图标，在它们可能覆盖的最复杂背景上仍须满足 WCAG AA。不满足时，提高填充不透明度，不要添加文字阴影。
- 不支持 `backdrop-filter`、启用 `prefers-reduced-transparency: reduce` 或 `prefers-contrast: more` 时，玻璃回退到 `--surface`；在 forced-colors 模式下回退到系统颜色。

实现方法见 [better-ui 玻璃参考](../../.agents/skills/better-ui/glass.md)。

<a id="motion"></a>

### 动效

区域切换（另一个聊天或旅行、Your trips 页面、手机 Chat/Map 切换）通过 `apps/web/components/ui/motion.ts` 中的 `viewTransition` 实现；分段控件使用 `useSegmentIndicator` 滑动指示块；关闭浮层和抽屉背景遮罩时使用 `usePresence` 播放退出动画。时序来自 `--ease-out`、`--ease-spring`、`--duration-fast`、`--duration`、`--duration-slow`、`--drawer-ease` 和 `--drawer-duration`，动画位于 `apps/web/app/styles/motion.css`。启用 `prefers-reduced-motion` 时全部关闭。

<a id="place-photos"></a>

### 地点照片

照片仅可作为**特定地点的内容**使用，且必须来自该地点的数据提供方（Google Places）。照片可出现在地点卡片、地点预览和地点详情中，也可作为行程及地点列表缩略图、地图照片标记。照片绝不能用于装饰：不得用作头图、页面或面板背景，不得使用图库或生成图像。

- 展示提供方条款要求的署名，例如 Google 地点照片的作者署名。仅持久化地点 ID。绝不存储照片名称或图像字节，因为 Google 禁止缓存照片名称，且这些名称会失效；每次显示照片时，都从新的 Places 响应获取名称。
- 每个照片槽位都有固定宽高比，保证图片加载时布局不跳动。照片采用懒加载，没有照片时，在 `--surface-2` 上显示地点类别图标。
- 照片使用容器圆角和 1px 内侧细线（`--border`）。文字绝不直接放在照片上；标题位于下方，或放在玻璃 / 不透明标签上。
- 替代文本为地点名称；若照片旁已显示名称，则为空。
- 照片请求计入提供方配额，并遵循 [add-provider skill](../../.agents/skills/add-provider/SKILL.md) 中的提供方规则。Mock 模式展示回退状态，绝不请求网络照片。

[地点照片 Agent Note](../../.agents/notes/implemented/feature/2026-09-24-place-photos.md) 说明了范围。地图的地点预览是首个展示照片的界面。

<a id="shapes"></a>

## 形状

悬浮面板、抽屉和浮层使用 `--radius-xl`（26 px）；卡片使用 `--radius-lg`；行与字段使用 `--radius`；按钮、标签和分段控件采用胶囊形状（`--radius-pill`）。细线保持 1px。

<a id="components"></a>

## 组件

- **侧边栏和顶部栏：**紧凑的导航与工具，当前状态通过颜色以外的信号表达。
- **聊天气泡和规划进度：**采用系统字体和明确文字状态，提供易读说明。
- **决策卡片：**保留现有语义操作和焦点行为。
- **地图标记和地点列表：**地图始终是画布；控件作为克制的覆盖层呈现。
- **抽屉、时间线行、预算条和偏好字段：**先用表面与细线分组，再考虑增加高度。

<a id="dos-and-donts"></a>

## 应做与禁止事项

应使用语义 token、清晰的文字层级、可见焦点，并在状态颜色之外提供文字或形状。

禁止：

1. 为视觉调整改变三列工作区、抽屉行为或响应式模型。
2. 用完整 UI 库重设计替换工作区。Tailwind v4 和项目自行维护的 shadcn 原语可作为实现工具，但必须使用上述语义 token，且不得替换工作区布局、焦点行为或无障碍约定。
3. 将界面变成全屏米色或复古皮肤。
4. 使用霓虹色、纹理图、噪点滤镜、装饰照片或插画，在玻璃上叠加玻璃，或展示上述提供方地点照片以外的照片。
5. 当表面、间距和细线足以表达分组时，在卡片中再叠加卡片。
