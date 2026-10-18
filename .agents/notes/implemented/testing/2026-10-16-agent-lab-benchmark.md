# Agent Note: Versioned Agent Lab benchmark

Status: implemented
Owner: A (@Lilstanie)

## Problem

Agent Lab had useful scenarios and fault profiles, but no versioned benchmark configuration, repeatable report, or boundary between fixture measurements and capped live measurements. Results could therefore omit failures, drift from the page's replayable artifacts, or be described as quality evidence without support.

## Decision

The orchestrator exports one versioned benchmark registry. It lists each fixture scenario with its fixture version, expected outcome and required checks, all registered strategies, and every registered fault profile. `GET /api/agent-lab/benchmark` exposes this registry to the E2E runner so the report does not maintain a second scenario or fault list. The existing artifact schema remains version 1; scenario IDs are additive shared-contract values.

Every scenario variant owns a scripted plan fixture or an explicitly named source fixture. Scenario-specific must-pass checks cover explicit and infeasible budgets, competing meal preferences, vague briefs, trip-day windows, hotel date ranges, stay-night evidence, and overnight-aware transfer days. The evaluator is `scenario-rules-v7`; every activity in a trip-day scenario must carry an in-range day, hotel dates must match the trip window, stay-night evidence matches the complete night count, and transfer-day activity checks account for the overnight city. Scenario-specific fixture changes use distinct v2 fixture versions; registry and evaluator changes bump the benchmark to 1.0.6 and evaluator to `scenario-rules-v7`.

The `agent-lab-benchmark` E2E command executes every scenario once under every strategy in fixture mode and each registered fault in its registered scenario and strategy. It writes the report from those exact artifacts, including failed runs, checks, expected and observed outcomes, recovery, provider-reported usage or unavailable, latency, and denominators. An observed safe stop includes failed artifacts and explicit infeasible-budget stops; a completed run with any failed evaluator check is partial, and complete requires all checks to pass. This lets the report show strategy-specific gaps, such as a baseline that completes an infeasible-budget scenario without reporting the supported floor. It replays one retained artifact through the production page and checks that the displayed metric matches the report source.

Live measurements are separately opt-in with `AGENT_LAB_BENCHMARK_LIVE=true`. The subset is three scenarios, the strategies that declare live support, and three repeats; each request uses the existing live gate, and execution stops on its first refusal. The report preserves the configured maximum, actual count, skipped strategies, refusals, per-pair median latency and spread. Fixture and live artifacts and summaries remain separate.

The README reports no measured aggregate until a retained benchmark report is reviewed and linked, and states that plan quality has not been assessed. A controlled deployment smoke is documented by the release-record template; the run records the deployed commit, providers actually called, outcome and call cap, never credentials.

## Alternatives considered

- **Create a separate evaluation package.** Rejected because Agent Lab already owns the runner, artifacts, metrics and replay; a second package would duplicate them.
- **Run the same fixture repeatedly.** Rejected because deterministic fixtures do not provide a meaningful distribution.
- **Include unsupported strategies in live execution.** Rejected because the baseline has no live implementation; the report lists it as skipped.
- **Persist traces for ordinary trip planning.** Deferred because that requires storage, access control and a privacy boundary beyond this benchmark.
- **Add subjective plan-quality scores.** Deferred until a defined, repeatable review process exists.

## Consequences

Scenario IDs are shared contracts and the new IDs keep artifact schema version 1 backward-compatible. The benchmark measures these fixtures and recorded runtime behavior only; it does not establish live service quality or plan quality. Changing benchmark membership, expectations or required checks requires a benchmark version change. Scenario fixture changes also require updating their fixture version.

The earlier [scenario checks note](../architecture/2026-10-02-agent-lab-benchmark-scenarios.md) remains in force for its evaluator decisions and is extended by this benchmark registry. The [live gate note](../architecture/2026-10-02-agent-lab-live-gate.md) continues to own admission limits.

## Sources

- [Issue #402](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/402)
- [Agent Lab architecture](../../../../docs/architecture.md#agent-lab)
- [Agent Lab benchmark E2E](../../../../apps/web/tests/e2e/agent-lab-benchmark.e2e.mjs)
- [Release smoke record template](../../../../docs/agent-lab-release-record-template.md)
