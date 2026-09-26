<a id="dsh-thinking-ui-reference"></a>

# DSH 思考过程 UI 参考

[English](dsh-thinking-ui.md) | 中文

本文记录 DeepSeek Harness（DSH，即 `deepseek-harness` 仓库）如何渲染一个 agent（智能体）轮次——运行中的「Deep diving」行、Think 行、工具行和 subagent 行——并对照本项目的聊天界面（`apps/web/components/chat/ThinkingProcess.tsx`）。

编写本文是因为 `ThinkingProcess.tsx` 已经借用了 DSH 的术语（Think、Subagent、「Deep diving」、按 agent 分行），却没有书面记录说明它所模仿的行为。DSH 代码引用是编写时该仓库中的路径；本项目代码引用是本仓库的当前路径。

本文有两个目的：精确描述 DSH，使其时序与结构可被复制；说明本项目哪些部分已经一致、哪些存在差异，以及需要修改什么。

<a id="1-how-dsh-renders-a-turn"></a>

## 1. DSH 如何渲染一个轮次

<a id="11-pipeline"></a>

### 1.1 流水线

DSH 从不保留第二份视图状态。三个层次将一个轮次从会话日志传递到屏幕：

```text
Session log (durable events) + assistant/live-chunk (client-only transient events)
        |  Session Controller keeps one contiguous window
        v
ConversationNodeAssembler - each package registers a ConversationNodeDefinition:
        match(event) -> start/update folds State -> buildViewNode() emits a target node
        v
Chat Node -> keyed renderer ('conversation.chat.node' dispatches by node kind)
        v
AssistantMarkdown / ReasoningRow / ToolCallTree / TurnProcessNodeView
```

复制这些行为时，有两个关键属性：

- **发布节奏由定义声明，而非推断。** 每个定义针对每次匹配返回 `immediate`、`animation-frame` 或 `none`（`packages/client/ui-chat/src/client/conversation-nodes/
turn-process.ts:240-246`）。可见文字、推理（reasoning）和工具参数增量为 `animation-frame`；`usage` 和 `finish` 分片为 `none`；工具调用、步骤 / 轮次边界和已结束的消息为 `immediate`。
- **高频节流使用三个动画帧，而非一个。** `BoundConversation.publish` 串联三次嵌套的 `requestAnimationFrame` 调用，将后续 `animation-frame` 发布合并到待执行链中；一次 `immediate` 发布会取消该链并同步刷新（`packages/client/ui-conversation/src/client/conversation/assembly.ts:130-158`）。优先级表为 `none < animation-frame < immediate`（`assembler.ts:54-58`）。

有一个值得记录的陷阱：DSH 的 `packages/client/AGENTS.md` 声称流式分片使用 `Notifier.markFrameDirty()`，但生产代码没有调用该方法。实时分片通过 `markDirty()` 处理，逐帧门禁就是上述三帧链。

<a id="12-the-running-line-deep-diving"></a>

### 1.2 运行行：「Deep diving」

轮次运行时，DSH 对整个轮次只显示一行文字——并非每个步骤一行，也并非每个 agent 一行。标签位于 `TurnProcessNodeView.tsx`（`packages/client/ui-chat/src/client/chat/TurnProcessNodeView.tsx:13-58`）：它与轮次结束后收起为 `N tool calls · M messages ·
K subagents` 摘要（§1.4）的过程折叠按钮是同一个按钮；在结束前，该按钮以运行文字作为标签。

| 属性     | 值                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文字     | `chat.deepDiving` — `Deep diving...` / `深度求索中`（`ui-chat/src/client/locale.ts:226`、`:68`）；存在持续时间后使用 `message.turnProcess.deepDivingFor`                        |
| 动效     | **无。** `TurnProcessNodeView.module.css` 为标签设置普通的 `color: var(--dsw-alias-label-tertiary)`，仅在悬停时用 100ms 过渡到 `label-primary`；运行时没有闪光、渐变或动画      |
| 颜色     | 普通的三级标签颜色，与空闲标签相同，不是品牌蓝                                                                                                                                  |
| 时钟     | 一旦存在 `turn.start` 就显示（`Math.max(1000, (turn.end?.time ?? now) - turn.start.time)`），没有隐藏时段；以 1 Hz 更新（`LIVE_RUN_CLOCK_INTERVAL_MS`、`message-chrome.ts:13`） |
| 时间锚点 | 轮次的 `start` 时间，因此轮次中途重新加载仍保留真实耗时                                                                                                                         |
| 无障碍   | 一个视觉隐藏的同级 `role="status" aria-live="polite" aria-atomic="true"` span 承载播报文字；可见按钮本身不是实时区域                                                            |
| 减少动效 | 不适用，没有需要减少的动效                                                                                                                                                      |

`ChatView.tsx`（311 行）和 `ChatView.module.css`（168 行）都没有「Deep diving」渲染，也没有任何渐变或闪光规则。`TurnProcessNodeView.module.css` 从创建（`8b09a0be52`，「fold turn process before final answer」）到当前 master（`c36a83ff6b`）的完整 git 历史中，也从未出现闪光、渐变或蓝色。

DSH 实际拥有、而下文 §2 借用的是：DSH 中所有_其他_运行行标签——运行中的过程组标题（`ui-chat/src/client/chat/ChatGroupSeat.tsx:129`）、运行工具行的摘要（`ui-tool/src/client/tool/components/ToolRow.tsx:213,223,227`）和共享展开行标题（`ui-primitives/src/DisclosureRow.tsx:103`）——都用 `TextShimmer` 包裹文字（`ui-primitives/src/TextShimmer.tsx` + `.module.css`）：基于 `currentColor` 的渐变文字扫光，`background-size: 250% 100%`、`background-clip: text`、`1.5s cubic-bezier(0.33, 0, 0.67, 1) infinite`，关键帧为 `66.6667%, 100% { background-position: 0% center }`，扩散宽度通过 `--dsh-text-shimmer-spread` 按 `children.length * 8`px 缩放。减少动效时删除渐变（`background-image: none; -webkit-text-fill-color: currentColor; animation: none`），而非仅将其冻结。颜色始终是 `currentColor`，从不是蓝色渐变；标签保留已有文字颜色（`ChatGroupSeat` 中为 `label-secondary`，运行工具行中为三级颜色）。

「每个轮次一行」是本节最值得借鉴的规则，它让长时间的多专职 agent 运行不会看起来像闪烁的仪表盘。上述时钟行为（立即显示，以 1 Hz 更新）也值得按其描述借鉴。本项目自己的 15 秒时钟延迟（`CLOCK_DELAY_MS`、`thinking-model.ts:60`）是本地新增行为，并非 DSH 行为；见 §2。

<a id="13-the-think-row"></a>

### 1.3 Think 行

推理块渲染为默认收起的展开行，而非正文（`packages/client/ui-chat/src/client/chat/ReasoningRow.tsx:28-63`）：

