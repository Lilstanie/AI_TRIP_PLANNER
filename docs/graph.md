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

`@trip/llm` is a thin OpenRouter (OpenAI-compatible) client. Free-tier models
constantly return HTTP 429 / 502 / an empty body, so the client:

1. tries `AI_MODEL` (pinned to `google/gemma-4-26b-a4b-it:free`), then
   `google/gemma-4-31b-it:free`, then `openrouter/free` (the auto-router, which
   itself retries across every free provider);
2. retries each with backoff;
3. treats an empty completion as a failure — `chat()` never returns `""`.

Config in `.env.local` (never commit the key):

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=google/gemma-4-26b-a4b-it:free
```

API:

| function | on failure |
|---|---|
| `chat(messages, opts?)` | **throws** after the whole chain fails |
| `chatOrNull(messages, opts?)` | returns `null` |
| `chatJson<T>(messages, opts?)` | **throws** (network or unparseable) |
| `chatJsonOrNull<T>(messages, opts?)` | returns `null` |

### How to add an LLM call to your agent

**It's ~10 lines.** Use the `*OrNull` variant and fall back to your deterministic
logic, so a flaky endpoint degrades your section, never crashes the plan. The
worked example is `packages/agents/src/dining/index.ts` (owner D) — copy its shape:

```ts
import { chatJsonOrNull } from "@trip/llm";

async run(brief, ctx) {
  ctx.signal?.throwIfAborted();
  const prefs = await ctx.mem.getLongTerm(brief.userId);       // your inputs

  const llm = await chatJsonOrNull<MyShape>(
    [
      { role: "system", content: 'Reply with ONLY JSON: {"…":…}' },
      { role: "user", content: `…facts from brief + prefs…` },
    ],
    { signal: ctx.signal, maxTokens: 400 },
  );

  if (llm && /* looks valid */) {
    return { agent: "<name>", summary: "…", items: [/* from llm */], assumptions: ["LLM-generated"], conflictsWith: [] };
  }
  return { /* your existing stub proposal */ };            // fallback path
}
```

Test both paths with `vi.mock("@trip/llm")` — see
`packages/agents/src/dining/index.test.ts` (LLM success, dietary-pref passthrough,
`null` → fallback, aborted signal).

Later: if the team wants stricter DI, fold an `llm` port into `AgentContext` in
`@trip/shared` (coordinate — everyone depends on it) instead of importing directly.

## CI

`.github/workflows/ci.yml` runs `pnpm typecheck && lint && test && build` on every
push to `main` and every PR. Turn on branch protection for `main` (require the CI
check + 1 review) so a red build can't be merged.
