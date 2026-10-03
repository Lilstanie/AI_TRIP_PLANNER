# 8. Behaviour models (individual)

Each member's activity, sequence and state machine diagrams come from their own ad hoc requirement and use case specification, and show where the LLM sits and which deterministic code checks it.

## 8.1 Member C (`@HeadmasterEggy`, accommodation and budget)

All three diagrams come from ad hoc requirement **AH-C1** and the use case specifications **UC-C1
Arrange Accommodation** and **UC-C2 Manage Budget** (`01-requirements.md`, `02-use-cases.md`). Each
focuses on where the LLM sits and what deterministic code guards it, as the brief asks.

### 8.1.1 Activity diagram: Arrange Accommodation (UC-C1)

Swimlanes are the four participants. The LLM is used once, in _Choose one candidate id per segment_, and
its output is checked before anything is priced.

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

### 8.1.2 Sequence diagram: budget overrun and targeted revision (UC-C2, extension 2a)

One planning turn in which the first round goes over budget and the accommodation agent is asked to
cut its cost.

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

### 8.1.3 State machine: accommodation section within a planning turn (UC-C1 and UC-C2)

The section's visible status (`planning`, `draft`, `needs_you`) is derived from these internal
states.

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

| State                       | UI status | Entry / exit behaviour                                                                   |
| --------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| WaitingForTransport         | planning  | Waits only if transport was started in the same turn.                                    |
| Searching, Choosing, Priced | planning  | The LLM acts only in Choosing; invalid output loops back through the deterministic pick. |
| Kept                        | planning  | Booked stay, no search; floorCost 0 so it is never asked to cut.                         |
| UnderReview                 | planning  | Member C's `detectConflicts` decides the next state.                                     |
| Revising                    | planning  | Same preferences, new allocation; the round is kept only if `planScore` improves.        |
| Draft                       | draft     | No revision request targets the section.                                                 |
| NeedsYou                    | needs_you | The traveller decides: raise the budget, change dates or edit the plan.                  |
| Failed                      | —         | The run stops and names accommodation as the failing specialist.                         |

## 8.2 Member A

_Activity, sequence and state machine diagrams from AH-A1 and A's use case specification._

## 8.3 Member B

_Activity, sequence and state machine diagrams from AH-B1 and B's use case specification._

## 8.4 Member D

All three diagrams come from **AH-D1** and **UC-D1 View Weather-based Clothing Recommendation**.
The destination-guide and dining specialists run as part of one trip plan. The LLM drafts from
tool evidence; deterministic code validates schema, candidate names and meal budget before proposals
reach the plan. Weather provenance distinguishes a forecast from historical climate context.

### 8.4.1 Activity diagram: weather and dietary guidance (UC-D1)

The specialist paths run independently. Weather failure degrades only the guide's weather detail;
invalid model output uses deterministic, evidence-bounded guidance.

```mermaid
flowchart TB
  start((Start)) --> request

  subgraph TRAVELLER["Traveler"]
    request["Submit destination, dates, party and dietary needs"]
    view["View assembled trip plan"]
  end

  subgraph ORCH["Orchestrator"]
    dispatch["Validate TripBrief and dispatch specialists"]
    assemble["Validate AgentProposals and assemble TripPlan"]
  end

  subgraph GUIDE["Destination Guide"]
    guideStart["Read brief; fetch sight and museum candidates plus preferences"]
    coords{"Candidate coordinates and WeatherPort available?"}
    weatherEvidence["Request weather for first travel date"]
    horizon{"Weather result horizon?"}
    contextOnly["Use month context; mark forecast unavailable or not applicable"]
    guideEvidence["Give validated brief, weather and map evidence to LLM"]
    guideModel{"LLM configured and responds?"}
    guideLLM["LLM drafts destination and packing guidance"]
    guideCheck["Fit schema; validate and deduplicate attraction names"]
    guideValid{"Draft valid and grounded?"}
    guideFallback["Build deterministic guide from available map evidence"]
    guideProposal["Return destination-guide proposal with provenance"]
  end

  subgraph DINING["Dining"]
    diningStart["Fetch restaurant candidates and saved preferences"]
    diningPrepare["Deduplicate venues; filter dietary preferences; compute meal ceiling"]
    diningModel{"LLM configured and responds?"}
    diningLLM["LLM drafts venue suggestions from evidence"]
    diningCheck["Fit schema; validate candidate names and meal ceiling"]
    diningValid{"Draft valid and grounded?"}
    diningFallback["Build deterministic venue suggestions and budget envelope"]
    diningProposal["Return dining proposal; disclose direct allergy confirmation"]
  end

  subgraph WEATHER["Maps / Weather ports"]
    forecast["Forecast for days 0–14; climate context after day 14"]
  end

  subgraph LLM["Configured LLM"]
    guideDraft["Structured destination guide draft"]
    diningDraft["Structured dining draft"]
  end

  request --> dispatch
  dispatch --> guideStart
  dispatch --> diningStart
  guideStart --> coords
  coords -- yes --> weatherEvidence --> forecast --> horizon
  horizon -- forecast or climate --> guideEvidence
  horizon -- missing result --> contextOnly --> guideEvidence
  coords -- no --> contextOnly
  guideEvidence --> guideModel
  guideModel -- yes --> guideLLM --> guideDraft --> guideCheck --> guideValid
  guideModel -- no --> guideFallback
  guideValid -- yes --> guideProposal
  guideValid -- no --> guideFallback --> guideProposal
  diningStart --> diningPrepare --> diningModel
  diningModel -- yes --> diningLLM --> diningDraft --> diningCheck --> diningValid
  diningModel -- no --> diningFallback
  diningValid -- yes --> diningProposal
  diningValid -- no --> diningFallback --> diningProposal
  guideProposal --> assemble
  diningProposal --> assemble
  assemble --> view
```

