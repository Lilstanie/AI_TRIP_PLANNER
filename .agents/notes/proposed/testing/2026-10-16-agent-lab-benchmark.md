# Agent Note: Grow Agent Lab into a versioned benchmark before adding features

Status: proposed

## Problem

The next phase is meant to show that the planner is a reliable, measurable system rather than to add
features. Agent Lab already runs four scenarios under three strategies, injects five faults, and
computes deterministic metrics (checks, usage, fixture latency) into versioned artifacts that replay
offline. Four scenarios cannot support a claim about strategies, there is no fixed, versioned set
whose results are comparable across code versions, and nothing says which figures may be reported or
how fixture and live results relate. An improvement roadmap kept outside the repository proposed a
separate root `evals/` package, human rubric scores, traces for every planning request and 50–100
cases at once.

## Proposal

- **Benchmark inside Agent Lab.** A benchmark is a versioned set of Agent Lab scenarios run under the
  same strategies and configuration. It reuses the existing run, metric, artifact and replay code; no
  root `evals/` package and no second metric definition.
- **First benchmark: about 12 scenarios**, at least one per category: ordinary single city, multi-city,
  explicit budget, tight or infeasible budget, conflicting preferences, date and night-count edges,
  missing or vague information, and each registered fault. Partial-replanning cases wait until that
  capability is built, because a scenario today is a brief and an edit case needs a plan plus an edit.
- **Fixture is the main report.** Each scenario runs once per strategy in fixture mode; fixture runs
  repeat exactly, so repeats add nothing. Live comparison is a capped subset (3 scenarios × 3
  strategies × 3 repeats) behind the existing live gate, reported separately and never mixed with
  fixture figures. Failed runs stay in every denominator.
- **Metrics only in the first round.** Reported figures are metrics (computed from a run's plan and
  trace alone). Ratings against a rubric are deferred; the README shows plan quality as not yet
  assessed rather than an example number.
- **Traces for Agent Lab and benchmark runs only.** Ordinary planning requests carry real trips, so
  their traces are not persisted in this round.
- **Deployment smoke by the owner.** A controlled live smoke on the target deployment uses one or two
  scenarios with a call cap and is recorded as a release record: commit, providers actually called,
  outcome, never a key.

## Alternatives considered

- **A separate root `evals/` package.** Rejected: it changes protected workspace configuration and
  would keep a second set of metric definitions beside Agent Lab's.
- **50–100 cases in the first batch.** Rejected for now: every scenario needs hand-built fixture
  evidence (places, fares, stays, weather), so the cost is in authoring; the baseline decides how far
  to grow.
- **Repeated fixture runs with distributions.** Rejected: fixture runs are deterministic, so variance
  is zero by construction; distributions only mean something for live runs.
- **Rubric ratings in the first round.** Deferred: blind human rating needs several raters, and model
  judging brings back the nondeterminism metrics avoid.
- **Persisted traces for every planning request.** Deferred: it needs new storage, access control and
  a privacy boundary for real trips.

## Acceptance criteria

- A benchmark version names its scenarios, strategies and configuration, and its fixture run produces
  one report from the same artifacts the page replays.
- The report gives checks, recovery, usage and latency per scenario and strategy, with failures and
  denominators shown and fixture and live kept apart.
- Live runs stay within the live gate's limits and the subset's cap.
- README figures are quoted only from such a report; unmeasured figures say so.

## Risks

- New scenario ids extend `AgentLabScenarioId` in `packages/shared`, a shared contract that needs this
  note and `contract-impact: packages/shared` in the change that adds them.
- Strategies without a live implementation shrink the live subset; the report must say which ran.
- A 12-scenario benchmark supports comparisons on these fixtures only, not claims about live quality.

## Sources

- [Agent Lab benchmark scenarios](../../implemented/architecture/2026-10-02-agent-lab-benchmark-scenarios.md),
  extended rather than superseded.
- [Agent Lab live gate](../../implemented/architecture/2026-10-02-agent-lab-live-gate.md), which still
  owns live limits.
- [Agent Lab run artifacts](../../implemented/architecture/2026-10-01-agent-lab-run-artifacts.md).
