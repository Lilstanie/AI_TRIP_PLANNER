<a id="workspace-ui"></a>

# 工作区 UI

[English](workspace-ui.md) | 中文

Web 应用（`apps/web`）是单用户规划工作区。本文描述其当前行为。各阶段的实现历史和浏览器验收记录见[会话日志](../.agents/session-logs/README.md)。

<a id="layout"></a>

## 布局

| 区域           | 内容                                                                                                                   | 实现                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 侧边栏         | Logo、带数量的 Chats 和 Trips、Language、Local account                                                                 | `WorkspaceSidebar`、`BrandMark`、`icons.tsx`                                                                |
| Chats 面板     | 在侧边栏旁滑出：搜索、New chat、New trip，然后是行程和聊天                                                             | `ChatsPanel`、`TripCover`                                                                                   |
| Your trips     | 通过 Trips 打开，替代聊天和地图：行程卡片（Upcoming、Past）、Calendar 标签页和 New trip                                | `TripsPage`、`TripCover`                                                                                    |
| 顶栏           | 行程标题；行程事实标签（目的地、日期、旅客、预算、Preferences）；数据模式；最右侧的 Trip                               | `WorkspaceView`、`TripFactChips`                                                                            |
| 行程事实编辑器 | 每个标签对应一个编辑器，全部为居中对话框；Preferences 保存旅客自己的列表                                               | `FactPopover`、`FactFields`、`TripCalendar`、`WhereFields`、`PreferenceList`、`lib/workspace/trip-facts.ts` |
| 聊天           | 对话、规划 transcript（文本记录）、输入区；空白聊天中的起始建议；没有可见标题                                          | `ChatPanel`                                                                                                 |
| 地图           | 仅包含地图、带标签的标记、按天着色的弧形行程线、地点弹窗、地图状态，以及定位／地图类型／缩放控件                       | `TripMapCanvas`、`TripMap`                                                                                  |
| Your Trip 抽屉 | 预算；Overview（按天排列的地点、各部分方案和所选住宿）；Timeline & routes（日期条、时间线、停靠点编辑器）；Review plan | `Drawer`、`TripPanel`、`TripPlaceList`、`TripEditor`                                                        |

