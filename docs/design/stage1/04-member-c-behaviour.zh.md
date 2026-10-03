<a id="4-behaviour-models-member-c-headmastereggy-accommodation-and-budget"></a>

# 4. 行为模型：成员 C（`@HeadmasterEggy`，住宿与预算）

[English](04-member-c-behaviour.md) | 中文

三张图都来自 ad hoc 需求 **AH-C1** 以及用例规格 **UC-C1 Arrange Accommodation** 和 **UC-C2 Manage Budget**（`01-requirements.md`、`02-use-cases.md`）。按项目说明的要求，每张图都突出 LLM 所处的位置，以及由哪些确定性代码对它把关。

<a id="41-activity-diagram-arrange-accommodation-uc-c1"></a>

## 4.1 活动图：Arrange Accommodation（UC-C1）

四条泳道对应四个参与者。LLM 只在 *Choose one candidate id per segment* 这一步使用一次，它的输出在任何定价之前都会先经过校验。
渲染图：[`c-activity.html`](../../architecture-diagrams/stage1-member-c/rendered/c-activity.html)（Archify，[源文件](../../architecture-diagrams/stage1-member-c/specs/c-activity.workflow.json)、[检查记录](../../architecture-diagrams/stage1-member-c/evidence/c-activity.visual-check.html)）。

```mermaid
flowchart TB
  start((●)) --> recv

  subgraph ORCH["Orchestrator"]
    recv["Receive dispatch with brief, board and stay allocation"]
    post["Post proposal on the planning board"]
  end

  subgraph AGENT["Accommodation agent"]
    booked{"bookedStay set?"}
    keep["Return booked stay, unpriced, floorCost = 0"]
    prefs["Read preferences: room allocation, min rating, free cancellation"]
    rooms["Compute rooms: individual = guests, shared = ⌈guests / 2⌉"]
    split["Split nights into city segments from transport hops"]
    filter["Filter ineligible candidates, sort cheapest first"]
    empty{"Any eligible candidate?"}
    fail["Raise error: no stay that meets the rules"]
    hasModel{"Model configured?"}
    valid{"Choice is a known id and on schema?"}
    rule["Deterministic pick: rating ≥ 8 and free cancellation, else cheapest"]
    fit{"Choice within allocation?"}
    refit["Take best stay within allocation, or cheapest"]
    price["Price rooms × nights × rate in cents; floorCost = cheapest eligible"]
  end

  subgraph BOOK["Booking port"]
    search["Search stays for each segment"]
    live{"Live search succeeded?"}
    est["Use Google Places estimates, label 'estimated'"]
  end

  subgraph LLM["LLM (DeepSeek)"]
    choose["Choose one candidate id per segment, weighing rating, cancellation and cost"]
  end

  recv --> booked
  booked -- yes --> keep --> post
  booked -- no --> prefs --> rooms --> split --> search --> live
  live -- yes --> filter
  live -- no --> est --> filter
  filter --> empty
  empty -- no --> fail --> stopFail((⊗))
  empty -- yes --> hasModel
  hasModel -- yes --> choose --> valid
  hasModel -- no --> rule
  valid -- yes --> fit
  valid -- no --> rule
  rule --> fit
  fit -- yes --> price
  fit -- no --> refit --> price
  price --> post --> stop((◉))
```

<a id="42-sequence-diagram-budget-overrun-and-targeted-revision-uc-c2-extension-2a"></a>

## 4.2 时序图：预算超支与定向修订（UC-C2，扩展 2a）

一轮规划：第 1 轮超出预算，住宿 agent 被要求削减费用。渲染图：[`c-sequence.html`](../../architecture-diagrams/stage1-member-c/rendered/c-sequence.html)（Archify，[源文件](../../architecture-diagrams/stage1-member-c/specs/c-sequence.sequence.json)、[检查记录](../../architecture-diagrams/stage1-member-c/evidence/c-sequence.visual-check.html)）。