- **收起摘要随阶段变化。** 运行时显示推理文字的_最后_一行（模型当前在做什么）；结束后显示_第一_行（它得出了什么结论）。仅在摘要中移除双星号标记。
- **展开显示完整文字**，使用 `white-space: pre-wrap`，缩进在标题下方，采用次级字号层级和三级标签颜色。
- **收起框锁定高度**（`contain: size layout; height: 24px`），避免每个流式分片都重新排布 transcript（文本记录）。
- **运行状态使用扫光，不使用旋转加载图标**：300px 渐变带以 `left: -300px -> 100%` 移动，时序为 `2.6s ease-out infinite`，最后 90% 处停留。工具行、bash 行、命令行和 skill（技能）行复用同一效果。
- 视觉隐藏的 `Running` 标签为辅助技术表达状态，因为扫光仅通过颜色传达。

<a id="14-the-process-fold"></a>

### 1.4 过程折叠区

轮次得到最终回答后，DSH 将所有过程行收起到一个摘要按钮后（`ui-chat/src/client/chat/TurnProcessNodeView.tsx:13-58`）：

```text
N tool calls · M messages · K subagents
```

若无内容可计数，回退为 `Thought for a while`。计数在定义中累计，而非渲染时扫描计算；subagent 委派从工具调用计数中单独划出（`conversation-nodes/turn-process.ts:170-206`）：

```ts
if (event.type === "tool/call") {
  const subagent = isSubagentDelegationTool(event.data.name);
  current = {
    ...current,
    toolCallCount: current.toolCallCount + (subagent ? 0 : 1),
    subagentCount: current.subagentCount + (subagent ? 1 : 0),
  };
}
```

影响体验的行为细节：

- **默认收起。** 展开状态是以 `(turn, answerStep)` 为键的存储条目；没有条目表示收起，重新生成回答会使条目失效。
- **收起不等于卸载。** 隐藏的过程行通过 `hidden="until-found"` 保留在 DOM 中，因此浏览器查找仍能匹配；匹配时，`beforematch` 监听器展开轮次（`ui-chat/src/client/chat/searchable-hidden.ts:17-29`）。
- **回答紧贴折叠区。** 收起折叠区与其回答之间的 transcript 列间距从 16px 缩减为 8px。
- **箭头旋转**，`-90deg -> 0deg`、`100ms ease`，而非替换字形。
- 设置行可以关闭整个折叠区（Normal 与 Compact transcript，默认 Compact），此时过程行恢复为平铺列表。

<a id="15-tool-rows"></a>

### 1.5 工具行

一次工具调用对应一个 24px 展开行：前置图标、标题、2x2 分隔点，以及填满剩余空间并以省略号截断的摘要（`packages/client/ui-tool/src/client/tool/components/ToolRow.module.css`）。两个相互独立的属性决定该行：

- **类型** — 属于哪种工作：`search | read | bash | write | edit | code | others`，根据协议中的工具名称查找。
- **状态** — 进展如何：`running | ok | error | stopped`。没有 `pending` 和 `cancelled`。

| 状态      | 前置视觉元素               | 动效                             | 隐藏状态文字 |
| --------- | -------------------------- | -------------------------------- | ------------ |
| `running` | 类型自身的图标             | 行扫光，`2.6s ease-out infinite` | `Running`    |
| `ok`      | 类型自身的图标             | 无                               | —            |
| `error`   | `StateDot state="error"`   | 无                               | `Failed`     |
| `stopped` | `StateDot state="warning"` | 无                               | `Stopped`    |

表格背后的规则是：**图标说明它是什么，状态点说明结果如何。** 运行行保留工具图标。未知工具回退为通用行（闪光图标、`Tool call` 标题、`<name> · <first argument>` 摘要），绝不显示为空白行。

展开后显示按类型选定的结构化内容（终端、差异、读取、搜索、网页、图像、问题），或一张 IN/OUT 卡片；两侧各限高 150px，独立滚动，侧栏标签固定。聊天层的读取 / 差异 / 搜索卡片最多显示 8 行。失败时，以错误的第一行_替换_摘要，而非追加。

嵌套调用使用同一规则缩进到父级之下（`ToolCallTree.module.css`）：`margin-left: 22px; padding-left: 8px; border-left: 0.5px solid
var(--dsw-alias-border-l2)`。深度不限，也不新增样式。

<a id="16-subagents"></a>

### 1.6 Subagent

- 委派工具为 `subagent` 和 `subagent_*`；控制工具（`send_message`、`interrupt_agent`、`list_agents`）有意不计入委派（`ui-chat/src/client/contract/turn-process.ts:53-61`）。
- **没有专用 subagent 卡片。** 委派通过通用工具行渲染；过程折叠区中的 `N subagents` 计数和子会话共同表达其独立身份。
- **打开子会话会切换整个界面**，不会嵌套 transcript。标题面包屑保持 `parent / child` 可见，侧边栏完全隐藏 subagent 对话（`ui-workspace/src/client/tree.ts:146`）。
- 已结束的后台子会话以持久化且带来源标注的消息返回（`source.kind:
'subagent-settled'`），渲染为默认收起的「Context injection」行；子会话自己的文字始终与运行时对它的描述区分开。
- 运行状态使用 1 Hz 的 8 格像素追逐动画，持续时间每秒更新一次。只有目录打开_且_有任务运行时才启动计时器；已结束的行冻结在最后记录的时间区间边界，不再随时钟变化。

<a id="17-icons-and-motion"></a>

### 1.7 图标与动效

`StateDot` 是共享状态标记（`ui-primitives/src/StateDot.tsx`）：

| 状态      | 颜色语义                                                     | 绘制方式                                                                                                                                               |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `done`    | 成功                                                         | 实色：10% 光晕层加缩放至 60% 的核心                                                                                                                    |
| `warning` | 警告                                                         | 同上                                                                                                                                                   |
| `error`   | 错误                                                         | 同上                                                                                                                                                   |
| `idle`    | 三级标签                                                     | 同上                                                                                                                                                   |
| `ongoing` | 运行蓝色，是唯一没有别名 token 的状态色，固定为静态 450 色阶 | 10x10 网格上的 8 个 2x2 单元，在 0/12.5/25/37.5% 处离散切换亮度 `1 -> 0.6 -> 0.35 -> 0.15`，`1s infinite`，每个单元偏移 `-125ms`，使追逐从周期中途开始 |

对话界面的动效清单：

| 效果                | 时序                                                           | 位置                                                                                                                 |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 行扫光              | `2.6s ease-out infinite`，300px 光带，90% 处停留               | 思考、工具、bash、命令、skill 行                                                                                     |
| 文字闪光            | `1.5s cubic-bezier(0.33, 0, 0.67, 1) infinite`，`currentColor` | 运行中的过程组标题、工具行摘要、展开行标题（`TextShimmer`）；**不包括**每轮「Deep diving」行本身，该行无动效（§1.2） |
| 重试闪光            | `1.6s ease-in-out infinite`                                    | 模型重试行                                                                                                           |
| 状态追逐            | `1s infinite`，阶梯变化                                        | `StateDot ongoing`                                                                                                   |
| 图标 / 箭头交叉淡化 | `100ms ease`                                                   | 展开行                                                                                                               |
| 展开箭头旋转        | `100ms ease`                                                   | 过程折叠区箭头                                                                                                       |
| 目录箭头            | `120ms ease`                                                   | subagent 树                                                                                                          |
| 导轨宽度 / 颜色     | `140ms ease`                                                   | 轮次导航器                                                                                                           |
| 导轨位置            | `220ms cubic-bezier(0.2, 0.8, 0.2, 1)`                         | 轮次导航器                                                                                                           |

