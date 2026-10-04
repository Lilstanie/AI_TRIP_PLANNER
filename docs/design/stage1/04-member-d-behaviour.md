# 4. Behaviour models: member D (`@jbia0391`, destination guide and dining)

English | [中文](04-member-d-behaviour.zh.md)

All three diagrams come from **AH-D1** and **UC-D1 View Weather-based Clothing Recommendation** in
[01-requirements.md](01-requirements.md) and [02-use-cases.md](02-use-cases.md). The use case
dispatches the destination-guide and dining specialists as part of one trip plan. The LLM drafts
language from tool evidence; deterministic code validates schema, names and budget before proposals
reach the plan. Weather provenance distinguishes a forecast from historical climate context.

## 4.1 Activity diagram: weather and dietary guidance (UC-D1)

The two specialist paths run independently. A weather-provider failure degrades only the guide's
weather detail; invalid model output uses deterministic, evidence-bounded guidance.

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

## 4.2 Sequence diagram: weather-based packing and dietary dining (UC-D1)

The LLM receives validated evidence through read-only tools. Provider calls and the post-model
validation remain deterministic; the diagram shows the guide and dining paths in the same run.

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

## 4.3 State machine: destination-guide weather and packing section

The state machine follows the destination-guide proposal through evidence collection, model
validation and fallback. Dining produces a separate proposal in parallel, as shown in §4.1–4.2.

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

| State                 | Proposal behaviour                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GatheringEvidence     | Reads place candidates and preferences; failure of required maps or memory retrieval fails this specialist.       |
| WeatherLookup         | Runs only when a candidate coordinate and WeatherPort are available; records the returned horizon and provenance. |
| Drafting, Validating  | The LLM drafts the guide; deterministic code fits the output and accepts only grounded attraction names.          |
| DeterministicFallback | Uses local guidance and gathered place evidence; it does not manufacture weather or attractions.                  |
| Ready                 | Returns the guide proposal with source/freshness and forecast-versus-climate wording.                             |
| Failed                | The specialist failure is reported by the workflow; a weather-only failure does not enter this state.             |
