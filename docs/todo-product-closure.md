# 产品闭环待办：真实数据、天气与 UI

当前基线：`main` 已按本文件顺序合入 PR #31–#37；SerpApi 酒店和航班适配器、持久化、天气、来源
状态、AI 进度和结果卡片已经进入主线。下一阶段不再是这些 P0/P1 能力的实现，而是验证真实数据
端到端可用并继续处理下方保留的 P2 能力。

## P0：真实酒店与航班数据

- `USE_MOCK_TOOLS=false` 时，酒店使用 SerpApi Google Hotels，航班使用 SerpApi Google Flights。
- 所有 SerpApi 搜索固定使用 AUD；旧的 USD 字段和美元估价不得重新进入页面。
- 酒店 SerpApi 失败时可回退到 Google Places，但必须标明“真实酒店、估算价格”。
- 航班 SerpApi 失败时显示未定价状态，不得静默替换成虚构票价。
- 提案来源至少区分 SerpApi、Google Places estimate 和 mock fixture。
- 真实结果显示查询时间、价格可能变化、不能直接预订等提示。
- 未支持的城市/机场代码显示可理解的错误，不得静默回到 mock 航班。

验收：已支持的 Sydney → Tokyo 行程能显示真实酒店和航班；请求和页面金额均为 AUD；provider
失败时页面仍能完成，但明确显示估算、未定价或重试状态。

实现记录（`feature/provider-provenance`）：`ProviderProvenance` 随酒店/航班候选从 tools 传到
agent，再汇总为统一的 `AgentProposal.source`。SerpApi Google Hotels/Flights 标为 `live`，
Google Places 酒店价格标为 `estimated`，mock 候选标为 `mock`；每个真实查询保留 `queriedAt`，
所有价格路径明确为 AUD。SerpApi 酒店失败时，Google Places fallback 会记录原 provider 与失败原因，
页面仍显示“真实酒店、估算价格”，不会伪装成 live quote；航班 provider 失败仍保持未定价状态。
相关 adapter、agent source 和 fallback 回归测试必须一起通过。

## P0：降级状态必须对用户可见

这是一个已知的真实 bug，不是普通 UI polish：五个 specialist（accommodation、transport、itinerary、
destination-guide 和 dining）的模型/外部 provider 降级目前主要写日志，用户无法可靠判断页面内容是模型结果、
确定性 fallback、估算还是 provider 不可用。

- 分支：`fix/degraded-visibility`；无前置依赖。
- 每个 proposal 或顶层规划结果都要能表达 degraded/fallback 状态，并显示人类可理解的原因。
- `kind` 必须在**降级发生的地方**产生（各 specialist 的 catch 分支），不能由装配阶段推断。
- 不能暴露内部 prompt 或 chain-of-thought；只显示“使用本地备用规划”“航班未定价”“地点数据需要确认”
  等高层状态。
- UI 必须区分 live、estimated、mock、fallback 和 unavailable，不得只依赖 console 日志。
- 为五个 specialist 的 fallback 和浏览器展示补回归测试。

验收：关闭模型 key 或让 provider 失败后，页面仍能完成，但用户能在对应结果或规划状态中看到降级
说明；恢复 provider 后，状态不会残留为 degraded。

实现记录（`fix/degraded-visibility`，PR #31）：五个 specialist 的模型/外部 provider fallback 都在
发生降级的 catch 分支生成统一的 `source.kind`，并由 TripSection、ChatPanel 和结果卡片显示 live、
estimated、mock、fallback 或 unavailable 状态及高层原因；未暴露 prompt 或 chain-of-thought。PR 已
直接提交到上游仓库，GitHub CI 与 Vercel 检查均通过，已按顺序合并进 `main`。

### 现有回填是同一个 bug，不要拿它交差

`packages/orchestrator/src/workflow.ts:288-291` 在装配时会给缺 `source` 的 proposal 回填一个，
标签取自 `process.env.USE_MOCK_TOOLS` 和 `section.id`，**与这个 agent 实际做了什么无关**。于是
`USE_MOCK_TOOLS=false` 时某个 specialist 的模型调用失败、掉进确定性 fallback
（`itinerary:285`、`transport:413`、`destination-guide:190`、`dining:246`、`accommodation:328`），
该 proposal 仍会被标成 “Map place data and AI estimates” —— 环境变量说“真实”，用户就被告诉
数据是真实的。它恰好在降级这一刻说谎，正是本 P0 要修的东西。

