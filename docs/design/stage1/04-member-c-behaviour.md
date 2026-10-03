# 4. Behaviour models: member C (`@HeadmasterEggy`, accommodation and budget)

English | [中文](04-member-c-behaviour.zh.md)

All three diagrams come from ad hoc requirement **AH-C1** and the use case specifications **UC-C1
Arrange Accommodation** and **UC-C2 Manage Budget** (`01-requirements.md`, `02-use-cases.md`). Each
focuses on where the LLM sits and what deterministic code guards it, as the brief asks.

## 4.1 Activity diagram: Arrange Accommodation (UC-C1)

Swimlanes are the four participants. The LLM is used once, in *Choose one candidate id per segment*, and
its output is checked before anything is priced.
Rendered: [`../diagrams/c-activity.svg`](../diagrams/c-activity.svg).

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

## 4.2 Sequence diagram: budget overrun and targeted revision (UC-C2, extension 2a)

One planning turn in which the first round goes over budget and the accommodation agent is asked to
cut its cost. Rendered: [`../diagrams/c-sequence.svg`](../diagrams/c-sequence.svg).

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

If `minimumCost` is above the budget (extension 2b), `detectConflicts` instead returns one
`infeasible budget` conflict, the loop is skipped, and the reply names the minimum budget needed.

## 4.3 State machine: accommodation section within a planning turn (UC-C1 and UC-C2)

The section's visible status (`planning`, `draft`, `needs_you`) is derived from these internal
states. Rendered: [`../diagrams/c-state.svg`](../diagrams/c-state.svg).

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

| State | UI status | Entry / exit behaviour |
| --- | --- | --- |
| WaitingForTransport | planning | Waits only if transport was started in the same turn. |
| Searching, Choosing, Priced | planning | The LLM acts only in Choosing; invalid output loops back through the deterministic pick. |
| Kept | planning | Booked stay, no search; floorCost 0 so it is never asked to cut. |
| UnderReview | planning | Member C's `detectConflicts` decides the next state. |
| Revising | planning | Same preferences, new allocation; the round is kept only if `planScore` improves. |
| Draft | draft | No revision request targets the section. |
| NeedsYou | needs_you | The traveller decides: raise the budget, change dates or edit the plan. |
| Failed | — | The run stops and names accommodation as the failing specialist. |