有意省略的两个元素值得了解，因为它们很容易被惯性添加：

- **agent 界面没有旋转加载图标。** `IconLoadingOutline16` 存在，但仅用于文档加载。运行状态使用扫光、追逐或文字闪光。
- **没有流式光标。** 客户端没有任何输入光标或闪烁方块；唯一的 `caret-color` 是输入框自己的。终端渲染器有意不实现 ANSI 闪烁。

DSH 的减少动效支持尚不完整：思考行、运行行、命令行、重试行和 skill 行遵循 `prefers-reduced-motion`，但工具行扫光、`StateDot`、subagent 箭头、待办圆环和输入框等待点不遵循。这些缺口应当作为缺陷修复，而非仿照。

<a id="2-what-this-project-does-today"></a>

## 2. 本项目目前的实现

聊天界面位于 `apps/web/components/chat/ThinkingProcess.tsx`，由 `apps/web/components/chat/ChatPanel.tsx` 在标为「Thinking process」的 `section.agent-activity` 中渲染。`apps/web/components/chat/thinking-model.ts` 从 `activity`（`AgentProgressEvent[]`）派生树结构，不含 React；`Disclosure.tsx` 是从 DSH 移植、树中每行都使用的统一展开控件；`ThinkingRows.tsx` 基于它渲染推理、subagent 和工具行。样式位于 `apps/web/app/styles/thinking.css`；协调者的问题或者通过 assistant 自己的文字消息呈现，或者以结构化问题交给 `QuestionComposer.tsx` 替代输入框（`apps/web/app/styles/question.css`）；普通输入框位于 `apps/web/components/chat/Composer.tsx`。消息本身由 `MessageItem.tsx` 渲染（`apps/web/app/styles/messages.css`）。设计 token 位于 `apps/web/app/styles/tokens.css`，进度帧是 `packages/shared/src/chat.ts` 中的 `AgentProgressEvent` 可辨识联合类型。

该界面逐行对应 DSH：

| DSH 概念                                                                      | 本项目                              | 位置                                                        |
| ----------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `DisclosureRow`：前置图标交叉淡化为箭头，无后置箭头                           | `Disclosure`                        | `Disclosure.tsx`                                            |
| 每轮的过程入口，带计数行，默认收起                                            | `ThinkRow`                          | `ThinkingProcess.tsx`                                       |
| 推理块作为独立展开行，每次模型调用一个                                        | `ReasoningRow`                      | `ThinkingRows.tsx`, `thinking-model.ts`（`mergeReasoning`） |
| Think 下嵌套 subagent 行，每个（轮次、agent）一个                             | `SubagentRow`                       | `ThinkingRows.tsx`, `thinking-model.ts`                     |
| 带运行 / 完成 / 失败状态的逐工具行，嵌套在各自 subagent 下                    | `ToolRow`                           | `ThinkingRows.tsx`                                          |
| 展开工具显示结果自身的行，每行带类别图标                                      | `ToolRow` 内容、`ResultKindIcon`    | `ThinkingRows.tsx`, `flow-icons.tsx`                        |
| 每轮一条「Deep diving」行，15 秒后显示时钟                                    | `RunningLine`                       | `ThinkingRows.tsx`                                          |
| 带阶梯追逐效果的状态点                                                        | `StatusDot`                         | `ThinkingRows.tsx`                                          |
| agent 作出的选择及其备选项                                                    | `ChoiceBlock`                       | `ThinkingRows.tsx`                                          |
| 在工作发生前说明轮次边界                                                      | `RoundHeading`                      | `ThinkingRows.tsx`                                          |
| DSH 的 14px 图标集（Think、箭头、搜索、地球、subagent、闪光、勾选）及类别图标 | —                                   | `apps/web/components/ui/flow-icons.tsx`                     |
| 输入卡片                                                                      | `Composer`                          | `Composer.tsx`, `composer.css`                              |
| 替代输入框的结构化问题卡片                                                    | `QuestionComposer`                  | `QuestionComposer.tsx`, `question.css`                      |
| 全宽 assistant 回答、右对齐用户气泡、每条消息下的时钟                         | `MessageItem`                       | `MessageItem.tsx`, `messages.css`, `message-chrome.ts`      |
| 每种效果都支持减少动效                                                        | `prefers-reduced-motion` 块         | `thinking.css`, `composer.css`                              |
| 面向辅助技术的文字状态                                                        | `statusLabels`、每行的 `aria-label` | `thinking-model.ts`, `ThinkingRows.tsx`                     |

必须明确哪些行为不可撤销：每行都有表达状态的文字标签，每个可展开详情都是真正的 `aria-expanded` 按钮而非样式化 div，运行行是 transcript 中唯一的实时区域，每种动画都支持减少动效，而且每行默认收起，打开一行永不打开其同级行。

<a id="3-where-it-diverges"></a>

## 3. 差异

下表是首次移植时的缺口清单。此后每项均已解决；「修复方式」列列出关闭缺口的变更。

| #   | DSH                                     | 本项目此前                                                                                                           | 后果                                                   | 修复方式                                       |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| 1   | 每轮一条运行行                          | `processSummary` 可返回 `Deep diving · <tool>`，_同时_ `.thinking-deep-dive` 在 `busy` 时渲染第二条「Deep diving」行 | 两个实时指示器描述同一个轮次                           | 4.1 — 一个 `RunningLine`，一个实时区域         |
| 2   | 状态为永不淡出的状态点                  | 状态使用文字符号（`· ✓ ! ■ ○`），由 `thinking-pulse` 将不透明度在 `0.35 <-> 1` 间变化                                | 淡化被理解为「加载」而非「进行中」；符号集缺乏统一规则 | 4.2 — 带阶梯追逐效果的 `StatusDot`             |
| 3   | 过程行收起到一个计数摘要后              | `ThinkingProcess` 无条件渲染 `ThinkRow` 加全部 5 个 `SubagentRow`                                                    | 完成后 transcript 永久保留一个五行块                   | 4.3 — 轮次结束后过程收起                       |
| 4   | 折叠行列出三项计数                      | 展开的 Think 行只说 `x/5 subagents have reported back`                                                               | 无法直观看到工具调用或轮次数量                         | 4.3 — `N tool calls · M subagents · K rounds`  |
| 5   | 同一扫光效果：300px、90% 处停留         | 两个 180px 扫光，加上三个不同元素上的 `thinking-pulse`                                                               | 「运行」的视觉表达不统一                               | 4.4 — 一个 `thinking-sweep`、300px、90% 处停留 |
| 6   | SVG 箭头从 `-90deg -> 0deg` 旋转，100ms | 文本 `⌄` 从 `translateY(-2px)` -> `rotate(180deg) translateY(2px)`，160ms                                            | 旋转文字符号改变基线，且不匹配折叠时序                 | 4.6 — `ChevronIcon`，100ms 旋转                |
| 7   | 15 秒后显示耗时时钟，锚定轮次开始时间   | 无                                                                                                                   | 长时间运行没有持续时间感                               | 4.5 — `RunningLine` 时钟                       |
| 8   | `role="status"` 仅限运行行              | 整个 `.thinking-process` 容器设置 `aria-live="polite"`                                                               | 每个进度帧重新播报整个过程区域                         | 4.7 — 运行行是唯一实时区域                     |
| 9   | 子调用在父级下缩进并有导轨              | 工具行位于 `.thinking-subagent__tools`，没有连接线                                                                   | 嵌套仅由位置暗示                                       | 4.6 — 子调用导轨                               |
| 10  | 四种状态，错误与警告不同                | 七种状态，`failed` 和「needs attention」都用 `--warn`                                                                | 失败与警告外观相同                                     | 4.2 — 状态点，每种状态有独立文字标签           |

