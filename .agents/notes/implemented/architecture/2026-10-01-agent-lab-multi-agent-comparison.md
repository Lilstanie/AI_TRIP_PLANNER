# Agent Note: Agent Lab specialization comparison

Status: implemented
Owner: A (@Lilstanie)

## Problem

The single-agent baseline had nothing to be compared against, and a comparison is only fair if the
other side is the real planner, runs under the same measurement and does not quietly include
targeted revision. Without that, any difference could come from the revision step, from a different evidence set, or
from how the two sides were scored.

## Decision

`multi-agent-no-revision` runs the registered specialists through the real LangGraph workflow and
planning board with `maxRounds: 1`, so the graph assembles a plan and reports conflicts but never
reaches `revise_conflicts`. The comparison measures specialization, not targeted revision.

Both strategies go through one runner, one evaluator and one artifact, so they are measured by the same
code. The runner counts rounds, tool calls, fallback sections, failed agents and unresolved conflicts
from the trace and plan, and reports `latencyMs` separately from `durationMs`: pacing exists so a
visitor can watch the stream, and counting it would make a strategy that emits more events look slower
for no reason. Fixture latency measures orchestration overhead only and is never model latency.

The specialists read the scenario's own preferences through a read-only `MemoryStore`, never a stored
traveller profile, so both strategies see the same evidence. Each specialist's tool calls are
attributed to it by wrapping its gateway in the lab, which leaves the production workflow unchanged.
The comparison view reads every figure from the artifact and never ranks the strategies.

The single-agent baseline is a scripted plan after one evidence load, not a model run, so tool-call
counts compare what each trace recorded, not equal workloads. A test pins the baseline's fare and stay
to the specialists' provider evidence.

## Alternatives considered

- Build a second, simpler planner as the baseline: rejected because every difference would then
  reflect how that planner was coded rather than specialization.
- Run both strategies in parallel on the page: rejected because concurrent runs would blur each
  run's latency.
- Add a dedicated comparison endpoint: rejected because two ordinary runs already carry everything
  and keep the contract small.
- Guard fixture runs against deployment model and provider keys: not done; the lab is meant to run in
  an environment without them, and the owner chose not to add protection for accidental calls.

## Consequences

`AgentLabStrategyId` gained `multi-agent-no-revision`; lifecycle events carry an actor; and
`AgentLabMetrics` gained `latencyMs`, `rounds`, `toolCalls`, `fallbacks`, `failedAgents` and
`unresolvedConflicts`. The artifact `schemaVersion` stays 1 because nothing was released with the
earlier shape. A deployment that sets model or provider keys makes the multi-agent fixture run use
them. Later strategies (bounded revision, replay, injected failure) register in the same strategy
table and appear in the same comparison.
