<a id="4-behaviour-models-member-d-jbia0391-destination-guide-and-dining"></a>

# 4. 行为模型：成员 D（`@jbia0391`，目的地指南与餐饮）

[English](04-member-d-behaviour.md) | 中文

三张图都来自 [01-requirements.zh.md](01-requirements.zh.md) 和 [02-use-cases.zh.md](02-use-cases.zh.md) 中的 **AH-D1** 与 **UC-D1 View Weather-based Clothing Recommendation**。同一次行程计划会分派目的地指南和餐饮两个 specialist。LLM 根据工具证据起草内容；确定性代码在提案进入计划前验证 schema、名称和预算。天气来源信息会区分天气预报与历史气候背景。

<a id="41-activity-diagram-weather-and-dietary-guidance-uc-d1"></a>

## 4.1 活动图：天气与饮食建议（UC-D1）

两个 specialist 的处理路径并行运行。天气提供方失败只会降级目的地指南中的天气内容；无效模型输出会改用有证据边界的确定性建议。

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

<a id="42-sequence-diagram-weather-based-packing-and-dietary-dining-uc-d1"></a>

## 4.2 时序图：天气行李建议与饮食建议（UC-D1）

LLM 通过只读工具取得已验证的证据。数据提供方调用和模型调用后的验证仍由确定性代码负责；图中展示同一次运行里的目的地指南和餐饮路径。

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

<a id="43-state-machine-destination-guide-weather-and-packing-section"></a>

## 4.3 狀態機：目的地指南的天氣與行李建議區段

狀態機描述目的地指南提案如何收集證據、驗證模型輸出並在需要時回退。Dining 會並行產生另一份提案，如 §4.1–4.2 所示。

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

| 状态                  | 提案行为                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| GatheringEvidence     | 读取地点候选和偏好；必要的地图或记忆读取失败会导致该 specialist 失败。    |
| WeatherLookup         | 仅在存在候选地点坐标和 WeatherPort 时调用；记录返回的时间范围和来源信息。 |
| Drafting, Validating  | LLM 起草指南；确定性代码适配输出，并且只接受有地图依据的景点名称。        |
| DeterministicFallback | 使用本地建议和已收集的地点证据；不会编造天气或景点。                      |
| Ready                 | 返回指南提案及来源、新鲜度信息，并清楚区分预报与气候背景。                |
| Failed                | 工作流报告 specialist 失败；单独的天气失败不会进入此状态。                |
