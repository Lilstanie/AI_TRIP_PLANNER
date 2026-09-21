# @trip/orchestrator

The LangGraph planning workflow and the chat front door. It turns chat messages into a `TripBrief`,
dispatches the specialists, detects and revises conflicts, rolls up cost and returns a `TripPlan`.
Owner: A (@Lilstanie); budget roll-up and thresholds: C.

## Exports

| Export                                            | Purpose                                                        |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `runTripChat()`                                   | Chat entry used by `/api/chat`: extract, plan, reply, stream   |
| `IncompleteBriefError`                            | Thrown when a new conversation lacks what planning needs       |
| `runOrchestrator()`, `createOrchestratorGraph()`  | Run or build the LangGraph workflow                            |
| `detectConflicts()`, `rollUpCost()`               | Conflict detection and AUD cost roll-up                        |
| `applyBriefPatch()`, `extractBriefPatchLocally()` | Apply extracted updates; the no-key rule parser                |
| `parseFlightQuery()`, `answerFlightQuery()`       | Answer a direct fare question without planning a trip          |
| `parseTripDate()`, `isAmbiguous()`                | Date reading for the offline parser                            |
| supervisor helpers                                | `dispatchWithSupervisor()`, `reviseWithSupervisor()` and tools |
| `DEMO_BRIEF`                                      | Baseline brief for clients that send none                      |

## Behaviour

The graph, its nodes and the round limit are described in
[architecture.md](../../docs/architecture.md#langgraph-workflow); the decision is in the
[LangGraph note](../../.agents/notes/implemented/architecture/2026-09-08-langgraph-orchestration.md). Model calls go through
`@trip/agents`' routing, so this package reads no environment variables itself.

## Contracts

- Specialists, tools, memory and `maxRounds` are injectable through `OrchestratorOptions`; tests
  pass fakes.
- The brief, each proposal and the final plan are validated against `@trip/shared` schemas at the
  graph boundaries.
- A proposal without a `source` gets a "Source not recorded" default; specialists are expected to
  set their own.
- Progress is streamed as `AgentProgressEvent`s; prompts and raw model reasoning are not exposed
  except through the reasoning sink the chat transcript renders.

## Tests

`pnpm --filter @trip/orchestrator test`; `tests/workflow.test.ts` covers the graph and
`tests/budget.test.ts` convergence and the round limit.