所以 `workflow.ts:288` 的回填只保留作缺省兜底，`kind` 的真实来源是各 specialist 的降级分支。
`accommodation/index.ts:163-172` 同理：它按 Places grounding 是否成功分档，模型失败时
（`:325-328`）会保留 grounded 标签，也要一起改。

落点只有四处，不要重造一套来源体系：

| 位置                                                 | 改动                                    |
| --- | --- |
| `packages/shared/src/contracts.ts:156`               | `source` 增加必填 `kind` 枚举           |
| `packages/orchestrator/src/workflow.ts:288-291`      | 回填降级为缺省兜底                      |
| `packages/agents/src/accommodation/index.ts:163-172` | 两个分支各给一个 `kind`                 |
| `apps/web/components/trip/TripSection.tsx:57`        | 渲染 `kind`，不再只显示 label/freshness |

`source.kind` 是跨包契约变更，按 `AGENTS.md` 记入 `.ai/DECISIONS.md`。

## P0：持久化与降级基础设施

- 聊天、偏好、旅行计划和 HITL 决策迁移到持久化存储。
- SerpApi 用量计数器和缓存迁移到持久化或共享存储；当前进程内计数不能作为部署级限额。
- 持久化接口保持 `MemoryStore` 合约，避免 UI 和 agent 直接依赖具体数据库。
- Vercel 环境通过环境变量配置 key；key 不进入代码、文档或 Git。
- 保留 mock 默认模式，CI 和离线测试不得依赖外部 API。

持久化是部署前的 P0，因为当前 `packages/services/src/memory/index.ts` 使用进程内 `Map`；Vercel
冷启动会丢失数据，也会清零 SerpApi 计数和缓存。

实现记录（`feature/durable-storage`，PR #32）：新增 Upstash-compatible JSON store，并保留本地
fallback；聊天、偏好、行程、HITL 决策、SerpApi 缓存和用量计数都通过持久化服务访问，CI/离线测试仍
默认使用本地 mock。应用依赖和 lockfile 已同步，GitHub CI 与 Vercel 检查均通过，已按顺序合并进
`main`。

## P1：天气能力

天气能力已实现并合入主线，沿用现有工具网关和证据链，不把天气交给普通搜索结果。

- 新增 `WeatherPort` 和 `packages/tools/src/weather.ts`，mock 与真实 provider 在同一文件内分流。
- 优先使用 Google Weather API；provider 名称和字段以官方接口为准。
- `USE_MOCK_TOOLS=true` 时不发网络请求，使用确定性 fixture。
- 距出发日期 **≤ 14 天** 时才显示短期 forecast，并带 `observedAt` / `validUntil`。
- 距出发日期 **> 14 天** 时只显示 climate context（多年平均或历史常态），不得称为 forecast。
- provider 失败时回到现有月度背景文案，并在 assumptions 中说明天气数据不可用。
- `packages/agents/src/destination-guide/index.ts` 的 `travelMonth()`、`fallbackDraft()`、
  generator system prompt 和最终 proposal assumptions 必须一起更新，避免一部分文案说“不是预报”、
  另一部分却声称是实时预报。

天气验收：14 天内的行程返回 forecast，15 天及之后返回 climate context；模拟模式不访问网络；
真实 provider 失败时不阻塞整份行程计划，并明确标记天气数据不可用。

实现记录（`feature/weather-capability`）：Google Weather daily forecast 用于距离出发日 10 天以内；
由于 Google 官方接口的 daily forecast 上限是 10 天，距离出发日第 11–14 天使用 Open-Meteo
forecast 作为扩展的真实 forecast provider，仍满足本节的 14 天边界；第 15 天起才进入 climate
fixture。模拟模式不调用任一网络 provider。天气结果已通过 `ToolGateway` 注入 destination guide，
并在 assumptions 与 `AgentProposal.source` 中记录 provider、horizon、观察时间和不可用状态。
Google Weather、Open-Meteo、>14 天 climate、provider 失败和 destination guide 集成均有回归测试。

