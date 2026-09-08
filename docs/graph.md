# `@trip/graph` — the negotiation loop as a LangGraph StateGraph

Owner: A. This is a **second implementation** of the orchestrator loop, not a
rewrite. `@trip/orchestrator` keeps its hand-rolled `while` loop; `@trip/graph`
expresses the same steps as a `StateGraph` and both call the shared building
blocks in `packages/orchestrator/src/steps.ts`, so their behaviour is identical
(the graph's tests assert the exact same demo outcome: round 2, USD 2380).

## Why bother

| Concern | hand-rolled loop | LangGraph |
|---|---|---|
| K-round termination | manual `while (… && round < K)` | conditional edge; framework owns it |
| HITL | `buildHitl()` returns a list; nothing actually pauses | `interrupt()` — the run stops, `resumeGraph()` continues it |
| durable state | none — every call starts from zero | `MemorySaver` checkpointer keyed by `thread_id` |
| observability | `console.log` | LangSmith trace of every node (opt-in) |

## Shape

```
START → dispatch ──(conflicts & round<K)──▶ revise ──┐
           │                                          │
           └──────────(converged / round==K)──────────┤
                                                      ▼
                                                  assemble → hitl → END
                                                              │
                                              interrupt() if any pending checkpoint
```

- **dispatch** — `dispatch(brief, ctx(1))` → `AgentProposal[]`, then `detectConflicts`
- **revise** — `applyRevisions(...)` for the conflicting agents, re-`detectConflicts`
- **assemble** — `assemblePlan(...)` → the `TripPlan`
- **hitl** — if `plan.hitl` has a `pending` checkpoint, `interrupt(pending)`; the
  resume value is `{ checkpointId: "approved" | "rejected" }` and is merged back

## Use it

```ts
import { runGraph, resumeGraph } from "@trip/graph";

const { plan, awaitingUser } = await runGraph(brief);   // threadId defaults to brief.tripId
if (awaitingUser) {
  const done = await resumeGraph(brief.tripId, { "confirm-brief": "approved" });
}
```

In the web app: `POST /api/chat` runs the graph when `USE_GRAPH=true`, otherwise
`runOrchestrator`. Same `ChatResponse` shape either way, so E's UI does not change.

## LLM calls — `@trip/llm`

`@trip/llm` is a thin OpenRouter (OpenAI-compatible) client with retry + free-model
fallback. Agents don't use it yet — each owner wires it into their agent's
`run()`/`revise()` where a real model call helps. Config in `.env.local`:

```
OPENROUTER_API_KEY=sk-or-...      # from https://openrouter.ai/keys — never commit
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/free           # free auto-router; pin a specific :free model if it gets flaky
```

```ts
import { chat, chatJson, llmConfigured } from "@trip/llm";
const text = await chat([{ role: "user", content: "…" }]);
```

## CI

`.github/workflows/ci.yml` runs `pnpm typecheck && lint && test && build` on every
push to `main` and every PR. Turn on branch protection for `main` (require the CI
check + 1 review) so a red build can't be merged.