```mermaid
sequenceDiagram
  autonumber
  actor T as Traveler
  participant UI as Web workspace
  participant CH as runTripChat
  participant WF as LangGraph workflow
  participant BD as PlanningBoard
  participant TR as Transport agent
  participant AC as Accommodation agent
  participant BK as BookingPort
  participant LLM as LLM (DeepSeek)
  participant CP as ConflictPolicy (C)

  T->>UI: "Tokyo 10–14 Nov, 2 people, AUD 2,300"
  UI->>CH: POST /api/chat
  CH->>LLM: extract TripBrief
  LLM-->>CH: structured brief
  CH->>WF: run(brief)
  WF->>TR: invoke(brief)
  TR-->>BD: transport proposal
  WF->>BD: allocationFor(accommodation)
  BD-->>WF: 40% of the budget left after transport
  WF->>AC: invoke(brief, board, allocation)
  AC->>BK: searchStays(Tokyo, 10–14 Nov, 2 guests)
  BK-->>AC: candidates
  AC->>LLM: choose candidate ids (allocation as maxTotalCost)
  LLM-->>AC: selection
  AC->>AC: validate ids, price in cents, compute floorCost
  AC-->>BD: accommodation proposal
  Note over WF,BD: itinerary, dining and the destination guide post their proposals too
  WF->>CP: detectConflicts(proposals, brief)
  CP->>CP: rollUpCost → estTotal, overrunPct
  CP->>CP: minimumCost(proposals) ≤ budget, so the plan is feasible
  CP-->>WF: RevisionRequest[] with targetSaving per section

  loop round < 3 and score improves
    WF-->>UI: progress: "revising accommodation"
    WF->>AC: invoke(brief, revision, previous, allocation − saving)
    AC->>BK: searchStays(…)
    BK-->>AC: candidates
    AC->>AC: budget revision: cheapest eligible, preferences kept
    AC-->>BD: revised proposal
    WF->>CP: detectConflicts(revised proposals, brief)
    CP-->>WF: remaining conflicts and planScore
    alt score not improved
      WF->>WF: keep previous proposals, stop
    end
  end

  WF->>WF: build_plan: sections draft or needs_you
  WF-->>CH: TripPlan
  CH->>LLM: write reply from plan digest
  LLM-->>CH: reply text
  CH-->>UI: final frame { reply, plan }
  UI-->>T: plan with total vs budget
```

如果 `minimumCost` 高于预算（扩展 2b），`detectConflicts` 改为返回一个
`infeasible budget` 冲突，跳过修订循环，回复中写明所需的最低预算。

<a id="43-state-machine-accommodation-section-within-a-planning-turn-uc-c1-and-uc-c2"></a>

## 4.3 状态机：一轮规划中的住宿区段（UC-C1 和 UC-C2）

区段对外显示的状态（`planning`、`draft`、`needs_you`）由这些内部状态推导得出。渲染图：[`c-state.html`](../../architecture-diagrams/stage1-member-c/rendered/c-state.html)（Archify，[源文件](../../architecture-diagrams/stage1-member-c/specs/c-state.workflow.json)、[检查记录](../../architecture-diagrams/stage1-member-c/evidence/c-state.visual-check.html)）。

```mermaid
stateDiagram-v2
  [*] --> WaitingForTransport : dispatch
  WaitingForTransport --> Kept : [bookedStay]
  WaitingForTransport --> Searching : transport posted / allocation computed

  state Planning {
    Searching --> Choosing : candidates found
    Searching --> Failed : [no eligible candidate]
    Choosing --> Choosing : [model output invalid] / deterministic pick
    Choosing --> Priced : choice validated
  }

  Priced --> UnderReview : post proposal / detectConflicts
  Kept --> UnderReview : post proposal

  UnderReview --> Draft : [within budget]
  UnderReview --> Revising : [over budget and feasible and round < 3] / targetSaving
  UnderReview --> NeedsYou : [infeasible budget] / report minimum
  UnderReview --> NeedsYou : [round = 3 and still targeted]

  Revising --> Searching : revision request (preferences kept)
  Revising --> NeedsYou : [score not improved] / keep previous proposal

  Draft --> [*]
  NeedsYou --> [*]
  Failed --> [*]

  note right of Planning
    UI shows "planning"
  end note
  note right of NeedsYou
    UI shows "needs_you" while a
    RevisionRequest still targets it
  end note
```

| 状态 | 界面状态 | 进入 / 退出行为 |
| --- | --- | --- |
| WaitingForTransport | planning | 只有在同一轮中已经启动了交通时才等待。 |
| Searching, Choosing, Priced | planning | LLM 只在 Choosing 中起作用；无效输出会经由确定性选择回到该状态。 |
| Kept | planning | 已预订住处，不搜索；floorCost 为 0，因此永远不会被要求削减。 |
| UnderReview | planning | 成员 C 的 `detectConflicts` 决定下一个状态。 |
| Revising | planning | 偏好不变，分配额更新；只有 `planScore` 改善时才保留这一轮。 |
| Draft | draft | 没有修订请求指向该区段。 |
| NeedsYou | needs_you | 由旅行者决定：提高预算、更改日期或编辑计划。 |
| Failed | — | 运行停止，并指明失败的是住宿 specialist。 |
