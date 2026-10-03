# 5. Architecture analysis and design

## 5.1 Viewpoints

The architecture is described from four viewpoints, chosen for the concerns of each stakeholder.

| Viewpoint | Stakeholder and concern | Where it is modelled |
| --- | --- | --- |
| Logical | Developers: which classes and contracts exist, and how they relate | Class model (§6), feature model (§3) |
| Process | Founder and developers: how agents run, wait for each other, retry and stop | Ad hoc design diagram (§5.2), behaviour models (§8), collaboration (§7.2) |
| Development | The five members: who owns which package, and which dependencies are allowed | Package diagram (§5.3) |
| Physical | Founder: where the system runs and which external services it pays for | Deployment diagram (§5.4) |
| Scenarios | Traveller: what the system does for them | Use cases (§4) |

## 5.2 Ad hoc design diagram: runtime flow

One request from the traveller's message to a validated plan. Solid arrows are the normal path;
dashed arrows are fallbacks when a model or provider is unavailable.

```mermaid
flowchart TB
    U[Traveller] --> UI[Next.js workspace]
    UI -->|POST /api/chat, NDJSON progress| CHAT[AI Travel Coordinator: runTripChat]
    CHAT -->|explicit brief updates| EX[LLM structured extraction]
    EX -.->|no key or invalid output| LP[Local rule parser]
    CHAT --> WF[LangGraph workflow]
    WF --> DISPATCH[dispatch_specialists / revise_conflicts]
    DISPATCH --> SUP[AI Planning Supervisor]
    DISPATCH -.->|no model or supervisor error| DIRECT[Deterministic dispatch]
    SUP --> SPEC[Itinerary · Transport · Accommodation · Destination · Dining agents]
    DIRECT --> SPEC
    SPEC --> TOOLS[Typed tool gateway: maps, booking, weather]
    SPEC -.->|model unavailable or off-schema| FB[Deterministic fallback output]
    WF --> CONF[detect_conflicts → build_plan]
    WF --- MEM[(MemoryStore)]
    CONF --> PLAN[Validated TripPlan with unresolved conflicts]
```

*Figure 5.1. Runtime flow.*

The LangGraph workflow drives the supervisor, not the other way round. The graph decides when to
dispatch, revise and stop; the supervisor only chooses which specialists a step needs. The control
path, budget red lines and stopping condition never depend on a model improvising the next step.

```mermaid
flowchart LR
    S((START)) --> D[dispatch_specialists]
    D --> C[detect_conflicts]
    C -->|conflicts, feasible and round < 3| R[revise_conflicts]
    R -->|plan score improved| C
    R -->|no improvement| B[build_plan]
    C -->|converged, infeasible or round = 3| B
    B --> E((END))
```

*Figure 5.2. The LangGraph planning loop.*

## 5.3 Package diagram

The repository is a pnpm and Turborepo monorepo. Dependencies point inward to the shared contracts;
`shared` depends on nothing, and no package imports the web app.

```mermaid
flowchart TB
    subgraph web["«package» @trip/web (apps/web) · E"]
      webui["workspace UI, API routes, Agent Lab page"]
    end
    subgraph orch["«package» @trip/orchestrator · A"]
      orchc["chat coordinator, LangGraph workflow, board, conflicts, budget"]
    end
    subgraph agents["«package» @trip/agents · B C D"]
      agc["five specialists, prompts, model routing"]
    end
    subgraph tools["«package» @trip/tools · B C D"]
      toolc["ToolGateway, maps, booking, weather adapters"]
    end
    subgraph services["«package» @trip/services · E"]
      svc["MemoryStore, trip store, JSON store"]
    end
    subgraph shared["«package» @trip/shared · A"]
      sh["Zod contracts: TripBrief, AgentProposal, TripPlan, ports"]
    end
    web -.->|«import»| orch
    web -.->|«import»| tools
    web -.->|«import»| services
    web -.->|«import»| shared
    orch -.->|«import»| agents
    orch -.->|«import»| tools
    orch -.->|«import»| services
    orch -.->|«import»| shared
    agents -.->|«import»| tools
    agents -.->|«import»| services
    agents -.->|«import»| shared
    tools -.->|«import»| services
    tools -.->|«import»| shared
    services -.->|«import»| shared
```

*Figure 5.3. Package diagram, with the owning member of each package.*

## 5.4 Deployment diagram

```mermaid
flowchart LR
    subgraph client["«device» Traveller's browser"]
      ls[(localStorage: chats, trips)]
      app[Next.js client]
    end
    subgraph vercel["«execution environment» Vercel serverless"]
      api[Next.js API routes + orchestrator]
    end
    subgraph data["«cloud services»"]
      redis[(Redis REST store)]
      neon[(Neon Postgres: accounts sync)]
      clerk[Clerk authentication]
    end
    subgraph ext["«external systems»"]
      llm[DeepSeek LLM]
      serp[SerpApi hotels and flights]
      goog[Google Places, Routes, Weather]
      osm[OpenStreetMap, Open-Meteo]
    end
    app -->|HTTPS, NDJSON| api
    app --- ls
    api --> redis
    api --> neon
    app --> clerk
    api --> llm
    api --> serp
    api --> goog
    api --> osm
```

*Figure 5.4. Deployment diagram.*

Without provider keys the same build runs fully offline on mock fixtures and process memory, which is
how the Agent Lab and the tests run.

## 5.5 Life-cycle process

The group follows an iterative, agile process. Work is tracked as GitHub issues with triage labels
and will be mirrored in Jira for Stage 2, as the brief requires. Each change is a short-lived branch merged into `main` through a pull
request after CI (typecheck, lint, tests, build, documentation and protected-file checks). Decisions
with lasting rationale are recorded as Agent Notes in the repository, so the design model and the
code are reviewed in the same pull request.