- **侧边栏。**
  - 展开宽度为 240 px（视口小于 1250 px 时为 220 px），或折叠成 64 px 的图标栏。切换按钮使用 `aria-expanded`，偏好保存在目录布局中。
  - 展开时，右边缘的分隔条可将宽度调整到 200–420 px。可拖动，或聚焦后使用 Left/Right（步长 16 px）、Home 和 End；双击恢复响应式默认宽度。它是带 `aria-valuenow` 的 `role="separator"` 窗口分隔控件，拖动时直接把 `--sidebar-width` 写入工作区网格，避免工作区在每次指针移动时重新渲染。只点击而不移动指针，不改变响应式默认值。
  - 用户调整大小之后，宽度才存入目录布局。在此之前遵循样式表的响应式默认值，因此缩窄窗口仍会缩窄侧边栏。折叠时保留宽度，供下次展开使用。
  - 侧边栏只包含导航：带数量的 Chats 和 Trips。轮廓线图标使用文字颜色；对应面板或页面打开时，图标变为填充样式，标签加粗，背景轻微强调，并带 `aria-current`。折叠时显示带名称和 tooltip 的图标按钮。
  - **Chats** 切换 Chats 面板（`aria-expanded`、`aria-controls="chats-panel"`）：它是位于侧边栏右边缘、宽 320 px 的玻璃区域，在工作区上方以 380 ms 的弹性和淡入动效出现（`prefers-reduced-motion` 下立即出现），关闭时为 `inert`。打开时聚焦搜索框；Escape 关闭面板并将焦点返回 Chats（已打开的历史菜单或对话框优先处理 Escape），点击外部也会关闭面板。[Chats 面板和 Your trips Agent Note](../.agents/notes/implemented/feature/2026-09-24-chats-panel-and-trips-page.md) 记录了原因。
  - 面板自上而下依次为：胶囊形搜索框（“Search…”，视觉隐藏标签“Search chats and trips”，以及将焦点返回输入框的 Clear search 按钮），它同时筛选两个列表；New chat（铅笔图标）和 New trip（带加号的行李箱）；**Trips**，每行显示目的地小封面和“Trip to <destination>”；以及 **Chats**，每行用一行显示标题，下方显示关联行程名称。选择任何条目都会关闭面板。两个起始动作的行为见[New chat 和 New trip](#conversations-trips-and-storage)。
  - **Trips** 将顶栏、聊天和地图替换成 Your trips 页面：“Your trips”标题、New trip 按钮，以及 Trips 和 Calendar 标签页（`role="tablist"`，方向键切换）。标签页采用分段控件，滑块在两者之间滑动。Trips 将每个行程显示为 4:3 封面卡片，文字为“Trip to <destination>”和“<destination> · N days”，分成 Upcoming 和 Past 两组。Calendar 是周一为首日的月历网格，提供上一月、Today 和下一月操作；每个行程显示为覆盖其日期的条带，在开始处和每周起点显示标签；默认打开下一次行程所在的月份。选择行程、聊天、New chat 或 New trip 会返回工作区。
  - 行程不保存照片，因此封面使用按目的地哈希选择的渐变色和首字母；同一目的地总是得到同样的颜色。
  - 聊天行右上角的更多操作按钮打开 Rename 和 Delete，使这些操作只在需要时出现。悬停或键盘聚焦时显示按钮；无悬停能力的环境始终显示。菜单由 `role="menu"` 和 `role="menuitem"` 按钮组成，触发按钮带 `aria-haspopup` 和 `aria-expanded`；Escape 关闭菜单并将焦点返回触发按钮，不关闭外层面板或抽屉，点击外部或按 Tab 离开也会关闭菜单。行程没有这两个操作，因此没有更多操作菜单。
  - 窄屏导航抽屉显示侧边栏，并在 Trips 下显示面板内容（搜索、两个起始操作、Trips 和 Chats）。
  - Logo 是 `apps/web/public/brand/ai-trip-planner-logo.svg`，通过 URL 引用。产品名称旁的替代文本为空，单独显示时为“AI Trip Planner”。
  - 最窄的视口下，底部 Language 和 Local account 按钮换行到保存状态下方，不截断保存状态。
- **行程事实。** 行程需求通过顶栏标签逐项编辑，参考 Mindtrip 的行程栏；[偏好标签 Agent Note](../.agents/notes/implemented/feature/2026-09-24-preference-chips.md) 记录了原因。
  - 标签读取偏好草稿，只显示旅客明确陈述的内容：已有值（“Sydney”、“1 Oct – 4 Oct · 4 days”、“2 adults, 1 child”、“AUD 2,000”），或缺失时只显示事实名称：“Where”、“When”、“Who”和“Budget”。换算后的预算在仍与方案匹配时保留“(≈ ¥3,000)”提示。标签组成名为 Trip details 的 `role="group"`；有值标签的无障碍名称以其事实类型开头（“Destination: Sydney”）。
  - 每个标签都是带 `aria-haspopup="dialog"`、`aria-expanded` 和 `aria-controls` 的按钮，打开各自的编辑器：Where（目的地和出发地）、When（完整内嵌日历）、Who（每类旅客一个步进器）、Budget（预设范围卡片和自定义金额），以及 Trip preferences（旅客自己的列表）。
  - 每个编辑器都像 Mindtrip 一样，在遮罩上作为居中模态对话框（`aria-modal="true"`）打开，与顶部保持固定距离，新增行向下扩展。面板本身无内边距：头部左侧为关闭按钮，中间为 20 px 半粗体标题；内容内缩 `--space-5`；右下角有一个 Apple 蓝色胶囊形主操作按钮（`--accent-fill` 填充、`--on-accent` 文字、168 × 40）：Save、Trip preferences 中的 Done，或已有方案时的 Update trip。Trip preferences 头部下方有细线，其他编辑器没有。面板宽 512 px；Who 和 Budget 的较短行采用 420 px；When 的双月日历采用 680 px（全部受 `min(…, 100vw - 2 × --space-4)` 限制）。面板为 28 px 圆角的 Liquid Glass sheet，以弹性动效进入、下沉动效退出（200 ms，`usePresence` 保持挂载），列表行使用 `--radius`（12 px）。
  - Where 按访问顺序将目的地显示为卡片：`--surface-2` 上的 48 px 方形图标区域对应 Mindtrip 中的照片位置（这里不获取照片）；名称为 15 px 半粗体；从建议中选择地点后，名称下显示区域信息；另有 28 px 圆形移除按钮。目的地以“ & ”连接成一个字符串存储。列表下方的 Add destination 胶囊按钮可变成全宽胶囊形搜索框，内部带清除按钮。Enter 添加输入的内容（“Sydney & Melbourne”添加两个，重复项跳过），Save 会保留仍在输入框中的文字。实时数据模式且配置 Maps 时，输入框是 combobox：输入达到 3 个字符且停顿 350 ms 后，从 `/api/places/search` 获取地点建议，每个查询在单次编辑器会话中只请求一次，每个名称中与输入匹配的部分加粗；mock 模式不查询。Escape 先关闭建议，再把输入框收回胶囊按钮（丢弃输入文字），最后才关闭编辑器。
  - Departing from 在 Mindtrip 对话框中没有对应项，但为交通规划提供输入，因此作为目的地列表下方的次要区域保留：小号弱化标签和同样的胶囊输入框，并提示留空将跳过长途航班。没有采用类似目的地的卡片，因为那会像另一个停靠点。也没有采用 Mindtrip 的公路旅行开关，因为规划器没有公路旅行模式。
  - When 显示完整内嵌日历（`react-day-picker`、`mode="range"`），桌面并排显示两个月，手机显示一个月，样式沿用设计 token：圆角日期格、选定范围内的柔和强调色带、起止日期的实心强调色圆、今天的轮廓，以及头部月份导航。过去的日期不可选。日历上方摘要行显示“1 Oct – 4 Oct · 4 days”（尚未选择日期时提示选择），选定日期后旁边显示 Clear 操作。`DateRangePicker`（在独立对话框中的日历，目前未在其他地方使用）共享相同样式的日历组件（`TripCalendar`），避免两者产生偏差。
  - Who 为每类旅客提供一个步进器（− 数量 +）：Adults（13–64）、Children（2–12）、Infants（2 岁以下）、Seniors（65+）和 Pets，各自有减／加按钮和实时数量。草稿保存该分类（`Draft.party`），每次变化都将 `groupSize` 同步为 `adults + children + infants +
seniors`（宠物不计为旅客）；`groupSize` 仍是校验字段，因此至少需要一人。在尚无分类的草稿上打开 Who（保存时还未引入步进器），所有已陈述的旅客起初都计为成年人。
  - 分类以 `TripBrief.party`（方案生成前为 `known.party`）传给规划器，与 `groupSize` 并列。每个 specialist 的共享规则要求它在证据允许时为儿童、婴儿、老年人和宠物规划，并在无法确认适宜性时说明；所有费用计算仍使用 `groupSize`。分类合计不再等于 `groupSize` 时（例如聊天后来得知“we're three now”），会丢弃分类，不再发送。[旅客分类 Agent Note](../.agents/notes/implemented/architecture/2026-09-24-traveller-party.md) 记录了原因。
  - Budget 在一个 `role="radiogroup"` 中提供四个预设范围卡片：Budget（低于 AUD 1,000，设置为 AUD 900）、Moderate（AUD 1,000–3,000，设置为 AUD 3,000）、Comfort（AUD 3,000–6,000，设置为 AUD 6,000）和 Luxury（AUD 6,000+，设置为 AUD 10,000）。各卡片为 `role="radio"`，仅当 `budgetTotal` 与其值完全相等时显示选中（`aria-checked="true"`）。下方“Or enter an amount (AUD)”可直接把 `budgetTotal` 设为任意金额；除非恰好匹配某个预设，否则取消所有预设的选中状态。
  - Trip preferences 打开时显示填充背景的输入框（`--surface-2`、无边框、15 px），Enter 添加偏好；下方每项偏好是一行带移除按钮的填充背景行，最多 12 项，每项最多 200 字符。点击偏好文字可原地编辑（Enter 或离开输入框保存，Escape 只取消此次编辑）；没有铅笔按钮。重复项会被拒绝并显示提示，Done 会保留输入框中尚未提交的文字，添加和移除通过状态区域播报。国籍、房间分配、最低住客评分和免费取消已不再可编辑；已存储行程需求中的值原样透传，已存储但不符合 schema 的评分视为“no minimum”。
  - 编辑器是带标签的 `role="dialog"`。焦点移到首个字段（Where 已有地点时从 Add destination 开始），Tab 在内部循环，Escape、关闭按钮或保存编辑后将焦点返回标签。点击面板外部会落在遮罩上，并将焦点返回标签。打开编辑器会关闭 Trip 抽屉和导航抽屉。
  - 编辑内容在保存前留在编辑器中，因此 Escape 和点击外部都会丢弃编辑。各编辑器用行程需求 schema 校验自身字段，并在字段旁说明如何修正。
  - 没有方案时，Save 把编辑保留在草稿中，不发送请求。已陈述事实以 `known` 随下一条聊天消息发送，Trip preferences 中的 Plan trip 使用完整行程需求规划（`mode: "plan"`）。已有方案时，按钮为 Update trip：保存编辑并使用完整行程需求重新规划，因为聊天消息携带的是方案的行程需求，不是草稿。行程需求被拒绝时，打开首个有误事实的编辑器，在字段旁显示错误。
  - 1250 px 及以上宽度时，顶栏保留行程标题。低于该宽度时由目的地标签标识行程，标题只为辅助技术保留。
- **聊天和地图分栏。** 桌面上，聊天默认位于左侧，占区域的 56 %，略宽于地图。两者之间的分隔条（`role="separator"`、“Resize chat and map”）可把聊天比例调整到 30 %–75 %：可拖动，或聚焦后使用 Left/Right（步长 2 %）、Home 和 End；双击恢复默认值。拖动时直接把 `--chat-share` 写入 shell，布局只在分隔条移动后存储 `chatShare`。
- **抽屉。**
  - Your Trip 和窄屏导航是顶栏下方的覆盖式抽屉。它们从不遮住 Logo 或顶栏按钮，聊天和地图保持原宽度。
  - 桌面上的 Trip 抽屉宽度为 `(1 - --chat-share) × 100%`，无论分隔条在哪里，都恰好覆盖地图。
  - `Drawer` 提供 `role="dialog"`、`aria-modal`，关闭时提供 `aria-hidden` 和 `inert`，打开时聚焦关闭按钮，支持 Tab 循环、Escape（嵌套编辑预览和原生对话框优先），并将焦点返回触发按钮。
  - 同时只打开一个抽屉。关闭的抽屉完全平移到视口外，shell 使用 `overflow: clip`，无法通过滚动使它们出现。
  - 抽屉为悬浮 Liquid Glass sheet，四周内缩 `--space-2`，圆角为 `--radius-xl`。它们沿 iOS sheet 曲线在 380 ms 内滑动，背景遮罩同步淡出（`usePresence` 保持挂载）。所有动效都遵循 `prefers-reduced-motion`。
  - 打开其他聊天或行程、New chat、New trip 和 Your trips 页面时，通过 View Transitions API（`viewTransition`）使主栏交叉淡入淡出；手机上的 Chat/Map 切换采用滑动。主栏只在过渡运行时携带 `view-transition-name`：具名元素是 backdrop root，永久保留名称会导致抽屉玻璃后方的聊天仍然清晰。
- **窄屏（≤1000 px）。**
  - 顶栏把菜单、事实标签和 Trip 保留在一行，下方为 Chat/Map 切换。标签放不下时在自身行内横向滚动，仍有隐藏标签的一侧边缘渐隐；页面本身从不横向滚动。
  - 导航作为抽屉打开，Trip 占满内容宽度。导航抽屉无标题行：它从侧边栏自己的 Logo 行开始，关闭按钮位于行末，对话框通过视觉隐藏的标题（`Drawer` 的 `hideTitle`）保留“Navigation”无障碍名称。
  - ≤520 px 时，顶栏按钮只显示图标，但保留无障碍名称；标签高 44 px；所有编辑器，包括模态编辑器，都作为遮罩上的底部 sheet 打开，行按钮为 44 px。

<a id="conversations-trips-and-storage"></a>

## 对话、行程和存储

- **起始状态。**
  - 页面始终打开空白规划入口，从不加载演示方案，也不重新打开上次行程。
  - 未完成的空白聊天（表单和输入）会继续保留。否则复用未动过的空白聊天，刷新不会增加空聊天。
  - 已保存的聊天和行程，只有从侧边栏选择后才打开。
- **New chat** 创建独立对话，表单、输入和地图均为空。若存在未动过的空白聊天，就复用它，因此反复点击 New chat，或刷新后点击，都会保留一个空对话，不堆积空白历史条目。只要对话含有用户输入过的任何内容，就绝不复用；重命名过的对话保留名称。只有生成方案时才创建并关联行程记录（`tripId`）；此时聊天标题变为目的地和日期。
- **New trip** 启动同样的空白对话，名称为“New trip”，打开 Where 编辑器并聚焦 Destination，而不是消息输入框。它与 New chat 一样复用未动过的空白对话，New chat 会将该对话名称改回。方案生成后才在 Trips 中列出行程；在此之前，它是 Chats 下的空白对话。[New trip Agent Note](../.agents/notes/archived/feature/2026-09-24-new-trip.md) 记录了原因。
- **开始规划。**
  - 空白聊天提供行程示例建议。选择建议会替换消息输入框内容并聚焦，从不发送消息或启动请求。
  - 每个 agent（智能体）回复都显示在自己的 Think 折叠区下：轮次运行时，transcript 在聊天底部流式呈现；随后移到结束该轮次的回复上方，并始终与其关联（重新加载后也保留）。
  - 规划进度是深入展开的 transcript，而非状态列表：`Think`（轮次）按编排轮次嵌套 `Subagent · <name>` 行，各行再嵌套该 specialist 的推理和工具行。每行都使用 DSH 风格的展开控件：左侧图标在悬停或展开时交叉淡变为 chevron，右侧没有 chevron。所有行起初都收起，无论正在运行还是已结束；点击只展开该行，没有全部展开控件。Think 行自身收起时显示该轮次的统计行（`N tool calls · M subagents · K rounds`）；运行中则跟随最新流式推理行，或实时工具／subagent 行。工具行展开后显示结果自己的行，每行带根据结果类型选择的类别图标（刀叉、床、飞机等），如果提供方返回了该行的网页，则显示网站自己的图标。调用参数显示为一行，例如 `Sydney Airport → The Rocks · 2026-11-10`。同一次模型调用的推理增量合并为一行，不以零散片段到达。大于 1 的编排轮次只有附带 coordinator 对修改内容的说明时才显示。所参考的界面，以及每处差异的原因，记录在 [DSH 思考 UI 参考](design/dsh-thinking-ui.zh.md) 中。
  - 界面恰好有一行 `Deep diving`，它是唯一 live region；15 秒后增加已用时间计时。
  - 大多数时候，规划器仍用普通文字提问：缺少目的地、日期、旅客或预算而无法继续时，用一句话说明，旅客通过输入回答，不借用任何值。遇到确实有歧义、且有 2–4 个具体选项的情况，coordinator 可改问结构化问题：卡片替代输入区，显示问题、可选的推荐选项，以及多个问题时的翻页控件。提交后，答案作为旅客的下一条消息发送；关闭卡片恢复普通输入区，无论怎样，问题文字都保留在助手自己的消息中。对于 specialist 已作出的方案选择，仍没有“apply the traveller's decision”功能：结构化问题始终只涉及规划输入，绝不是审批。因此旅客要修改方案本身，仍需在聊天中说明或编辑行程。见 [DSH 思考 UI §3.2](design/dsh-thinking-ui.zh.md#32-asking-the-traveller) 和 [ask-user Agent Note](../.agents/notes/implemented/feature/2026-09-23-ask-user-question.md)。
  - 聊天没有日历弹窗：日期可在输入区键入。When 标签的编辑器仍提供日历选择器，由旅客主动打开。
  - 消息在 `role="log"` 中保留对话顺序；每条消息有一个可见、仅播报一次的说话者标签（You 或 Travel planning assistant）。旅客消息是右对齐气泡；助手回复全宽显示，无边框或背景，以 Markdown 呈现（段落、列表、粗体、在新标签页打开的链接）。两者下方都有小号时间，今天用 `HH:mm`，其他日期用短日期；长 URL 和中英文混排文字在聊天栏内换行。
  - 输入区是聊天底部的一张卡片：草稿随内容增高，随后内部滚动；上传控件在左，唯一主操作在右。卡片使用 `--surface-2`（浅色为白色，深色为灰色），呈现为页面上的输入胶囊；点击其中任意位置，只高亮卡片一次，字段自身不绘制焦点环。Enter 发送，Shift+Enter 换行，但输入法组合输入期间绝不触发。请求运行时，主操作在原位变为 Stop；没有提示文字。
  - 标签编辑器中的 Update trip，或尚无方案时 Trip preferences 中的 Plan trip，携带行程需求发送 `mode: "plan"`。
  - 首条聊天消息发送 `mode: "start"`，服务端报告缺失的目的地、日期、旅客或预算，不借用值。
  - 空白表单的最低评分默认为 `0`（无最低要求）。
- **请求。**
  - `Workspace` 负责聊天、方案和决策请求。失败时保留当前方案，并提供重试。
  - 切换聊天或行程，或 New chat 时，先落盘待执行的自动保存，再中止进行中的请求，并清空进度、错误、选择和地图路线。晚到的响应被忽略。
- **存储。**
  - 所有内容仅保存在浏览器中，侧边栏显示经过防抖的自动保存状态。
  - 目录（`trip-workspace-catalog-v3`）分别保存对话和行程，关联稳定，并可带对话 `draft`。旧版 1 和 2 的快照会迁移。
  - 布局始终存储侧边栏的 `collapsed`，但只在调整大小后存储 `width`，因此未动过的工作区在各视口尺寸下继续遵循样式表。
  - 损坏的数据绝不自动覆盖；布局字段回退到默认值，不会导致历史记录无法读取。
  - 存储已满或不可用时，方案留在内存中，并显示重试操作。
  - 每个已规划行程都会自动保存在目录中，因此没有独立 Save trip 按钮或已保存快照列表。旧按钮留在 `trip-saved-v1` 下的快照既不读取，也不删除；见[工作区目录行程存储](../.agents/notes/implemented/architecture/2026-09-24-workspace-catalog-trip-storage.md)。

<a id="reviewing-a-plan"></a>

## 查看方案

下文提到已移除界面的名称，只用于解释移除情况；除了这些功能不存在之外，本节不描述其他当前行为。

- **没有需要审批的决策。** `HitlCheckpoint`、`TripPlan.hitl`、检查点卡片、approve/reject/defer 操作和 `POST /api/hitl` 都已移除。应用尚不能应用旅客的决策，因此不会请求决策：展示待确认事项列表会暗示并不存在的能力。
- **方案已经作出的决定会报告，而不再询问。** 住宿 specialist 比较全部符合条件的候选项，并选定一个；transcript 显示该选择及比较过的备选项，Trip 抽屉显示各部分及费用。旅客想要不同结果时，在聊天中说明，或在 Timeline & routes 中编辑行程。
- **冲突是信息。** orchestrator 发现冲突时，会在编排轮次预算内重试受影响的部分；仍未解决的内容继续显示在方案中，不会变成等待确认的卡片，因为没有机制记录这种确认。
- 客户端不是供应商事实的来源：总额从提案条目重新计算，结果标记为 SerpApi 实时搜索、Google Places 估价或模拟 fixture。它们都不会创建预订。

<a id="map-and-places"></a>

## 地图和地点

- **地点查询**（`components/map/useTripPlaces`、`lib/map/place-query.ts`）：
  - 查询依次采用已保存的 `placeId`、活动的 `location`，或本身就是地点名称的标题。
  - 活动描述文字和 mock 占位内容（“Mock attraction near …”）绝不发送给 Places，也不虚构内容。
  - 目的地城市（按 `&` 拆分）分别查询，以确定地图视野。
  - 结果逐项应用并留在内存中；提供方详情和坐标不持久化。
- **失败处理。**
  - 没有可用名称或 Google 匹配的活动属于“no confirmed place yet”；时间线显示“Location to be confirmed”。
  - 限流、超时和服务中断可重试，Retry places 只重复这些查询。
  - 地图显示简洁状态；已定位标记保持可见，没有阻断性错误。
- **视野定位**（`lib/map/map-view.ts`）：
  - 地图先围绕目的地定位：一个城市用缩放级别 12，多个城市则使用最大缩放级别为 12 的边界，随着城市逐个解析而扩大。
  - 出现标记后，调整一次视野以容纳标记，最大缩放级别为 15（单个地点为 14）。
  - 仅在行程或目的地变化时重新定位。拖动、缩放和 Show my location 都算用户移动，绝不撤销这些操作。
  - 没有可展示位置前，不创建 Google 地图，而显示中性占位界面。容器调整大小时保留中心点。
- **标记**（`components/map/map-layers.ts`、`lib/map/place-category.ts`）。每个已定位停靠点在地点位置显示当天颜色（`--day-1` … `--day-7`）的编号徽章，旁边为胶囊形标签：按 Google 的 `primaryType` 选择的类别图标，以及截到 22 字符的地点名（选中时为 26 字符）。停靠点按访问顺序编号，先按天，再按开始时间。缩放级别低于 12 时，只有选中停靠点保留标签；地图稳定后，若标签会与已显示标签重叠，就隐藏该标签（选中项优先，其次按访问顺序）。标记绝不加载地点照片。
- **行程线**（`lib/map/itinerary-route.ts`、`components/map/map-layers.ts`）。每天的停靠点按访问顺序连接。如果准确对应这两个地点的已验证 Google Routes 折线存在，该路段沿折线绘制；否则使用柔和弧线（`curvedPath`，Web Mercator 中向行进方向左侧弯曲的二次曲线），让一天呈现为连贯路径，而非锯齿线。不会仅为画线而请求路线。聚焦的日期（选中停靠点所在日期，未选中时为所有日期）采用 Apple Maps 风格，以当天颜色绘制在 `--route-casing` 上；每段中点有指向下一停靠点的白色 chevron，并有从一站流向下一站的白色虚线；其他日期显示为细的静态 `--text-dim` 线。虚线通过单个 `requestAnimationFrame` 循环运动，限速约每秒 30 帧；线条重绘或地图卸载时停止。`prefers-reduced-motion: reduce` 下虚线静止，不运行循环。不是行程路段的已验证路线，例如编辑预览，保持实线。地图遵循系统浅色或深色方案。
- **地点弹窗。** 点击标记或标签，或 Trip 抽屉中的地点，会在地图左下方打开地点详情：停靠点编号和日期、首张 Google 照片、名称、地址、Google 评分、照片作者署名和 Open in Google Maps 链接；得知旅客位置后，还显示 Route from my location。只有实时数据模式且配置了服务端 Maps 密钥时才加载照片，每次选择一张。其他情况下，以及 Google 没有照片或图片加载失败时，固定 16:9 区域显示图钉。点击标记会将焦点移入弹窗；关闭按钮、Escape 或点击地图会关闭弹窗，并将焦点返回标记。抽屉中选择的地点若在地图视野外，会平移到视野内，该行为不算用户移动。
- **选择。** 选择标记或抽屉地点，会选中时间线中的活动并跳到对应日期；反向操作同样有效。选中标记使用较大的轮廓徽章和带边框标签，抽屉对应行除 `aria-pressed` 外，还在左侧增加内缩线并加粗；颜色不是唯一提示。其他日期的停靠点弱化为无标签的灰色徽章。
- **Trip 抽屉。** 阅读顺序为标题和摘要、预算，然后是 Overview 标签页：Places 列表（按天及访问顺序列出每个行程活动；已定位停靠点是按钮，可通过键盘访问各标记；其他项说明为何不在地图上）、各部分方案，再到展开详情。预算缺失或为零时，说明未设置预算；无效总额绝不显示为 `NaN`、负值进度条，或超出容器宽度的条形。
- **位置。** 工作区打开时，在通知条中用自己的文字询问是否显示旅客位置（`components/map/useUserLocation.ts`、`LocationPrompt`）。只有点击 Allow location 或 Show my location 后，才显示浏览器权限提示。Not now 会记录在此浏览器中（`trip.locationPrompt`），问题不再出现；点击 Allow 且浏览器仍授予权限后，后续访问直接显示位置，不再询问。浏览器已经阻止定位时，跳过提问。拒绝、不可用、超时和不支持的情况在地图上解释。只存储回答：位置留在内存中，绝不保存或写入方案。Route from my location 请求到所选地点的已验证时长和距离。见[位置提示 Agent Note](../.agents/notes/implemented/feature/2026-09-24-location-prompt-and-itinerary-map.md)。
- **控件。** 右下角堆叠圆形玻璃按钮，参考 Mindtrip 和 Apple Maps：Show my location（定位箭头；请求位置，已知位置时将其居中并缩放到 14 或更近；位置显示时图标填充，失败后名称为 Retry my location）、Satellite view（`aria-pressed`，在道路地图和混合影像间切换），以及合为一个胶囊的 Zoom in / Zoom out。旅客位置是 Apple 风格的蓝点，带缓慢变化的光晕。Google 自带控件全部禁用（`disableDefaultUI`），滚轮缩放和单指平移无需修饰键（`gestureHandling: "greedy"`）；仅开发环境的 `/debug/map` 页面使用固定悉尼停靠点显示地图，不请求 Places 或价格。

<a id="timeline-editing"></a>

## 时间线编辑

Timeline & routes 标签页（由 `TripEditor` 组合 `components/trip/timeline/`）一次显示一天，通过 `POST /api/trip/preview-edit` 编辑活动。预览是确定性的，不调用 LLM（大语言模型）。

- **布局。** 日期标签条（`Day 2 · Sun, 18 Oct · 3 stops`，停靠点需要地点时带标记）用于选择日期。当天按时间顺序呈现为竖线（`lib/trip/timeline.ts`）：无具体时间的航班在最前，带时间的城际路段和停靠点按开始时间排列，当晚入住在最后，后续夜晚显示“Staying at …”。固定行显示图标、标题、一行详情及费用（“Fare not published”或“Price unknown”，而非 AUD 0）。两站之间的路程显示路线检查得到的“Walk · 6 min · checked”，或以规划器的 `arriveBy` 作为估计。
- **价格。** 没有提供方公布门票价格，因此行程停靠点不带 `estCost`，显示“Price unknown”；预算卡补充“Not included: admission for N stops with no published price”，避免把总额理解为全部费用。
- **编辑。** 停靠点在此处或地图上被选中前保持紧凑；选择后打开编辑器：开始和结束时间（“Preview time change”）、Move earlier / Move later、Move to another day，以及用于替换地点的 Google Maps 搜索。地图按名称匹配但尚未确认的停靠点提供“Use this place”。仍支持拖放调整当天顺序。
- **路线检查。** 提供 Walk / Public transport 切换和“Check routes for Day N”；当天有两个地点已确认的停靠点时启用，下方提示说明缺少哪个条件。
- **审查。** 每次编辑打开“Review this change”：显示新总额和差额、每个移动停靠点一行、已检查路线、阻断项，以及仅由此次变化新增的冲突。Apply changes 应用修改；Cancel 或 Escape 只关闭预览。应用编辑后显示“Undo last change”，撤销也用同样方式预览。
- 编辑待处理时，聊天输入区无法发送（`ChatPanel` `locked`），但聊天不显示思考行或停止按钮：待处理编辑不是聊天请求。

- 活动只分配一次稳定 ID，重排和恢复时保留。`editVersion` 独立于 orchestrator 的编排轮次，只有基础版本仍匹配时才能应用预览。
- 移动、时间变化和地点替换保留活动时长。后续活动开始时间取原开始时间与前项结束时间 + 路线时长 + 15 分钟中的较晚值。空目标日期从当地 09:00 开始，移动不跨越同一住宿目的地区段。
- 未知路线阻止自动顺延（用户可调整时间或模式）。超出当天范围会阻止应用。固定交通和住宿只读，重叠在审查中保持可见。
- 替换地点会将活动价格标记为待验证。路线票价是独立估计，不会在交通费用中重复计入，未知票价不等于零。
- 编辑使行程和最终确认失效，并重新生成冲突，保留未受影响的行程需求和酒店决策。撤销会重新验证，而非恢复旧审批。聊天重新规划会替换手动活动。
- 路线使用 Google Time Zone API 提供的真实当地出发时间；有歧义或不存在的夏令时时刻会被拒绝。公共交通查询遵循 Google 支持的出发时间窗口。
- Google 无公共交通回答的路段（日本没有公共交通数据），或公共交通超过 90 分钟且超过驾车时长两倍的路段，会返回为驾车路段（`mode: "drive"`）并明确说明，不报告为无法规划路线。两个行程城市之间的路段先通过 SerpApi 尝试 Google Maps 公共交通（Tokyo → Kyoto：含票价的新干线），只有找不到结果时才驾车。

<a id="google-maps-configuration"></a>

## Google Maps 配置

| 变量                              | 使用方                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| `MAPS_API_KEY`                    | 服务端：Places 搜索和详情、Routes、Time Zone                |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 浏览器：Maps JavaScript API                                 |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`  | 浏览器：供高级标记使用的矢量地图 ID（回退到 `DEMO_MAP_ID`） |

按 HTTP referrer 限制浏览器密钥，按 API 限制服务端密钥。地图加载从不延迟首次渲染；没有浏览器密钥时，地图显示回退界面，行程仍可使用。

<a id="out-of-scope"></a>

## 范围之外

预订履约、支付、多用户协作和旅行中模式仍不在范围内。Mock 地点和预订绝不能呈现为真实供应商数据；实时搜索和估算价格必须保留提供方和新鲜度标签。

<a id="visual-verification-matrix"></a>

## 视觉验证矩阵

每次视觉变化都使用此检查清单。它补充而不改变上文描述的布局和抽屉行为。

| 维度     | 必需检查                                               |
| -------- | ------------------------------------------------------ |
| 视口     | 1600×900、接近 1000 px 响应式边界，以及 375×812        |
| 主题     | 每个相关视口的浅色和深色主题                           |
| 动效     | 默认值和 `prefers-reduced-motion: reduce`              |
| 输入     | 鼠标和完整键盘导航，包括可见焦点                       |
| 工作区   | 侧边栏调整大小／折叠、Chat/Map 切换，以及无横向溢出    |
| 覆盖层   | 导航和 Trip 抽屉、标签编辑器；关闭、Escape 和焦点返回  |
| 内容     | 空聊天／地图、规划和失败状态、长消息，以及可用地图地点 |
| 原生控件 | 日期、选择框、复选框和滚动条遵循当前颜色方案           |

桌面（1600×900）和窄屏（375×812）验收均保留浅色、深色截图。使用对比度工具验证正文和辅助文字对比度；颜色不可用时，状态仍必须有文字或图形提示。

不加载 Web 字体：正文和控件通过系统字体栈使用 SF Pro Text，标题使用 SF Pro Display，中文回退到 PingFang 和 Hiragino。`color-scheme: light dark` 保持原生控件与当前主题一致。

<a id="verification"></a>

## 验证

复杂 UI 功能优先只使用 E2E 测试验证行为：走完整旅客流程，并留下可复现的产物。上文要求的浏览器截图是有用的审查证据；同时记录复现 E2E 运行所需步骤和命令。

以下是当前回归测试清单，不是要求在实现之后新增组件测试。`pnpm typecheck`、`pnpm lint`、`pnpm test` 和 `pnpm build` 是仓库当前检查。组件测试覆盖抽屉、行程事实标签及其编辑器、空白起始、历史恢复、侧边栏折叠、地点查询失败、请求竞争和存储恢复、位置询问、抽屉地点列表和地点弹窗；`lib/map/map-view.test.ts`、`lib/map/place-query.test.ts` 和 `lib/map/itinerary-route.test.ts` 覆盖视野定位、查询规则、访问顺序和线条动画的减少动态效果分支。真实 Google 检查在会话日志中单独报告，绝不从 mock 推断。历史 P0–P3 方案见 [`.agents/archive/p3-implementation.md`](../.agents/archive/p3-implementation.md) 和会话日志。
