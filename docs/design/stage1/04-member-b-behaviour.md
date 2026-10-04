# 4. Behaviour models: member B — itinerary and transport

English | [中文](04-member-b-behaviour.zh.md)

These models derive from **AH-B1 / R-B1–R-B6** in [Requirements](01-requirements.md#15-member-b-requirement-classification) and **UC-B1 Arrange Transportation** in [Use cases](02-use-cases.md#24-uc-b1-arrange-transportation). They describe the current team implementation in B's assigned domain, not exclusive code authorship. The specialist boundary is `Specialist.invoke`.

## 4.1 Activity diagram

Rounded actions, guarded decisions, a filled initial node and a double-ring final node express the activity model in Mermaid. Responsibility regions separate the Transport LLM from deterministic code and the workflow. The revision action expands the targeted specialist's planning operation; it does not imply rerunning every agent. Cancellation can terminate any executing action and is omitted for readability.

![UC-B1 activity diagram](../diagrams/member-b/b-activity.svg)

[PNG](../diagrams/member-b/b-activity.png) · [Editable source](../diagrams/member-b/b-activity.mmd)

```mermaid
flowchart TB
  S(( )) --> A("Receive UC-B1 transport dispatch")
  subgraph TR["Transport specialist / deterministic code"]
    A --> M{"Model configured?"}
    G("Gather fares and routes via ToolGateway")
    V{"Selection valid?"}
    F("Use deterministic evidence-based plan")
    P("Validate route and day fit, copy evidence prices, record gaps")
    G0("Gather evidence without a model")
  end
  subgraph LM["Transport LLM"]
    L("Call search_transport_evidence")
    C("Choose offered flight IDs and hop departure slots")
  end
  M -- "[yes]" --> L --> G --> C --> V
  M -- "[no]" --> G0 --> F
  L -- "[model failure]" --> H("Reuse evidence or gather it if absent") --> F
  C -- "[model failure]" --> H
  V -- "[invalid IDs, coverage, day or time]" --> F
  V -- "[valid]" --> P
  F --> P
  subgraph WF["Workflow / planning board / related specialists"]
    B("Validate proposal schema and store on board")
    I("Coordinate itinerary with transport and stays, verify route gaps")
    D("Detect budget, time and geography conflicts")
    R{"Conflicts and feasible budget and round below 3?"}
    T("Increment round, invoke only targeted revisable specialists")
    Q{"Whole-plan score improves?"}
    K("Keep revised proposals")
    O("Restore previous proposals and stop")
    Z("Build draft or needs_you sections, retain pricing warnings")
  end
  P --> B --> I --> D --> R
  R -- "[yes]" --> T --> Q
  Q -- "[yes]" --> K --> D
  Q -- "[no]" --> O --> Z
  R -- "[no]" --> Z --> E(((●)))
  B -- "[schema rejected]" --> X("Report run failure") --> E
  G -- "[unrecoverable error]" --> X
  G0 -- "[unrecoverable error]" --> X
  style S fill:#18334d,stroke:#18334d
  style E fill:#ffffff,stroke:#18334d
```

## 4.2 Sequence diagram

The model-call branch shows rejected output falling back after validation. A separate no-model branch gathers evidence directly. The nested optional fragment invokes Transport only when targeted. A non-improving revision restores the previous proposals and exits the revision loop before final assembly; it does not recheck rejected proposals. A model failure before its search tool is called skips that tool exchange and gathers evidence in the fallback. Provider and cancellation errors that end the run are specified in UC-B1 rather than expanded here.

![UC-B1 sequence diagram](../diagrams/member-b/b-sequence.svg)

[PNG](../diagrams/member-b/b-sequence.png) · [Editable source](../diagrams/member-b/b-sequence.mmd)

```mermaid
sequenceDiagram
  autonumber
  actor T as Traveler
  participant W as Workflow / supervisor
  participant B as Planning board
  participant TR as Transport specialist
  participant L as Transport LLM
  participant G as ToolGateway
  participant C as Conflict policy
  T->>W: Arrange transportation with validated brief
  W->>B: run(transport)
  B->>TR: invoke(brief, context)
  alt Model configured
    TR->>L: Select flights and hop slots using evidence tool
    L->>TR: search_transport_evidence()
    TR->>G: searchFlights / route / optional routeOptions
    G-->>TR: Offered fares, durations and availability
    TR-->>L: Candidate IDs and route evidence
    L-->>TR: Structured selection or model failure
    TR->>TR: Check schema, candidate IDs, hop coverage and times
    alt Model failed or selection invalid
      opt Evidence not yet gathered
        TR->>G: Gather missing evidence
        G-->>TR: Available evidence and gaps
      end
      TR->>TR: deterministicPlan(evidence)
    else Selection valid
      TR->>TR: Resolve chosen IDs to returned fare data
    end
  else No model configured
    TR->>G: Gather transport evidence
    G-->>TR: Available evidence and gaps
    TR->>TR: deterministicPlan(evidence)
  end
  TR->>TR: Assemble proposal, validate route/day fit, retain unknown fares
  TR-->>B: Transport proposal (schema checked by workflow boundary)
  Note over W,B: Other dispatched specialists finish, itinerary checks connections and buffer
  B-->>W: Collected proposals
  W->>C: detectConflicts(proposals, brief)
  C-->>W: Revision requests
  loop Conflicts remain AND feasible AND round below 3 AND not stalled
    W->>W: Increment round
    opt Transport is targeted and supports revision
      W->>TR: invoke(brief, context, revision, previous, allocation)
      Note over TR,G: Repeat evidence, model/fallback selection and validation
      TR-->>W: Revised proposal
    end
    Note over W,B: Other targeted specialists also revise, untargeted proposals remain
    W->>W: Compare whole-plan score
    alt Score strictly improves
      W->>W: Keep revised proposals
      W->>C: detectConflicts(revised proposals, brief)
      C-->>W: Remaining requests
    else Score does not improve
      W->>W: Restore previous proposals and set stalled
      Note over W,C: No conflict recheck, stalled disables the next loop iteration
    end
  end
  W->>W: build_plan from best retained proposals and conflicts
  W-->>T: draft / needs_you, known estimate and pricing gaps
```

## 4.3 State machine

The subject is the transport proposal within one planning run. Transition labels follow event [guard] / action. Internal states are conceptual, not persisted enums; only `draft` and `needs_you` map to final section status. Whole-plan score comparison and round limits belong to the workflow. While other sections revise, an untargeted transport proposal remains under review until the workflow stops. An abort can terminate any non-final state; those repeated transitions are omitted.

![Transport proposal state machine](../diagrams/member-b/b-state.svg)

[PNG](../diagrams/member-b/b-state.png) · [Editable source](../diagrams/member-b/b-state.mmd)

```mermaid
stateDiagram-v2
  [*] --> Dispatched : dispatch
  Dispatched --> Gathering : invoke / validate brief and read preferences
  Gathering --> Selecting : evidenceReady [model configured]
  Gathering --> LocalPlan : evidenceReady [no model]
  Selecting --> Checking : selectionReturned
  Selecting --> LocalPlan : modelFailed / reuse or gather evidence
  Checking --> LocalPlan : validationComplete [invalid] / reject selection
  Checking --> Assembling : validationComplete [valid] / resolve candidate IDs
  LocalPlan --> Assembling : planSelected / use evidence-based choices
  Assembling --> UnderReview : proposalAccepted [initial round] / post proposal
  Assembling --> ReviewingRound : proposalAccepted [revision round]
  Gathering --> Failed : unrecoverableError
  Assembling --> Failed : proposalRejected
  UnderReview --> Revising : reviewComplete [transport targeted and feasible and round below 3]
  Revising --> Gathering : revisionDispatched / increment round and pass constraints
  ReviewingRound --> UnderReview : scored [scoreAfter less than scoreBefore] / retain and recheck
  ReviewingRound --> Finalising : scored [scoreAfter not less than scoreBefore] / restore previous and stop
  UnderReview --> Finalising : loopStopped
  Finalising --> NeedsYou : assembled [request targets transport]
  Finalising --> Draft : assembled [no request targets transport]
  Draft --> [*]
  NeedsYou --> [*]
  Failed --> [*]
  note right of Selecting
    LLM selects, code checks and prices.
    Internal states are design abstractions.
  end note
  note right of ReviewingRound
    Scoring belongs to the whole workflow.
    Other sections are abstracted here.
  end note
  note right of Draft
    draft is not booked or fully priced.
    Unknown ground fares remain warnings.
  end note
```

## 4.4 Implementation boundaries

- The LLM chooses offered flight IDs and hop departure slots. Deterministic code checks candidate membership, one fare per priced hop, required hop coverage, day bounds, time format and route/day fit before assembling a proposal.
- Unknown ground fares omit `estCost` and remain warnings; a required flight without a valid fare still records a conflict. Traveller-arranged flights are exempt. An unavailable chosen ground mode is explicitly disclosed rather than silently substituted.
- Itinerary planning checks connections against provider durations plus a 15-minute arrival buffer. Transport durations are gathered before model scheduling; a model-changed departure time does not trigger another time-sensitive route search.
- The default limit is three total rounds, including the first. Only targeted revisable specialists rerun. Non-improving rounds are discarded. There is no purchase, booking or approval checkpoint in this use case.
- Generated figures are for full-size report viewing; use the SVGs for zooming. Their detailed labels are not intended to be read as three tiny slide thumbnails.

## 4.5 AI acknowledgement

OpenAI Codex assisted with source inspection, the requirement and use-case draft, and diagram preparation. Tingsong Jin must review the individual submission and be able to explain the models. This statement does not assert that all current team code was implemented by B.
