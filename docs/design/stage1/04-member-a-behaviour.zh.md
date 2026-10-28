<a id="4-behaviour-models-member-a-lilstanie-coordination-and-orchestration"></a>

# 4. 行为模型：成员 A（`@Lilstanie`，协调与编排）

[English](04-member-a-behaviour.md) | 中文

三张图都基于 ad hoc 需求 **AH-A1** 和用例 **UC-A1 Generate Itinerary**（`01-requirements.md`、`02-use-cases.md`）。每张图都标出 LLM 在哪一步动作，以及由哪些代码校验它的输出。

一次规划回合会发起三次 LLM 调用。每一次都有对应的确定性路径，在模型不可用或返回无效输出时接管：

| LLM 调用 | 它决定什么 | 确定性把关 |
| --- | --- | --- |
| 行程摘要抽取（`update_trip_brief`） | 这条消息陈述了哪些出行事实 | `BriefPatchSchema` → `applyBriefPatch` → `TripBrief` Zod 校验。旅行者没有陈述的事实会被报为缺失，不作推断 |
| Supervisor 委派 | 调用哪些专家、给出什么目标 | 固定的专家注册表。行程专家始终会被委派，supervisor 失败时回退为派发全部五个 |
| 撰写回复 | 旅行者读到的文字 | 没有配置模型时，由 `fallbackReplyFor(plan)` 从计划本身写出 |

计划不由模型生成。`build_plan` 由已校验的提案组装而成。

<a id="41-activity-diagram-generate-itinerary-uc-a1"></a>

## 4.1 活动图：Generate Itinerary（UC-A1）

五条泳道对应五个参与者。第 2 轮和第 3 轮会重新进入 *Detect conflicts*。
渲染图：[`stage1-member-a-activity.svg`](../diagrams/stage1-member-a-activity.svg)。

```mermaid
flowchart TB
  start((●)) --> msg

  subgraph T["Traveller"]
    msg["Send message"]
    read["Read reply and plan"]
  end

  subgraph CO["Coordinator (deterministic)"]
    validate["Validate patch against TripBrief"]
    ok{"Brief complete?"}
    missing["Return needs_info, naming what is missing"]
    reply["Return reply and plan"]
  end

  subgraph L["LLM"]
    extract["Extract stated facts"]
    write["Write the reply"]
  end

  subgraph WF["LangGraph workflow (deterministic)"]
    dispatch["Dispatch specialists"]
    detect["Detect conflicts"]
    again{"Conflicts and round < 3?"}
    revise["Revise targeted sections only"]
    better{"planScore improved?"}
    build["Build plan"]
  end

  msg --> extract --> validate --> ok
  ok -- no --> missing --> read
  ok -- yes --> dispatch --> detect --> again
  again -- yes --> revise --> better
  better -- yes --> detect
  better -- no --> build
  again -- no --> build
  build --> write --> reply --> read --> stop((◉))
```

没有模型 key 时，只有那三个 LLM 方框会消失。抽取改用已经陈述过的事实，委派改为派发全部五个专家，回复由 `fallbackReplyFor` 写出。

<a id="42-sequence-diagram-one-turn-with-a-clarifying-question-then-a-revised-plan-uc-a1-extensions-3a-and-7a"></a>

## 4.2 时序图：一次含澄清提问、随后修订的回合（UC-A1，扩展 3a 与 7a）

第一条消息没有给出预算，所以协调器先问清楚再开始规划。第一轮返回一条地理冲突，一次定向修订把它解决，规划评分随之改善。
渲染图：[`stage1-member-a-sequence.svg`](../diagrams/stage1-member-a-sequence.svg)。

