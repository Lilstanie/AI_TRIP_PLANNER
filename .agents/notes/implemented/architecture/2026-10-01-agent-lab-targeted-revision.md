# Agent Note: Agent Lab targeted revision and recomputable evaluation

Status: implemented
Owner: A (@Lilstanie)

## Problem

Comparing the single agent with the no-revision specialists measures specialization. A reader also
needs to see what targeted revision adds, which needs a conflict revision can actually fix, the loop's
decisions in the trace, and metrics nobody has to take on trust. The default Tokyo trip has no
conflict, and the workflow reported its decisions only as progress prose.

## Decision

`multi-agent-targeted-revision` is the same real workflow as the no-revision strategy with the
established bounded loop switched on (at most three rounds). It reuses conflict detection, targeted
routing, best-so-far scoring and the infeasible-budget stop rather than a lab-specific loop, so the
comparison measures the loop the product runs.

The conflict comes from a second registered scenario, `tokyo-couple-tight-budget`: the same brief,
evidence and specialists with a A$2,300 budget. The first round overruns, the cheapest flight and stay
fit, and only transport is revised. Both multi-agent strategies share that first round exactly; on the
original scenario they produce the same plan. The scripted baseline replays the same recording on
either scenario, as a lone scripted agent has no conflict check.

The workflow gained one optional hook, `OrchestratorOptions.onDecision`, which reports typed
`WorkflowDecision` facts: conflicts detected (targets, reasons, score, infeasibility), revision started
(objective and previous outcome), revision scored (before, after, kept) and loop stopped (round and
reason). Lab trace events are built from these facts, not from progress text, so rewording a progress
sentence cannot break them. The hook never changes the plan, and a consumer that throws is logged and
ignored. The chat progress protocol is unchanged.

Every metric except wall time is a pure function of the final plan and the trace
(`measureAgentLabRun` / `recomputeAgentLabMetrics`): grounding, repeated and generic stops,
multi-city consistency (null for a single city), stopping reason (null without a loop) and the figures
the comparison already used. No model judges anything. Token and model cost is recorded as
`{ status: "unavailable" }` because fixture runs make no model calls; it is never shown as zero.

## Alternatives considered

- Lower the budget of the default Tokyo scenario: rejected because it would rewrite the recorded
  baseline and the figures the earlier slices already publish; a second scenario leaves them intact
  and also shows the revision strategy changing nothing when there is nothing to repair.
- Derive the trace from progress-event prose or reconstruct scores in the lab: rejected as brittle and
  because the intermediate proposals needed for scoring only exist inside the graph.
- Add decision fields to the shared `AgentProgressEvent`: rejected to keep the chat protocol and its
  consumers unchanged for an experiment surface.
- Score quality with a model judge: rejected because the metrics must be recomputable from the
  artifact.

## Consequences

`packages/shared` gained the scenario and strategy ids (`tokyo-couple-tight-budget` and
`multi-agent-targeted-revision`, registered together with the strategy), four lab trace events, a stop-reason enum and
the new metrics; `schemaVersion` stays 1 because no earlier shape was released. Fixture runs still rely
on an environment without model or provider keys; with keys set the specialists use them. Repeated and
generic stops are measured on the specialists' deterministic fallback itinerary, which repeats one
placeholder place, so they say more about the fallback than about specialization. A future scenario
with several cities exercises the multi-city check, which has only unit-level evidence today.