另有两点仍然成立。`agentStatus` 返回 `unknown` 和 `interrupted`，DSH 会将它们渲染为 `stopped`，本项目则保留各自的文字标签。`docs/workspace-ui.md` 曾将每个 agent 的详情描述为「原生、默认收起的 `<details>` 控件」，而 `ThinkingProcess.tsx` 实际使用带 `aria-expanded` 的按钮；该句现在与代码一致，并链接到本文。

<a id="31-divergences-that-are-deliberate-not-debt"></a>

### 3.1 有意保留的差异，并非技术债

以下五种行为是有意设计，不应为对齐 DSH 而「修复」：

- **每个回答携带自己的 transcript。** 轮次运行时，行从请求范围内的 `activity` 实时渲染到聊天底部；轮次结束时，这些帧附加到结束该轮次的 agent 消息（`Message.activity`），Think 折叠区渲染在该回答上方，使每个回答都位于产生它的思考过程之下。帧随对话存储，加载时若不再符合 `AgentProgressEvent` 则丢弃；展开 / 收起状态不存储，因此仍没有折叠存储条目，也没有 `hidden="until-found"`。
- **工具展开内容是结果自身的行，而非通用 IN/OUT 卡片。** 本项目工具返回领域数据——住宿候选、地点、路线段、航班——因此 transcript 将数据发布为有上限的行（`resultRows`，最多 `BOUNDED_RESULT_ROWS = 20`），而不是在两个 150px 滚动框中展示原始载荷。若提供方返回该行对应页面（`ToolResultRow.url`——地点或 Places 估算住宿使用 Google Places 的 `websiteUri`，SerpApi 住宿使用其自身详情链接），行以该网站图标开头；图标从 Google 公开 favicon 服务获取，仅使用主机名且不带 referrer。没有页面或图像加载失败时回退为类别图标。不会合成 URL。调用参数渲染为一条可换行文字——`Sydney Airport →
The Rocks · 2026-11-10`，其他参数显示为 `key value` 标签——而非堆叠的定义列表。
- **轮次要么解释，要么隐藏。** 轮次是修订循环：第 1 轮派发任务，后续轮次仅因冲突检测要求专职 agent 修复问题而存在。若所有事件都属于第 1 轮，不显示任何轮次标签；若存在大于 1 的轮次，则以协调者自己的摘要和约束列表为标题，使数字始终回答「本轮发生了什么」。
- **思考归属作出决定的模型。** supervisor 与协调者启用 DeepSeek thinking 并发布 `reasoning_content` 增量。专职 agent 通过强制工具调用请求结构化输出，而 DeepSeek 在 thinking 模式下拒绝此操作（「Thinking mode does not support this tool_choice」），所以其工作以工具调用和自身选择（`agent_completed.choice`）呈现，而非私有推理。因此推理行归属 `itinerary` 行：它是本次运行的主干，不会在 `AGENT_NAMES` 外虚构伪 agent 来承载这些内容。一轮可能包含多个思考阶段——派发 supervisor 与各次修订——所以推理块以 `(agent, round, episode)` 标识；同一阶段的每个增量携带相同 `index`，客户端将其合并为一个不断增长的块（见 4.5a）。
- **输入框没有模型选择器、权限标签或上下文计量器。** 本应用只有一个模型、一个用户，也没有需要展示的 token 预算，所以 DSH 的这三个标签在此会成为无效控件。输入框保留 DSH 的另一个控件：左下角附件按钮，点击打开文件选择器。
- **附件以卡片内的标签呈现，与 DSH 相同。** 选择、拖到卡片上或粘贴的文件成为草稿上方的标签：图像显示缩略图，文本文件显示文件图标，每项都有名称、大小和移除控件。发送前准备在浏览器中完成（`apps/web/lib/chat/attachments.ts`）：图像以 1024px 重绘并重新编码，只要带透明度且载荷上限允许就保持 PNG；文本文件按约定的字节上限截断并附加截断标记。拒绝原因是标签下方的内联文字，不是未读就消失的 toast。

<a id="32-asking-the-traveller"></a>

### 3.2 询问旅行者

- **计划自行决定能决定的事项。** 住宿专职 agent 已比较每个合格候选，其提案指定一个选项。transcript 通过 `agent_completed.choice` 报告选中住宿、专职 agent 自己的理由及比较过的备选项，而非每轮都展示「Choose your stay」卡片等待旅行者。只有协调者可以询问旅行者：专职 agent 在编排图内部运行，不能结束轮次。
- **真正的歧义使用结构化问题。** 协调者拥有 `ask_user_question` 工具（`packages/orchestrator/src/chat.ts`，对应 DSH 同名工具）：1–4 个问题，每个包含稳定 id、可选 header/detail，以及最多 4 个选项（`label`、可选 `description`）。调用即结束轮次：提示词要求协调者不再调用工具，之后最多说一句简短文字，因为问题卡片已展示问题。推荐选项排在首位，并在标签后附加 `" (Recommended)"`；每个选项都包含一句权衡说明。对应帧为 `ChatAskUser`（`packages/shared/src/chat.ts`）：`type:
"ask_user"`、有上限的 `questions`、`known`（当前理解的 brief）、已有时原样返回的客户端 `plan`，以及任何 `reply` 文字。它与 `needs_info` 一样以错误信号传递：`runConversationAgent` 抛出 `AskUserError`，`apps/web/app/api/chat/route.ts` 捕获并作为轮次最终帧发送；`apps/web/lib/workspace/workspace.ts` 从 `readPlanStream` 重新抛出自己的 `AskUserError`。
- **没有有用选项的信息仍用一句普通文字询问。** 缺少目的地、预算或日期范围时，没有值得提供的选项菜单，因此协调者仍在回答中直接询问，保持原有方式；`needs_info` 路径（`ChatNeedsInfo`）不携带选项列表，以后也不会。
- **答案成为下一轮。** 打开 `PendingAsk`（`apps/web/lib/workspace/ask-user.ts`）时，`QuestionComposer.tsx` 替代输入框。提交时调用 `formatAskAnswers`，将答案转为每题一行（`Header: choice, choice`，跳过时为 `"no preference"`），连同 `known` 作为旅行者的下一条聊天消息发送；请求形状与已有输入的后续消息相同，因此下游不需要适配新的答案格式。关闭卡片会将其移除并恢复普通输入框；无论哪种情况，问题文字都保留在 assistant 消息中。参见 [`2026-09-23-ask-user-question`](../../.agents/notes/implemented/feature/2026-09-23-ask-user-question.md)，了解为什么它只取代删除 `ask_the_traveller` 的说明中关于提问的部分。
- **任何地方仍无决策确认，包括 Trip 抽屉。** `HitlCheckpoint`、`TripPlan.hitl`、`checkpointsFor`、`applyHitl`、`/api/hitl`、`CheckpointCards` 和客户端 `Decision` 路径保持删除。计划选项没有「应用旅行者决策」功能；ask-user 问题针对_规划输入_（节奏、饮食偏好、含糊日期），绝不是批准专职 agent 已作出的选择。希望修改计划的旅行者通过聊天说明或编辑旅行；没有任何事项等待他们无法给出的确认。