```mermaid
sequenceDiagram
  autonumber
  actor T as Traveller
  participant CH as Coordinator (A)
  participant LLM as LLM
  participant WF as Workflow (A)
  participant SP as Specialists
  participant CP as ConflictPolicy (C)

  T->>CH: "Tokyo and Kyoto, 10-17 Nov, 2 of us"
  CH->>LLM: extract stated facts
  LLM-->>CH: destination, dates, group size
  CH-->>T: needs_info: the budget is missing

  T->>CH: "about AUD 9,000"
  CH->>LLM: extract, with what is already known
  LLM-->>CH: budget
  CH->>WF: run(brief)

  WF->>SP: dispatch with one objective each
  SP-->>WF: five proposals
  WF->>CP: detectConflicts
  CP-->>WF: geography conflict, targets itinerary

  WF->>SP: revise itinerary only
  SP-->>WF: revised proposal
  WF->>CP: detectConflicts
  CP-->>WF: none left
  WF->>WF: planScore improved, keep the round

  WF-->>CH: TripPlan
  CH->>LLM: write the reply
  LLM-->>CH: reply text
  CH-->>T: reply and plan
```

如果分数没有改善，`revise_conflicts` 会置 `stalled`，并保留此前的提案。如果冲突是 `infeasible budget`，`routeAfterDetection` 会跳过整个循环。

<a id="43-state-machine-one-planning-turn-uc-a1"></a>

## 4.3 状态机：一次规划回合（UC-A1）

这是编排器眼中的一个回合。成员 C 的状态机描述 `Detecting` 内部的单个**区块**，这张图描述的是整个回合。
渲染图：[`stage1-member-a-state.svg`](../diagrams/stage1-member-a-state.svg)。

```mermaid
stateDiagram-v2
  [*] --> Intake : chat message

  state Coordinating {
    Extracting --> NeedsInfo : [required fact missing]
    Extracting --> Asking : [ask_user_question called]
    Extracting --> Ready : [brief validates]
  }

  Intake --> Extracting : merge message onto known
  NeedsInfo --> [*] : needs_info frame
  Asking --> [*] : ask_user frame

  Ready --> Dispatching : run(brief)

  state Planning {
    Dispatching --> Detecting : all proposals posted
    Detecting --> Revising : [conflicts and round < 3 and not infeasible]
    Revising --> Detecting : [planScore improved]
    Revising --> Stalled : [planScore not improved] / keep previous
  }

  Detecting --> Built : [no conflicts]
  Detecting --> Built : [infeasible budget] / skip the loop
  Detecting --> Built : [round = 3]
  Stalled --> Built
  Dispatching --> Failed : [a specialist threw]

  Built --> Replying : build_plan
  Replying --> [*] : reply plus plan
  Failed --> [*] : error frame naming the specialist

  note right of Coordinating
    The LLM acts here (extraction,
    questions); the Zod contract
    decides whether it may proceed
  end note
  note right of Planning
    At most 3 rounds. A round is
    kept only if the score improves
  end note
```

| 状态 | 旅行者看到什么 | 进入 / 退出行为 |
| --- | --- | --- |
| Intake、Extracting | "thinking" | 消息会并到 `known` 上，因此追问时无需重复此前已给的事实。 |
| NeedsInfo | 聊天里的提问 | 此时还没有计划。`IncompleteBriefError` 指明缺了哪些字段，必填事实不取默认值。 |
| Asking | 2–4 个可点选项 | 每回合最多问一次，问完之后不再运行其他工具。 |
| Dispatching | 每个子代理一行进度 | 由 supervisor 决定哪些专家运行。行程专家始终运行。 |
| Detecting | "checking budget and schedules" | 由成员 C 的 `detectConflicts` 给出修订请求。 |
| Revising | "revising affected sections" | 只重跑被定向的那些代理，各自带上上一轮的提案。 |
| Stalled | — | 丢弃该轮，保留此前的提案。 |
| Built | 区块为 `draft` 或 `needs_you` | 计划由已校验的提案组装而成。 |
| Failed | 指名失败专家的错误 | 不返回残缺的计划。 |

<a id="44-how-this-behaviour-is-measured"></a>

## 4.4 这些行为如何被测量

`packages/orchestrator/src/agent-lab/` 会在编排器上重放固定场景并注入故障：某个专家超时、某个 provider 失败、模型返回不合 schema 的输出。每次运行都会记录轮次数、触发的冲突、token 用量和评估分（R-A12）。上面这些状态迁移就是这样在故障条件下被检验的。
