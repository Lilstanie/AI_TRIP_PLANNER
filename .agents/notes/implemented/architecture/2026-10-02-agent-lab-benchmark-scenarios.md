# Agent Note: Agent Lab benchmark scenarios and their checks

Status: implemented
Owner: A (@Lilstanie)

## Problem

Agent Lab had two scenarios, both feasible Tokyo trips. It could not show how a strategy behaves when
the request itself is impossible, or whether a plan that spans two cities keeps its transport, stays
and daily itinerary in agreement. A fixed set of checks also had a flaw for the impossible case: "within
budget" would pass for a plan that invented cheaper evidence and fail for every honest one, so it would
reward fabricating feasibility.

## Decision

The registry gains two scenarios, `paris-family-infeasible` and `tokyo-kyoto-multi-city`, so
`AgentLabScenarioId` in `packages/shared` has four values. Adding values keeps every earlier artifact
parseable, so `AGENT_LAB_ARTIFACT_SCHEMA_VERSION` stays 1.

A scenario whose evidence shows no plan can fit the budget declares `rules.infeasibleBudget`, the
cheapest flights and stays its fixtures support (A$3,880 for Paris against A$3,000). The evaluator then
drops the `budget` and `no-conflicts` checks, which nobody can pass, and measures honesty instead:
`evidence-floor` (the estimate is not below that minimum) and `infeasibility-reported` (the plan holds an
`infeasible budget` conflict that names the minimum). Section count, destination and the other
shared checks still apply, so dropping a section to fit still fails.

A trip with several cities in its destination (joined with "&") gets `hop-date`, `itinerary-by-city`,
`stay-transition`, `trip-dates` and `total-consistent`. They take the cities from the brief, not from
fixed names, and check that the move falls inside the trip on the date it states, that each day's
activities are in that day's city, that stays hand over on the move date and span the trip, and that
section costs add up. The early-start check counts activities only, so an early train is not an early
activity.

The scripted single-agent baselines are honest recordings from the same evidence: the Paris baseline
prices the trip at the minimum and, having no conflict check, never says the budget cannot be met; the
Tokyo and Kyoto baseline is consistent. `AGENT_LAB_EVALUATOR_VERSION` (`scenario-rules-v2`) is recorded in
every artifact next to the scenario's fixture version. The comparison's conflict outcome is derived
from `stopReason`, `unresolvedConflicts` and `rounds`; the artifact has no new field for it.

## Alternatives considered

- **Let the Paris baseline report the shortfall too.** Rejected: the baseline is defined as having no
  conflict check, and giving it one would remove the difference the comparison exists to measure.
- **Keep the `budget` check on the infeasible scenario.** Rejected: it fails every strategy for the
  request instead of for what the strategy did.
- **Seed the multi-city baseline with an inconsistency.** Rejected: it rigs the result. The checks are
  proved able to fail with deliberately broken plans in `agent-lab-benchmarks.test.ts`, and the E2E
  recomputes them independently.
- **Add a conflict-outcome field to the metrics.** Rejected: it would change the shared contract for a
  value the existing metrics already determine.

## Consequences

The benchmark shows what each strategy adds: both multi-agent strategies report the infeasibility and
spend no revision round, while the baseline overruns silently. It also couples the evaluator to two
production texts: the `infeasible budget` conflict wording and its `AUD` amounts in
`packages/orchestrator/src/conflicts.ts`, and the `YYYY-MM-DD to YYYY-MM-DD` stay dates in the
accommodation specialist's hotel detail. A change to either must update the evaluator, and the benchmark
test fails if the declared minimum drifts from what the workflow reports. Changing a check or a fixture
needs a new evaluator or fixture version so an old artifact can be told from a current one.

## Sources

- [Agent Lab strategy and run artifacts](2026-10-01-agent-lab-run-artifacts.md)
- [Targeted revision](2026-10-01-agent-lab-targeted-revision.md)
- [Benchmark tests](../../../../packages/orchestrator/tests/agent-lab-benchmarks.test.ts)
- [Benchmark E2E](../../../../apps/web/tests/e2e/agent-lab-benchmarks.e2e.mjs)