<a id="4-what-was-ported"></a>

## 4. 已移植的内容

下列每一步都已落地。每项列出现在承载实现的文件，顺序即实施顺序；每项相互独立，可单独落地。

每步后运行 `pnpm typecheck && pnpm lint && pnpm test`，视觉相关步骤还须在浏览器中验证聊天界面。

<a id="41-one-live-indicator-per-turn"></a>

### 4.1 每轮一个实时指示器

`RunningLine`（`ThinkingRows.tsx`）是唯一运行信号：仅在 `busy` 时于 Think 行下渲染一次，带有 `Deep diving`、省略号动画和 `role="status" aria-live="polite"`。transcript 中其他部分均非实时区域，因此进度帧只播报一行，而非整个区域。`busy` 时，Think 行自己的摘要描述_正在发生什么_（`Working with Stay`、`Waiting for 3 subagents`），从不重复「Deep diving」。

<a id="42-status-is-a-state-dot"></a>

### 4.2 状态使用状态点

`StatusDot` 渲染一个 8px 点，包含不透明度 10% 的光晕层和缩放至 60% 的核心，使用现有 token 着色（`--accent` 表示运行、`--ok` 表示完成、`--warn` 表示失败、`--text-mut` 表示排队）。运行状态使用阶梯追逐：`thinking-chase` 在 0/12.5/25/37.5% 处保持 1 -> 0.6 -> 0.35 -> 0.15，不使用淡化，因为淡化会被理解为加载。状态点设为 `aria-hidden`；每行保留面向辅助技术的原有文字标签，这也用于区分失败与警告。

<a id="43-every-row-starts-collapsed-there-is-no-expand-all"></a>

### 4.3 每行默认收起，没有全部展开

整棵树——Think 行、每个 subagent 行、每个推理行、每个工具行——无论运行还是结束，都默认收起，直到读者打开。没有全部展开 / 全部收起控件：`useDisclosure` 的 `generation`/`allExpanded` 机制已删除，由 `ThinkingProcess.tsx` 中记录展开行 id 的普通 `Set<string>` 取代；在集合中添加或删除一个行 id，只打开或关闭该行。Think 行自身的收起摘要是计数行 `N tool calls · M subagents · K rounds`（`thinking-model.ts` 中的 `countActivity`/`countLine`），省略为零的部分；运行时则使用 `turnSummary` 的实时文字（见下文 4.5a）。

与 DSH 不同，展开集合不要求持久化：每次请求都从 `activity` 重建 transcript，因此它保存在组件状态中，并随新轮次重置。

<a id="44-one-sweep"></a>

### 4.4 单一扫光

`thinking-sweep` 是唯一的扫光：300px 光带以 `left: -300px -> 100%` 移动，时序为 `2.6s ease-out infinite`，在最后 90% 处停留，由运行行与每个运行中的行复用。`thinking-pulse` 与第二套扫光关键帧已删除，`prefers-reduced-motion` 块覆盖界面中的每种动画。

<a id="45-elapsed-clock-on-the-running-line"></a>

### 4.5 运行行上的耗时时钟

`RunningLine` 记录运行的第一帧，前 15 秒隐藏时钟（`CLOCK_DELAY_MS`、`thinking-model.ts:60`），之后以 1 Hz 更新，采用 `tabular-nums`；`busy` 变为 false 时停止定时器。这是本项目自己的阈值，而非借用值：DSH 的运行行（`TurnProcessNodeView.tsx`，§1.2）立即显示时钟，没有延迟。无论如何，15 秒在此仍是合理默认值：短时运行不应出现时钟。

<a id="45a-reasoning-is-one-block-per-model-call-and-the-tree-nests-to-match-dsh"></a>

### 4.5a 每次模型调用一个推理块，树按 DSH 方式嵌套

推理 sink 曾将同一次模型调用每个 160 字符刷新各自编号为一个 `index`，导致长思考拆成多个 Think 行，每行显示自己的第一行，形成一列半句话片段。`packages/orchestrator/src/reasoning-sink.ts` 现在为同一 sink 的每次刷新设置相同 `REASONING_BLOCK_INDEX`（0）；sink 仍控制传输节奏，但同一调用链的增量构成同一个块。`thinking-model.ts` 中的 `mergeReasoning` 在客户端按 `(agent, round,
episode)` 拼接增量，也会合并先前逐次刷新单独编号的记录帧。

合并块的收起摘要随阶段变化，与 DSH 1.3 一致：流式期间显示块的_最后_一行并右侧锚定（`RowSummary` 的 `followEnd`、DSH 的 `[data-follow-end]`），让读者看到最新文字的推进；结束后显示_第一_行。Think 行自身的实时摘要（`turnSummary`）在轮次层面遵循同一规则：最新事件为流式推理增量时，显示该块最新一行；之后任一 agent 行动时，回退到实时工具 / subagent 行。

树本身为 `Think`（轮次）→ `Subagent · <name>` 行，每个 `(round, agent)` 一行 → 该 subagent 自己的推理和工具行，按到达顺序排列 → 工具结果行。每层使用同一 DSH 导轨规则（`margin-left: 22px; padding-left: 8px; border-left: 0.5px solid var(--border)`），使 subagent 导轨对齐 Think 的前置图标下方，工具导轨对齐其 subagent 下方。

<a id="45b-the-running-labels-shimmer"></a>

### 4.5b 运行标签的闪光

标签文字「Deep diving」本身采用 DSH 的 `TextShimmer` 效果（`ui-primitives/src/TextShimmer.tsx`/`.module.css`，§1.2），通过 `thinking.css` 中的 `[data-text-shimmer]` 应用：`currentColor` 渐变扫光、`background-size: 250% 100%`、`1.5s cubic-bezier(0.33, 0, 0.67, 1) infinite`，扩散宽度按标签自身字符数缩放（`--thinking-text-shimmer-spread`），减少动效时删除渐变而非冻结它。这是有意替换，而非逐字移植 DSH 的每轮「Deep diving」行；DSH 中该行完全没有动效（§1.2）。本项目借用的是 DSH 在_其他_所有实时行（`ChatGroupSeat`、`ToolRow`、`DisclosureRow`）上使用的闪光，让 transcript 中唯一的运行行与 DSH 工具及推理行一样表达「进行中」。颜色保持 `currentColor` 和现有三级标签色调，没有引入蓝色渐变。标签旁没有动画省略号：DSH 的运行标签旁也没有此类动画，仅使用闪光或扫光。