### 8.4.2 Sequence diagram: weather-based packing and dietary dining (UC-D1)

The LLM receives validated evidence through read-only tools. Provider calls and post-model
validation remain deterministic.

```mermaid
sequenceDiagram
  autonumber
  actor T as Traveler
  participant UI as Web workspace
  participant WF as LangGraph workflow
  participant DG as Destination Guide agent
  participant DN as Dining agent
  participant MP as MapsPort
  participant WP as WeatherPort
  participant MEM as MemoryStore
  participant LLM as Configured LLM
  participant BD as Planning board

  T->>UI: Submit destination, dates, party and dietary needs
  UI->>WF: run(validated TripBrief)
  par Destination guide
    WF->>DG: invoke(brief, AgentContext)
    DG->>MP: places(destination, sight and museum)
    MP-->>DG: grounded place candidates
    DG->>MEM: getLongTerm(userId)
    MEM-->>DG: saved preferences
    alt Candidate coordinates and WeatherPort available
      DG->>WP: forecast(location, first travel date)
      alt Date within forecast horizon
        WP-->>DG: forecast + provider + observedAt + validUntil
      else Date beyond 14 days
        WP-->>DG: climate context, not a forecast
      end
    else No coordinates, port or weather result
      DG->>DG: use month context and record unavailable weather
    end
    DG->>LLM: read-only evidence tool: brief, month, places, preferences
    LLM-->>DG: structured destination and packing draft
    DG->>DG: fit schema, validate grounded names, deduplicate or fallback
    DG->>BD: destination-guide proposal + source and freshness
  and Dining
    WF->>DN: invoke(brief, AgentContext)
    DN->>MP: places(destination, restaurant)
    MP-->>DN: grounded restaurant candidates
    DN->>MEM: getLongTerm(userId)
    MEM-->>DN: saved preferences
    DN->>DN: deduplicate candidates, filter dietary needs, compute ceiling
    DN->>LLM: read-only evidence tool: candidates, preferences, ceiling
    LLM-->>DN: structured dining draft
    DN->>DN: fit schema, validate names and ceiling or fallback
    DN->>BD: dining proposal + meal budget, allergy confirmation caveat
  end
  WF->>BD: validate proposals and assemble TripPlan
  BD-->>WF: destination-guide and dining sections
  WF-->>UI: final plan with source labels and assumptions
  UI-->>T: Show packing context and dietary-aware venue candidates
```

### 8.4.3 State machine: destination-guide weather and packing section

The state machine follows the destination-guide proposal through evidence collection, model
validation and fallback. Dining produces a separate proposal in parallel.

```mermaid
stateDiagram-v2
  [*] --> AwaitingBrief
  AwaitingBrief --> GatheringEvidence : dispatch with validated TripBrief
  GatheringEvidence --> WeatherLookup : candidate coordinate and WeatherPort available
  GatheringEvidence --> Drafting : no coordinates or no WeatherPort / use month context
  WeatherLookup --> Drafting : forecast result with provenance
  WeatherLookup --> Drafting : climate result marked not a forecast
  WeatherLookup --> Drafting : provider error / mark weather unavailable
  GatheringEvidence --> Failed : MapsPort or MemoryStore fails
  Drafting --> Validating : LLM returns structured draft
  Drafting --> DeterministicFallback : no model or model call fails
  Validating --> Ready : schema valid and attractions match candidates
  Validating --> DeterministicFallback : invalid schema or ungrounded attraction
  DeterministicFallback --> Ready : build guidance from available evidence
  Ready --> [*] : proposal includes source and freshness
  Failed --> [*] : workflow reports specialist failure

  note right of WeatherLookup
    Forecast: at most 14 days
    Later dates: climate context
    Never label climate as forecast
  end note

  note right of DeterministicFallback
    No invented attractions
    Weather fallback is not a forecast
  end note
```

## 8.5 Member E

_Activity, sequence and state machine diagrams from AH-E1 and E's use case specification._