天气与 provider 分支必须共享同一来源契约：`AgentProposal.source.kind` 使用
`live | estimated | mock | fallback | unavailable`，`label` 只显示 provider/数据来源名称，
`freshness` 描述时间和限制。`kind` 是 UI 可判断的稳定状态，不允许各分支通过自由文本自行约定。

现有 `label` 值都是描述句而不是 provider 名（`accommodation/index.ts:165,170` 的
“Google Places (grounded)”、“Simulated booking data”，以及 `workflow.ts:290-296` 回填的三条），
落地时一并改成 provider 名，描述移到 `freshness` 或 assumptions。

## P1：BeautifulUI 风格的模型思考与回答状态

参考 [Beautiful UI](https://beautifului.dev) 的 AI-native 组件，移植到现有 `ChatPanel` 和
agent progress 区域。它的 Thinking、Task Rows、Streaming Text、Approval Card、Tool Chips、
Recommendation Card 和 Context Cards 都与本项目的聊天规划、agent 协作、HITL 和真实数据来源
展示直接对应。移植的是交互和视觉模式，不直接复制无法确认授权的整站代码。

### 内容边界

- 允许显示高层级状态：正在搜索航班、正在比较酒店、正在检查预算、已找到候选、正在生成回答。
- 不显示模型原始 chain-of-thought、隐藏 prompt 或内部逐步推理文本。
- 可以显示结构化工具调用、来源、结果数量和更新时间，但不能把内部推理当作用户可见回答。

### 推荐组件映射

| 参考模式            | 项目位置                   | 移植行为                                                       |
| --- | --- | --- |
| Loading State       | 规划开始、SerpApi/天气查询 | 低对比度 shimmer 或网格 loader，不阻塞布局                     |
| Thinking            | `ChatPanel` agent progress | 显示当前阶段、当前 agent 和已完成步骤                          |
| Task Rows           | 五个 specialist agent      | queued/running/completed/failed/interrupted 状态行             |
| Streaming Text      | AI 回复                    | 文字逐步出现，完成后显示来源和 follow-up                       |
| Tool Chips          | provider 调用              | `Google Hotels · 3 results`、`Weather API · Sydney` 等紧凑标签 |
| Approval Card       | `CheckpointCards`          | 酒店选择和最终确认保留键盘、焦点和 HITL 语义                   |
| Recommendation Card | 酒店/航班候选              | 价格、来源、评分、时长、匹配理由和操作                         |
| Context Card        | 天气、地点和来源           | 展开查看证据、更新时间和限制                                   |
| Prompt Bar          | 聊天输入区                 | 发送中、停止、重试、日期按钮和清除状态                         |

### 状态流

```text
Idle → Submitting → Thinking → Calling tools → Drafting answer → Complete
                                      └──────→ Degraded / Failed → Retry
```

- 状态文字采用平滑替换，避免整块闪烁。
- spinner 完成后变为 check；失败只做一次轻微错误提示，不持续晃动。
- agent row 展开后显示结构化事件详情，继续使用当前 `<details>`。
- 使用现有 CSS token、`prefers-reduced-motion` 和 ARIA live region。
- 保留当前键盘导航、错误文本、焦点管理和请求取消逻辑。

优先移植：思考步骤列表、流式回答占位、状态文字切换、完成 badge、失败状态卡、tool chips 和
轻量 panel reveal。避免持续旋转、全屏 loading 和会干扰阅读的装饰动画。

实现记录（`feature/ai-progress-ui`）：现有 NDJSON agent 事件已映射为不暴露内部推理的高层阶段
`Submitting → Thinking → Calling tools → Drafting answer → Complete`；ChatPanel 增加当前 agent、
结构化回答生成占位、失败/重试提示和 Stop 操作。保留现有 `<details>` 结构、ARIA live region、
键盘焦点和 `prefers-reduced-motion`，并为阶段、占位回答和取消操作补浏览器回归测试。

当前实现记录（DeepSeek Harness 风格）：旧的进度卡片、阶段轨道、工具 chips 和回答占位已由
`apps/web/components/chat/ThinkingProcess.tsx` 替换为对话流内的 `Think` 行与五个 specialist
subagent 行。五个 subagent 会同时可见，状态仍只来自高层 `AgentProgressEvent`（queued、thinking、
revising、complete、needs attention），展开后只显示 round、summary、constraints 和错误；不显示
原始 prompt 或 chain-of-thought。交互参考 DeepSeek Harness 的 MIT 许可思考行结构与折叠行为，样式
继续使用本项目的语义 token、ARIA 和 `prefers-reduced-motion` 约束。外部工具网关现在也投影为
`tool_started`、`tool_completed` 和 `tool_failed` 事件，动态显示 Search places、Check route、
Search stays、Search flights、Check weather 的真实调用、结果数量和失败状态；Think 行在工具执行期间
显示 Deep diving 动态，并按事件流更新工具行。

## P1：五个 UI 站点的取舍与移植策略

### Beautiful UI：主参考

Beautiful UI 最适合本项目，因为它直接覆盖 AI 产品的 Thinking、Streaming Text、Task Rows、
Approval Card、Recommendation Card、Context Card、Chat 和 Prompt Bar。优先完成上述映射，不
引入它不相关的 CRM 表格、代码编辑器或后台管理页面模式。

### Transitions：微交互来源

参考 [Transitions.dev](https://transitions.dev/) 的以下模式：

- Thinking states：agent 状态文字切换。
- Streaming text：回答逐步出现。
- Skeleton loader and reveal：provider 查询占位到真实卡片的过渡。
- Card resize：展开 agent 详情、酒店候选和 Trip drawer 内容。
- Notification badge：待处理 HITL 数量和 provider 状态。
- Spinner to check：查询完成状态。
- Error state shake：失败时一次性提醒。
- Tabs sliding、Toast 和 panel reveal：局部增强，不改变语义结构。

优先使用可复制的 CSS 模式，不依赖付费 Pro 包；所有动效都必须支持 reduced motion。

### beUI：选择交互，不整体迁移

[beUI](https://beui.dev/) 基于 Motion 和 Tailwind，并通过 shadcn registry 分发。项目现在接入
Tailwind v4 和 source-owned shadcn 基础组件，但不执行整站覆盖；现有 Drawer、Dialog、Tabs 和
CSS token 继续作为行为与视觉约束，组件采用渐进迁移。

可以手动借鉴：

- Animated Toast Stack：provider 错误、降级、保存成功和重试提示。
- Action Swap：Send → Sending → Stop，以及 Retry → Retrying → Done。
- Tabs：Overview/Timeline 和 Forecast/Climate 的 active indicator。
- Number Animation：预算、剩余金额和酒店总价。
- Tooltip：解释估价、来源、更新时间和限制。

不移植 Tilt Card、Dynamic Island、Bloom Menu、Metallic Button 等与旅行规划任务无关的装饰组件。

### Rare UI：只选择有明确任务意义的组件

[Rare UI](https://www.rareui.com/) 通过 shadcn CLI 分发，组件通常依赖 Motion。可参考 Task List
和 Step Player 来强化 agent 流程，但不新增任务数据模型：直接使用已有 agent progress 事件。

Grid Reveal 只在将来有稳定酒店图片或地图缩略图时考虑；Folder、Gravity Letters、Fluid Orb 等
只适合空状态装饰，不能进入真实规划过程或抢夺主要信息焦点。

使用 Rare UI 代码前逐个确认依赖和授权，保留来源署名，不复制整套组件库。

### shadcn/ui：作为设计系统规则

[shadcn/ui](https://ui.shadcn.com/) 采用语义化 CSS variables 和统一 radius scale。当前项目继续
使用自己的 CSS 实现，但按以下模式收敛基础组件：

```text
UiCard · UiBadge · UiStatus · UiButton · UiTabs · UiSkeleton · UiTooltip · UiToast · UiSourceLabel
```

其中 `UiSourceLabel` 统一显示：

```text
SerpApi · Live search
Google Places · Estimated price
Weather API · Forecast
Mock fixture
```

现有 Drawer、Dialog、Sidebar、DateRangePicker 不替换，只统一其 token、状态和动效。

### 版权与直接移植边界

五个站点都只作为组件和交互参考。若需要直接移植代码，先确认组件授权、依赖和可维护性，再
手动改造成当前 CSS/ARIA 结构；不复制整站代码，也不让外部组件覆盖现有主题或焦点管理。

## UI 实现顺序

1. **AI 进度层**：`ChatPanel`、agent rows、loading、streaming answer、error/retry。
2. **真实数据层**：`CheckpointCards`、`ProposalDetails`、`TripPanel` 的来源和价格状态。
3. **天气层**：Forecast/Climate 卡片、更新时间、provider 状态和失败 fallback。
4. **微交互层**：card resize、number pop-in、tab sliding、toast、spinner/check 和 sidebar active pill；
   新增基础交互优先复用 Tailwind/shadcn primitives。

不在第一阶段引入复杂背景、3D 卡片、动态岛或整套 Tailwind/shadcn 重写；当前只做基础层接入和
低风险控件的渐进迁移。

## P1：真实数据卡片与工作区视觉收敛

- 酒店卡片：每晚价、总价、评分、日期、取消政策、来源 badge、详情链接。
- 航班卡片：航司、总价、停留次数、时长、往返信息、来源和票价状态。
- 预算区域：AUD 金额、超预算差额、查询/估算状态和轻量数字变化动画。
- HITL 酒店选择：强化选中态、来源态、禁用态和重新查询状态。
- 空聊天、空地图、加载、错误和真实结果分别设计，不能共用模糊的默认状态。
- 统一按钮、输入框、卡片、标签、阴影、间距和状态颜色；继续保留浅色/深色主题。
- 1600×900、1000 px 边界、375×812、键盘导航和 reduced motion 都要验证。

实现记录（`feature/travel-result-cards`）：Trip drawer 已把 source kind 统一成可复用 badge；酒店
卡片显示 AUD 总价、每晚价、日期、房间/晚数、取消政策、live/estimated/mock 状态和可用详情链接；
航班、活动和天气/地点内容使用同一组结构化 result/context card 样式。预算卡片增加 within/over/
unavailable 状态和可访问的进度条，HITL 酒店选择显示来源和“不会在此预订”的边界提示。真实价格、
估价、mock 和 provider 限制均不再依靠模糊的“simulated”文案。

浏览器验收记录：重建 Next 开发缓存后，首页返回 200，偏好面板和日期日历可打开，375×812 移动
布局可用，交互后无 console error；完整网页测试、lint、typecheck、production build 和 `git diff --check`
均通过。旧开发进程曾因残留 `.next` chunk 返回 500，已通过结束旧进程并重新构建确认不是代码问题。

## 分支与 PR 拆分

后续工作按能力边界拆分，不按 UI 参考站点拆分。分支使用通用命名，和具体工具或 AI 助手无关：

1. `docs/product-closure`：本文件、provider 约定、验收标准和目录说明。
2. `fix/degraded-visibility`：五个 specialist 的降级状态和 UI 可见性，并落地统一的 source kind 契约。
3. `feature/durable-storage`：MemoryStore、聊天/偏好/行程/HITL、SerpApi 缓存和用量计数持久化。
4. `feature/weather-capability`：`WeatherPort`、Google Weather、mock fixture、forecast/climate
   证据和 destination guide 接入。
5. `feature/provider-provenance`：SerpApi、Google Places estimate 和 mock 的来源标签、AUD
   语义、查询时间、失败/降级状态及回归测试。
6. `feature/ai-progress-ui`：ChatPanel 的 thinking/task rows、tool chips、streaming 占位、
   完成/失败/重试状态，以及不暴露原始 chain-of-thought 的可见进度。
7. `feature/travel-result-cards`：酒店、航班、天气、预算和 HITL 卡片，依赖 provider provenance
   和 AI progress UI。

推荐合并顺序是 `docs/product-closure` → `fix/degraded-visibility` → `feature/durable-storage` →
`feature/weather-capability` → `feature/provider-provenance` → `feature/ai-progress-ui` →
`feature/travel-result-cards`。持久化先建立稳定的状态边界；天气和 provider 可以在此基础上提供
可追踪的结果，UI 卡片最后消费这些明确状态。

### 已完成合并记录

| 顺序 | PR  | 内容                                     | 结果                                |
| --- | --- | --- | --- |
| 1    | #31 | specialist 降级状态可见                  | 已合入 `main`（`f79a43b`）          |
| 2    | #32 | 持久化规划状态、HITL、SerpApi 配额和缓存 | 已按 stacked base 合并（`8c25dba`） |
| 3    | #33 | 14 天 forecast/climate 天气能力          | 已按 stacked base 合并（`f68fa1f`） |
| 4    | #34 | 酒店/航班 provider provenance            | 已按 stacked base 合并（`8e6b2ae`） |
| 5    | #35 | AI 规划进度 UI                           | 已按 stacked base 合并（`b5c9242`） |
| 6    | #36 | 真实结果卡片、预算和 HITL 来源状态       | 已按 stacked base 合并（`e79a8a6`） |
| 7    | #37 | 将 stacked 累计结果整合进 `main`         | 已合入 `main`（`056f45f`）          |

由于 #32–#36 当时分别以功能分支为 base，#37 是必要的 mainline integration；没有它，前面
已合并的 PR 虽然存在于 stacked 分支，主线仍不会包含完整实现。

## 当前代码目录约定

本轮先整理最拥挤的 `apps/web`，不改变运行时行为：

```text
apps/web/components/
  workspace/       工作区壳、侧栏、品牌和布局
  chat/            聊天输入、消息和 agent 进度
  trip/            行程、提案、预算和 HITL 卡片
  map/             地图、地点查询 hook 和地图画布
  preferences/     偏好筛选和日期范围
  ui/              Dialog、Drawer、图标等无业务基础组件
apps/web/lib/
  integrations/    Google Maps/Places/Routes/Time Zone 等外部集成
  map/             地点查询和地图视口规则
  planning/        日期范围等规划规则
  trip/            行程编辑契约和计算
  workspace/       工作区持久化模型、catalog 和测试 fixture
apps/web/tests/
  app/              API route tests
  components/       UI component tests
  lib/              domain and integration tests
  fixtures/         shared test data; setup.ts contains test setup
```

`packages/agents`、`packages/services` 和 `packages/tools` 已经按领域分组；后续新增代码继续放入
对应领域目录，不在包根目录新增同层业务文件。每个 package 的生产代码保留在 `src/`，测试保留在
`tests/`。历史 session log 可以保留旧路径，因为它们记录的是当时的文件状态；当前 API 文档和实现
路径应以本目录约定为准。

## P2：后续能力

- 航班延误、登机口和运行状态：需要时再加入 Aviationstack 等专用 provider。
- Travelpayouts：只有在需要 affiliate inventory、预订跳转或合作方数据时再评估。
- 真实 booking、支付、退款和天气历史数据不阻塞当前酒店/航班搜索闭环。

## 暂缓或不纳入当前实现

- 不整体迁移 beUI 或 Rare UI；它们只提供交互和视觉参考。Tailwind/shadcn 已作为基础实现层接入，
  但当前 CSS token 与无障碍结构仍是项目的实现基础。
- 不新增完整的 prompt 快照系统、遥测框架或额外 shared progress event，除非出现明确回归或跨请求
  追踪需求。
- 不把 Travelpayouts、Aviationstack、支付、预订履约或天气历史数据提前加入 MVP。

## 验证命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git diff --check
```

真实 API smoke test 需要在 Next.js 实际读取的 `apps/web/.env.local` 配置 `SERPAPI_KEY` 和
`USE_MOCK_TOOLS=false`。根目录 `.env.local` 只有在 `apps/web/.env.local` 是正确符号链接时才会被间接
读取；`scripts/link-env.mjs` 不会覆盖已有的普通文件。不要把 key 写入文档、测试 fixture 或 Git；
如果 `apps/web/.env.local` 没有 key，即使根目录有 key，P0 真实数据验收也必须标记为
“blocked: runtime credential not configured”。