<a id="46-disclosure-chrome-no-trailing-chevron-leading-icon-crossfades"></a>

### 4.6 展开控件：无后置箭头，前置图标交叉淡化

`Disclosure.tsx` 直接移植 DSH 的 `DisclosureRow`，取代自定义的 `ChevronIcon` 旋转：24px 行、16px 前置框内放 14px 图标、6px 间距、13px 标题。树中任何位置都没有后置箭头。悬停或展开时，前置图标以 100ms 交叉淡化为向下箭头（`FlowChevronDownIcon`，移植自 DSH 的 `IconChevronDownOutline14`）；没有可展开内容的行只渲染普通图标，不带悬停状态或 `role="button"`。嵌套行使用 4.5a 的导轨，取代旧的 `padding-left` 加 1px 边框。

<a id="47-narrow-the-live-region"></a>

### 4.7 缩小实时区域

已在 4.1 完成：`aria-live` 仅位于运行行。

<a id="48-realtime-reasoning-tool-results-and-decisions"></a>

### 4.8 实时推理、工具结果与选择

所需约定新增于 `packages/shared/src/chat.ts`：

| 事件                                            | 携带内容                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `agent_reasoning`                               | 模型私有推理的一段受节奏控制的片段，以 `(agent, round, episode, index)` 为键 |
| `agent_started.objective`                       | supervisor 交给该专职 agent 的有界目标                                       |
| `tool_started.args`                             | 发起调用时使用的参数                                                         |
| `tool_completed.resultRows` / `resultTruncated` | 结果自身的有界行，以及仅发布开头时的标志                                     |
| `ToolResultRow.url`                             | 提供方确实为该行返回的页面，使行能够以网站图标开头                           |
| `agent_completed.outcome` / `choice`            | 本轮改变了什么，以及专职 agent 最终选择的选项                                |
| `needs_info.asked`                              | agent 提出的问题、上下文与建议                                               |

`packages/agents/src/reasoning.ts` 将 `invoke` 转换为流，才能读取 `reasoning_content`：LangChain 的 OpenAI 适配器把该字段放到每个分片的 `additional_kwargs` 中，但从合成消息中丢弃，因此没有其他读取方式。`bindTools`、`bind` 和 `withStructuredOutput` 重新包装，因为 LangChain 实际调用的是绑定后的模型；仅替换 `invoke` 的代理永远看不到 token。`packages/orchestrator/src/reasoning-sink.ts` 将增量按节奏转换为 transcript 事件，标明其所属模型调用链（episode），并在模型调用结束时刷新尾部。

`packages/orchestrator/src/progress-tools.ts` 使工具调用变得可读：每个网关方法现在报告参数，以及对自身结果的有界结构化摘要——住宿候选的区域、总价、评分与取消规则；地点的类别与评分；路线段的方式、时长与价格；航班的承运方、价格与经停。它仍绝不发布提供方载荷或凭据。

<a id="49-removed-the-todo-panel"></a>

### 4.9（已删除）待办面板

曾在输入框上方放置一个仿照 DSH `TodoPanel` 的 `TodoPanel` 停靠区，现已删除。它为一个不存在的产品构建：状态来自决策检查点（「confirm the plan」「review conflicts」）；检查点删除后，面板只能报告没有任何组件在执行的工作。transcript 已经说明正在发生什么：Think 行计数与待办面板是同一运行的两份摘要，保留的是计数行。

<a id="410-the-composer-is-a-card-not-a-form-row"></a>

### 4.10 输入框是一张卡片，而非表单行

`apps/web/components/chat/Composer.tsx` 与 `apps/web/app/styles/composer.css` 替代旧的输入框加两个按钮的行。它遵循 DSH `InputBar` 的形状：一个胶囊表面容纳文字与控件，28px 圆形控件位于左下，主要操作位于右下，草稿随内容增长，之后在卡片内滚动，卡片为整个控件承载焦点环。圆角采用 DSH 的原始 22px，而非本应用的 14px 面板圆角，因为卡片是输入胶囊，14px 会让它变成另一个平板面板。

有意省略 DSH 的三个控件：模型选择器、权限 / 访问标签、上下文窗口计量器。本应用只有一个模型、一个用户，没有需要显示的 token 预算，因此它们会成为三个无效标签。左下控件是附件按钮，打开多文件选择器。

附件标签位于同一卡片内的草稿上方，对齐草稿的 14px 列，整个胶囊是拖放目标（`data-dragging` 将边框改为虚线）。标签本身位于 `components/chat/AttachmentChip.tsx`，外观与已发送消息共享，使文件发送前后保持一致。DSH 保留两种形状（图像为无装饰的 64px 缩略图，文件为 240px 卡片），但本聊天列太窄，无标签方块不能辨认粘贴的截图，因此两者统一使用卡片形状，图像将缩略图放在图标槽位。移除控件是真正的按钮，以文件名命名；缩略图的 `alt` 为空，因为名称已在旁边以文字显示。

卡片填充使用 `--surface-2` 而非 `--surface`：DSH 输入框使用 `--dsw-specific-input-major`，在深色调色板中为 `rgb(44, 44, 46)`，比页面高一级，是灰色胶囊而非页面颜色。本应用 `--surface-2` 对应同一级，已表示「放在页面上的表面」（浅色中为白色，深色中为灰色），因此两个主题与 DSH 一样朝相反方向变化。附件圆形按钮使用 `--border` 填充，图标采用主要文字色，因为比灰色卡片低一级的选择器填充看起来像禁用状态。

输入框的两个控件自行确定尺寸：28px 圆形和 34px 发送按钮；`apps/web/app/styles/forms.css` 必须了解这一点。该文件给应用每个按钮设置 36px `min-height`，而其 `button:not(...)` 链的优先级高于普通类，因此输入框规则无法覆盖它。两个控件都已加入这些排除链。字段本身不绘制焦点环，因为 `base.css` 给每个可聚焦元素添加焦点环，卡片内部再加会在卡片自身强调边框内嵌套第二层高亮。

值得保留的三个行为：

- **Enter 发送，Shift+Enter 换行，IME 组合输入从不提交。** 最后一项是中文和日文可以正常输入的前提；防护条件是 `event.nativeEvent.isComposing`。
- **主要操作原位变为 Stop** — 同一个 34px 圆形，警告色、方形图标，避免将停止误认作发送。
- **文字区域使用 `textarea`，而非 DSH 的 contenteditable。** DSH 通过装饰器 portal 在编辑器内部渲染附件标签；这里它们是字段上方的普通 DOM，因此 textarea 以少得多的机制实现三个关键行为（增长、键盘、内部滚动），标签也可以使用真正的列表项和按钮。
- **粘贴内容带文件时，将文件作为附件。** 剪贴板图像是常见情况，没有文件名可选；无文件的粘贴继续按普通文字输入处理。

`chat.css` 曾将 `.chat__form` 的输入框和两个按钮排成横向行；该块已删除，form 现在只作为包裹卡片的提交边界。

<a id="411-no-calendar-pop-up-in-the-chat"></a>

### 4.11 聊天中不弹出日历

