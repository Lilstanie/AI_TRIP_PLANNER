# Agent Note: LangGraph owns the planning loop

Status: implemented
Owner: A (@Lilstanie)

## Problem

The orchestrator was a hand-written control loop. Dispatching specialists, detecting conflicts,
revising only the affected specialists and stopping after a bounded number of rounds were all
implicit in that loop, so every new conflict rule or HITL step meant editing control flow by hand.

## Decision

The orchestrator is a compiled LangGraph `StateGraph` in `packages/orchestrator/src/workflow.ts`
with explicit nodes: `dispatch_specialists`, `detect_conflicts`, `revise_conflicts` and
`build_plan`, plus a conditional edge that repeats revision up to `maxRounds` (default 3).
LangGraph owns deterministic workflow control; model calls stay inside bounded extraction and
specialist steps. Specialists, tools, memory and the round limit are injected through
`OrchestratorOptions`, and the flow still runs without any model key. The node-by-node behaviour
is documented in [architecture.md](../../../../docs/architecture.md#langgraph-workflow).

## Alternatives considered

**Keep the hand-written loop.** It worked for the mock flow, but revision targeting, round limits
and state passing were spread across imperative code with no single place to read the loop.

**Let a model drive the loop.** Not adopted: the round limit, conflict detection and cost roll-up
must be deterministic and testable; models are confined to steps whose output is schema-validated.

## Consequences

- The graph is readable and testable node by node; `packages/orchestrator/tests/budget.test.ts`
  exercises convergence and the round limit.
- The project depends on `@langchain/langgraph` and its release cadence.
- The browser sends the latest brief with every chat request, so incremental edits do not depend on
  server process state.

## Sources

[2026-09-08 LangGraph migration log](../../../session-logs/2026-09-08-codex.md)
