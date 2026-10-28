# 3. Structure models

English | [中文](03-structure.zh.md)

## 3.1 Elementary structure: generalisation added to the class model

The five class diagrams in [`../class-diagram.md`](../class-diagram.md)
already show composition, aggregation, multiplicity, interfaces and realisation
(`Specialist <|.. ItineraryAgent`, `MapsPort <|.. MapsAdapter`, …). The criteria also name
**generalisation**, which the existing diagrams do not draw. The code does have real inheritance:
the typed errors that turn a failed or unfinished turn into a specific response frame. This is
**Diagram 6** of the class model.
Rendered: [`../diagrams/class-6-generalisation.svg`](../diagrams/class-6-generalisation.svg).

```mermaid
classDiagram
  direction TB
  class Error {
    <<built-in>>
    +name: string
    +message: string
  }
  class IncompleteBriefError {
    +missing: string[]
    +known: PartialTripBrief
    +needsInfo: ChatNeedsInfo
  }
  class AskUserError {
    +askUser: ChatAskUser
  }
  class SerpApiError {
    +reason: SerpApiErrorReason
  }
  class ChatNeedsInfo {
    +type = "needs_info"
    +question: string
    +known: PartialTripBrief
  }
  class ChatAskUser {
    +type = "ask_user"
    +questions: Question[1..4]
  }
  class runTripChat {
    <<module>>
    +runTripChat(request) ChatResponse
  }
  class BookingAdapter {
    <<module>>
    +searchStays(q) StayOption[]
    +searchFlights(q) FlightOption[]
  }
  Error <|-- IncompleteBriefError
  Error <|-- AskUserError
  Error <|-- SerpApiError
  IncompleteBriefError ..> ChatNeedsInfo : creates
  AskUserError "1" *-- "1" ChatAskUser : askUser
  runTripChat ..> IncompleteBriefError : throws
  runTripChat ..> AskUserError : throws
  BookingAdapter ..> SerpApiError : catches, falls back
```

| Relationship | Kind | Rationale |
| --- | --- | --- |
| `Error <\|-- IncompleteBriefError` | generalisation | "Not enough to plan yet" is a non-plan outcome, not a crash; the API route catches it by type and streams a `needs_info` frame with the fields understood so far. |
| `Error <\|-- AskUserError` | generalisation | A clarifying question with 1–4 concrete choices, streamed as `ask_user`. |
| `Error <\|-- SerpApiError` | generalisation | A provider failure with a typed `reason` (quota, no results, …) so the booking adapter can fall back to Google Places estimates and label the provenance. |

*Design note.* Subclassing `Error` lets `runTripChat` end a turn early from deep inside the
LangGraph or LangChain call stack, and lets the route handler distinguish outcomes with
`instanceof` instead of string matching.

## 3.2 Object diagram

A snapshot of the planning board at the end of round 1 of `detect_conflicts`, for the Agent Lab's
`tokyo-couple-tight-budget` brief. The brief and the four stay candidates are the real fixture values
(`agent-lab/scenarios.ts`, `tools/src/booking.ts`). **Transport and dining costs are illustrative**:
re-run the lab and replace them if you want exact figures.
Rendered: [`../diagrams/object-diagram.svg`](../diagrams/object-diagram.svg).

```mermaid
classDiagram
  direction LR
  class brief["tightBrief : TripBrief"] {
    tripId = "agent-lab-tokyo-couple-tight-budget"
    destination = "Tokyo"
    origin = "Sydney"
    dates = ["2026-11-10", "2026-11-14"]
    groupSize = 2
    budgetTotal = 2300
  }
  class prefs["prefs : AccommodationPreferences"] {
    roomAllocation = "shared"
    minRating = 0
    freeCancellation = false
  }
  class transport["transportP : AgentProposal"] {
    agent = "transport"
    cost = 1180.00
    floorCost = 980.00
  }
  class acc["accP : AgentProposal"] {
    agent = "accommodation"
    cost = 1520.00
    floorCost = 880.00
  }
  class dining["diningP : AgentProposal"] {
    agent = "dining"
    cost = 240.00
    floorCost = 0
  }
  class stay["tokyoStay : StaySelection"] {
    city = "Tokyo"
    checkIn = "2026-11-10"
    checkOut = "2026-11-14"
    nights = 4
    rooms = 1
    selectedId = "standard"
  }
  class c1["saver : StayCandidate"] {
    pricePerNight = 220
    rating = 7.2
    freeCancellation = false
  }
  class c2["economy : StayCandidate"] {
    pricePerNight = 240
    rating = 7.6
    freeCancellation = true
  }
  class c3["standard : StayCandidate"] {
    pricePerNight = 380
    rating = 8.7
    freeCancellation = true
  }
  class c4["comfort : StayCandidate"] {
    pricePerNight = 520
    rating = 9.3
    freeCancellation = true
  }
  class req["accRevision : RevisionRequest"] {
    targetAgent = "accommodation"
    reason = "plan is 27.83% (AUD 640.00) over budget"
    targetSaving = 379.26
  }
  brief --> prefs : accommodation
  acc --> stay : stays
  stay --> c1 : candidates
  stay --> c2
  stay --> c3
  stay --> c4
  req ..> acc : targets
  req ..> brief : tripId
```