输入框曾带日历控件，`ChatPanel` 曾在 assistant 消息看起来像日期问题时自动打开日期选择对话框。用正则表达式猜测 assistant 意图不足以成为打开模态框的理由，而且会干扰对话：日期问题使对话框盖住旅行者应作答的界面。两者均已删除。日期问题现在在对话中回答，随时可在输入框输入日期；真正的日历选择器仍位于顶部栏 When 编辑器中，由旅行者主动请求。

<a id="412-messages-full-width-reply-a-bubble-for-the-traveller-a-clock-on-both"></a>

### 4.12 消息：全宽回答、旅行者气泡、双方时钟

`MessageItem.tsx` 参考 DSH 的 `MessageItem`/`AssistantMarkdown`，替代双方旧的边框框式渲染。assistant 回答采用全宽正文，无边框、背景或可见说话者标签（仅供屏幕阅读器的标签仍注明说话者），通过 `react-markdown` 渲染（`apps/web/lib/dev/thinking-fixtures.ts` 和 `Message.text` 原已采用 Markdown 形式，仅更换渲染器）；链接在新标签页打开，不携带 referrer，也不保留 opener。旅行者消息保持右对齐气泡。双方下方都有小时钟，使用 `apps/web/lib/workspace/message-chrome.ts` 中的 `formatMessageClock`（移植自 DSH 同名函数）：与当前同一自然日时显示 `HH:mm`，其他日期附加简短日期。`Message.at`（epoch 毫秒）可选，追加消息时写入，因此本次变更前保存的旅行仍可加载，只是不显示时钟。

最新回答逐词渐显，参考 shadcn/ui 的流式文字组件与 Magic UI 的 `TextAnimate`（`blurIn`）：每个词从 5px 模糊中淡入，比前一个晚 26ms，持续 320ms。`RevealedText.tsx` 用一个小型 rehype 插件在_渲染后的_树上拆词，因此标题、列表、链接和代码保持完整，回答全文从第一帧起就在 DOM 中；仅动画化 `opacity` 和 `filter`，所以屏幕阅读器、页内查找和复制粘贴立即可见全部内容。长回答会压缩交错延迟，使最后一个词仍在 700ms 预算内出现；`prefers-reduced-motion: reduce` 完全关闭渐显及行自身的淡入。`ChatPanel` 恰好将一条消息标为 `animate`：最后一条，且必须是面板挂载后到达的 agent 回答。重新加载后从存储恢复的 transcript 因此永不动画；`RevealedText` 挂载时锁定该标志，重渲染无法重新播放。未添加动效库；实现仅包含 `messages.css` 中的 CSS 和逐词 `animation-delay`。

<a id="413-ask-question-card"></a>

### 4.13 提问卡片

详见 3.2 与 [ask-user Agent Note](../../.agents/notes/implemented/feature/2026-09-23-ask-user-question.md)；此处仅为保持「已移植内容」清单完整。`QuestionComposer.tsx` 复制 DSH 的 `QuestionFlow`：编号选项，解析出的「(Recommended)」徽标与说明，多选复选框，内联「Other」自由文本行，无选项问题以块级 textarea 展示，以及带 Skip 和 Next/Submit 的 `‹ i / n ›` 分页器。单选点击后自动前进；Enter 继续，Shift+Enter 换行，IME 组合输入永不前进，使用与输入框相同的防护条件。

有一处有意与 DSH 不同：「Recommended」徽标位于选项行末尾（`question.css` 中的 `.question__badge { margin-left: auto }`），在标签和描述之后，而非像 DSH 一样夹在两者之间。这是评审时的明确要求，保证两者换行时标签不会被徽标与其描述隔开。

<a id="5-what-not-to-copy"></a>

## 5. 不应照搬的内容

- **三帧发布门禁与节点组装器。** 它们解决本应用没有的问题：DSH 保留持久化会话日志，并通过回放重建视图。本项目中 `activity` 是工作区控制器中的请求范围数组。
- **`hidden="until-found"` 折叠。** 它适合 DSH 可搜索的 transcript；本项目没有页内 transcript 搜索，因此简单条件渲染正确且更简单。
- **Subagent 会话、父子关系面包屑和目录树。** DSH 的 subagent 是有独立日志的一等会话。本项目的 5 个专职 agent 固定，因此折叠 5 个已知名称才是如实的结构。
- **Token 名称和深 / 浅色别名对。** 本项目在 `tokens.css` 中已有语义 token；借鉴_层级_（三级 / 次级标签、成功 / 警告 / 错误状态、运行强调色），而非名称。
- **`StateDot` 的八格矩阵。** 阶梯追逐值得保留；10px 的八格像素几何属于 DSH 品牌细节。使用相同关键帧的 8px 光晕加核心状态点，更接近本应用现有图标笔画粗细。
- **DSH 的模型、权限和上下文标签。** 在 DSH 中它们是真实控件，在此只是三个无效标签。输入框保留附件按钮和附件标签，省略这三项（见 3.1）。
- **DSH 过程折叠区的持久性与 `hidden="until-found"`。** DSH 保留以 `(turn, answerStep)` 为键的存储条目，将结束的轮次收起在一个重新加载后仍保留的摘要后。本项目随消息保留每个回答的帧（见 3.1），但不保留展开状态，因此各行只是在组件状态中默认收起；不存在结束时自动折叠的过渡。

<a id="6-verification"></a>

## 6. 验证

- 每步运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`。
- `apps/web/tests/components/chat/ThinkingSurface.test.tsx` 直接覆盖树：已结束轮次收起到计数行后，所有行收起；运行期间 transcript 也默认收起，且只有一个实时区域；打开 Think 仅显示其 subagent 行，各行独立切换；打开工具、推理块或选择时一次仅打开一行；流式推理增量合并为一行并跟随最新文字；结果行图标来自其 `kind`，或回退到工具图标；树中没有后置箭头，也没有全部展开控件；行可通过键盘切换。
- `apps/web/tests/components/chat/ChatPanel.test.tsx` 端到端覆盖聊天界面：消息按对话顺序排列且标签稳定；subagent 逐个打开和关闭；计数行折叠；仅为大于 1 的轮次显示标题；运行时的实时思考 transcript 和 Stop 操作；实时工具行根据结果结束；工具调用参数、结果行与截断说明；流式推理块收起时显示最后一行，展开后显示全文；住宿选择及备选项；不渲染确认卡片或建议列表（结构化提问仍渲染为 `QuestionComposer`，另有覆盖，见下文）。
- `apps/web/tests/components/chat/MessageItem.test.tsx` 覆盖用户气泡、全宽无边框 agent 回答、双方消息时钟（当天 `HH:mm`、其他日期的短日期、无时间戳时无时钟）、轻量 Markdown（列表、粗体、无原始 HTML）及不带 referrer 的新标签页链接。也覆盖渐显：设置 `animate` 时按顺序包裹词并交错显示；长回答在预算内压缩交错延迟；代码不拆分；段落仍可作为连续文字阅读；无 `animate` 时没有渐显标记；属性改变或组件重渲染时不重播。
- `apps/web/tests/components/chat/QuestionComposer.test.tsx` 覆盖卡片本身：标题、带 Recommended 徽标的编号选项与分页器；单选自动前进和多选切换；将标签、Other 文本与无选项文本一起提交；以 Other 替换单选项；跳过后设为「no preference」；返回未回答问题并提示，而不是提交；Enter/Shift+Enter/IME；收起与关闭；解析「 (Recommended)」后缀。`apps/web/tests/components/workspace/AskUser.test.tsx` 覆盖工作区接线：卡片替代输入框并随 `known` 发送答案；关闭按钮移除卡片、恢复输入框；旅行者开始新聊天时丢弃待回答问题。
- `packages/orchestrator/tests/reasoning-sink.test.ts` 固定验证同一 sink 的每次刷新携带相同块索引，同轮两个 episode 保持分离；`chat.test.ts` 固定验证 `ask_user_question`，包括记录的问题与选项、删除空值并为两类列表设置上限，以及提问以 `AskUserError` 结束轮次且原样携带客户端计划；`progress-tools.test.ts` 固定验证有界结果行、其 `kind`（地点关键词匹配、旅行方式、固定的住宿 / 航班 / 天气类型），以及提供方错误不会进入 transcript。`packages/shared/tests/chat.test.ts` 固定验证 `ChatAskUser` 和 `ToolResultRow.kind` schema，包括问题和选项上限。
- 本次变更前已使用实时提供方检查端到端形态：三天悉尼请求流式输出 19 个推理事件、15 个工具结果及各自的行（包括带 20 行的 `Search
stays: 20 stay options`），还有一个住宿选择及 19 个备选项；含糊的「Sydney in March」请求让协调者给出一句普通提问。重新对实时提供方验证合并推理 transcript 与 `ask_user_question` 卡片需要 `DEEPSEEK_API_KEY`，作为后续事项记录，此处不声称已完成。
- 浏览器检查：用 `/debug/thinking` 测量每个 transcript 行；`/debug/question`（仅开发环境，`apps/web/app/debug/question/page.tsx`）在固定 `PendingAsk` 下展示问题卡片，不调用提供方。这两个页面都能发现一个陷阱：`apps/web/app/styles/forms.css` 将不在排除列表中的每个按钮样式化为次要按钮，因此 transcript、输入框或问题卡片中的新控件会附带边框、表面与内边距，改变网格列位置。`.thinking-line`、`.thinking-control`、`.thinking-choice__toggle`、`.composer__add`、`.composer__primary`、`.question__icon-button`、`.question__option` 和 `.question__button` 均已列入排除列表。
- `/debug/thinking`（`apps/web/app/debug/thinking/page.tsx` 配合 `apps/web/lib/dev/thinking-fixtures.ts`）无需调用提供方，基于记录帧序列以三种模式渲染 transcript：Settled、Mid-flight、Replay；Replay 每次流式传递 mid-flight fixture 的一帧。这是检查行布局最快的方式。

<a id="7-sources"></a>

## 7. 来源

DSH，位于 `deepseek-harness` 仓库：

| 主题                                         | 路径                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 轮次流水线与发布节奏                         | `docs/subsystems/conversation.md`                                                                                                                |
| 运行行                                       | `packages/client/ui-chat/src/client/chat/ChatView.tsx:168-201`, `ChatView.module.css:80-137`                                                     |
| Think 行                                     | `packages/client/ui-chat/src/client/chat/ReasoningRow.tsx`, `ReasoningRow.module.css`                                                            |
| 过程折叠区                                   | `TurnProcessNodeView.tsx`, `conversation-nodes/turn-process.ts`, `stores.ts`, `searchable-hidden.ts`                                             |
| 工具行                                       | `packages/client/ui-tool/src/client/tool/components/ToolRow.tsx`, `ToolRow.module.css`, `models/tool-call-model.ts`, `ToolCallTree.tsx`          |
| 状态点                                       | `packages/client/ui-primitives/src/StateDot.tsx`, `StateDot.module.css`                                                                          |
| 展开控件                                     | `packages/client/ui-primitives/src/DisclosureRow.tsx`, `DisclosureRow.module.css`                                                                |
| 图标                                         | `packages/client/ui-primitives/src/icons/index.tsx`                                                                                              |
| Subagent                                     | `packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx`, `subagent-lineage.ts`, `SubagentReadOnlyComposer.tsx`                        |
| 输入框上方的待办停靠区（参考后删除，见 4.9） | `packages/client/ui-conversation/src/client/skeleton/TodoPanel.tsx`, `TodoPanel.module.css`                                                      |
| 询问旅行者                                   | `packages/client/ui-user-questions/src/client/QuestionComposer.tsx`, `contract/slots.ts`, `packages/interaction/user-questions/src/types.ts`     |
| 输入卡片                                     | `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`, `InputBar.module.css`                                                        |
| 流式节流                                     | `packages/client/ui-conversation/src/client/conversation/assembly.ts:130-158`, `packages/api/session-controller/src/client/sessions/notifier.ts` |

本项目：

| 主题                 | 路径                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 思考过程界面         | `apps/web/components/chat/ThinkingProcess.tsx`, `ThinkingRows.tsx`, `thinking-model.ts`                                                                                 |
| 展开控件             | `apps/web/components/chat/Disclosure.tsx`                                                                                                                               |
| 图标                 | `apps/web/components/ui/flow-icons.tsx`（移植的 DSH 图标与类别图标）、`icons.tsx`（无关的应用控件）                                                                     |
| 聊天渲染             | `apps/web/components/chat/ChatPanel.tsx`                                                                                                                                |
| 消息                 | `apps/web/components/chat/MessageItem.tsx`, `apps/web/components/chat/RevealedText.tsx`, `apps/web/lib/workspace/message-chrome.ts`, `apps/web/app/styles/messages.css` |
| 输入框               | `apps/web/components/chat/Composer.tsx`, `apps/web/app/styles/composer.css`                                                                                             |
| 提问卡片             | `apps/web/components/chat/QuestionComposer.tsx`, `apps/web/lib/workspace/ask-user.ts`, `apps/web/app/styles/question.css`                                               |
| 住宿选择             | `apps/web/components/chat/ThinkingRows.tsx` 中的 `ChoiceBlock`                                                                                                          |
| 思考过程样式         | `apps/web/app/styles/thinking.css`                                                                                                                                      |
| 设计 token           | `apps/web/app/styles/tokens.css`                                                                                                                                        |
| 进度与 ask-user 约定 | `packages/shared/src/chat.ts`                                                                                                                                           |
| 推理流               | `packages/agents/src/reasoning.ts`, `packages/orchestrator/src/reasoning-sink.ts`                                                                                       |
| 思考模型路由         | `packages/agents/src/models.ts`（`RoutedModelOptions`）                                                                                                                 |
| 工具结果详情与类型   | `packages/orchestrator/src/progress-tools.ts`                                                                                                                           |
| Ask-user 工具        | `packages/orchestrator/src/chat.ts`（`askUserQuestion`, `toQuestions`, `AskUserError`）                                                                                 |
| 轮次与选择事件       | `packages/orchestrator/src/supervisor.ts`, `workflow.ts`, `chat.ts`                                                                                                     |
| 开发 fixture 页面    | `apps/web/app/debug/thinking/page.tsx`, `apps/web/lib/dev/thinking-fixtures.ts`, `apps/web/app/debug/question/page.tsx`                                                 |