How to read it: the couple shares one room (⌈2 / 2⌉ = 1). The first choice is *standard*, the
cheapest candidate rated ≥ 8 with free cancellation, at 1 × 4 × 380 = AUD 1,520. The floor is
*saver*, at 4 × 220 = AUD 880. The total of AUD 2,940 is AUD 640 (27.83%) over the AUD 2,300 budget.
The overrun is spread over each section's room to cut (transport 200, accommodation 640, dining 240,
1,080 in total), so accommodation is asked to save 640 × 640 / 1,080 = AUD 379.26. In round 2 its
allocation is AUD 1,140.74. A budget revision takes the cheapest eligible candidate, which is
*saver* (AUD 880): free cancellation was not a confirmed preference, so *saver* is still eligible.
Had the traveller required free cancellation, *saver* would be filtered out and *economy*
(AUD 960) chosen instead.

## 3.3 Collaboration: «collaboration» Negotiate Trip Plan

Roles, not classes: any `Specialist` can play a role, and the connectors are the links the roles use
during one planning turn. Rendered: [`../diagrams/collaboration.svg`](../diagrams/collaboration.svg).

```mermaid
flowchart LR
  subgraph NTP["«collaboration» Negotiate Trip Plan"]
    direction LR
    coord(["coordinator : Orchestrator"])
    board(["board : PlanningBoard"])
    first(["firstStage : Specialist"])
    dependent(["dependent : Specialist"])
    reviser(["reviser : Specialist"])
    judge(["judge : ConflictPolicy"])
    gw(["evidence : ToolGateway"])
  end
  coord -- "1: dispatch(brief)" --> first
  first -- "2: post proposal" --> board
  board -- "3: allocation + board" --> dependent
  dependent -- "4: post proposal" --> board
  first -. "search" .-> gw
  dependent -. "search" .-> gw
  coord -- "5: detect(proposals, brief)" --> judge
  judge -- "6: RevisionRequest[]" --> coord
  coord -- "7: revise(request, previous)" --> reviser
  reviser -- "8: revised proposal" --> board
  style NTP stroke-dasharray: 6 4
```

| Role | Played by (in `main`) | Responsibility in the collaboration |
| --- | --- | --- |
| coordinator | LangGraph workflow plus supervisor agent | Decides when to dispatch, detect, revise and stop. |
| board | `board.ts` | Orders the stages (transport → accommodation → itinerary and dining) and computes each allocation. |
| firstStage | Transport (also Destination guide, which has no budget share) | Plans without waiting for anyone. |
| dependent | Accommodation, Itinerary, Dining | Waits for earlier stages and plans within its allocation. |
| judge | `detectConflicts` and `rollUpCost` (member C) | Turns proposals into targeted `RevisionRequest`s. |
| reviser | Any specialist with `supportsRevision` | Revises only its own section, from its previous proposal. |
| evidence | `ToolGateway` (maps, booking, weather) | Supplies grounded places, prices and forecasts. |

## 3.4 Structured class: TripPlanningWorkflow

The internal structure of the orchestrator as a composite: its parts, the ports it exposes and
requires, and the connectors between parts.
Rendered: [`../diagrams/structured-class.svg`](../diagrams/structured-class.svg).

```mermaid
flowchart LR
  pChat(("chatIn : ChatRequest"))
  pOut(("planOut : TripPlan"))
  pProg(("progress : AgentProgressEvent"))
  subgraph W["TripPlanningWorkflow «structured class»"]
    direction LR
    intake["intake : BriefExtractor [1]"]
    lg["graph : CompiledStateGraph [1]"]
    sup["supervisor : SupervisorAgent [0..1]"]
    reg["registry : SpecialistRegistry [1]"]
    specs["specialists : Specialist [5]"]
    brd["board : PlanningBoard [1]"]
    pol["policy : ConflictPolicy [1]"]
    bud["budget : BudgetCalculator [1]"]
    intake --> lg
    lg --> sup
    lg --> brd
    sup --> reg
    reg --> specs
    brd --> specs
    lg --> pol
    pol --> bud
  end
  pTools(("tools : ToolGateway"))
  pMem(("mem : MemoryStore"))
  pModel(("model : BaseChatModel"))
  pChat --> intake
  lg --> pOut
  lg --> pProg
  specs --> pTools
  specs --> pMem
  sup --> pModel
  intake --> pModel
```

| Element | Kind | Notes |
| --- | --- | --- |
| `chatIn`, `planOut`, `progress` | provided ports | `POST /api/chat` request in; NDJSON progress frames and a final `{ reply, plan }` out. |
| `tools`, `mem`, `model` | required ports | Injected through `OrchestratorOptions` and `AgentContext`; tests pass fakes. |
| `supervisor [0..1]` | part | Absent when no model is configured; the graph then dispatches deterministically. |
| `specialists [5]` | part | Itinerary, Transport, Accommodation, Destination guide, Dining. |
| `policy`, `budget` | parts | Member C's `detectConflicts`, `rollUpCost` and `minimumCost`. |
