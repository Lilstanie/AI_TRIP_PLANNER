# Agent Note: Select CLI acceptance and aggregate isolated workers

Status: implemented

## Problem

Ordinary documentation pull requests paid the cost of installing browsers and running every CLI
acceptance script. One checkout cannot run these fixtures concurrently: scripts temporarily replace
shared dependency entrypoints. Separately passing dependent changes also do not prove their combined
state, and an empty or missing worker result can be mistaken for an intentional skip.

## Decision

The builtin-only plan job checks out full history and selects from the merge base of explicit PR
base/head SHAs through PR head. Shared or unknown changes, inventory drift and unavailable revision
comparisons choose full coverage; invalid inventory fails. Main pushes select every discovered script
on the checked-out SHA. Reviewed ordinary documentation can skip only with an explicit validated plan.

The JSON plan transfers as an artifact to at most three nonempty workers. Each has its own checkout,
dependency tree, browser installation and process namespace. Scripts remain serial within a worker;
selected IDs are assigned exactly once. Duration estimates affect placement, never coverage. Matrix
failure does not cancel other workers. The no-argument local runner still executes the complete suite.

`ci-result.mjs` publishes matrix metadata and classifies results through public commands. It shares
plan validation with the runner; only the CI commands accept valid skip plans. Each worker records its
shard, job result and transferred-plan digest. The always-running stable `cli-acceptance` aggregate
requires successful planning and either a consistent explicit skip with skipped workers/no receipts,
or successful workers with exactly one successful digest-bound receipt per planned shard. Missing,
failed, cancelled, duplicate, malformed or unexpected work fails. Download/upload failures remain
failures. Plan and per-worker evidence artifacts include run/attempt/planner-or-shard identity and
retain seven days, including failure evidence.

Related tickets use one integration branch and PR by default. Separate dependent PRs verify their
combined integration state before merge. Full main results are post-merge regression evidence for
that exact SHA, not full pre-merge guarantees or evidence reused from an earlier SHA.
[Development](../../../../docs/development.md#cli-acceptance-in-ci) owns commands and current behavior.

This partly replaces CI scheduling in the
[performance acceptance note](../testing/2026-10-11-e2e-performance-acceptance.md). Its serial execution
rationale still applies within every checkout. Its isolation, report, workspace persistence, replay
and performance decisions remain in force; the note is retained and cross-linked.

## Alternatives considered

- Keep complete serial coverage on every PR: retains documentation setup and execution costs.
- Run scripts concurrently in one checkout: dependency-entrypoint mutation breaks fixture isolation.
- Use independently passing dependent PRs and rely on main: detects composition regressions only after
  merge; combined integration evidence is required beforehand.

## Consequences

- Unknown paths and inventory drift deliberately cost full coverage. Narrow rules require dependency
  review; new scripts never silently disappear. The integration acceptance filename is reviewed.
- Separate workers repeat installation and consume more runners. Three is a concurrency limit, not a
  duration promise. No new build/browser cache or fixture parallelism is introduced.
- Receipts add small artifacts but make missing planned work explicit. Existing checks and protected
  jobs retain their behavior; no branch protection or automatic merge policy changes.
- Subprocess acceptance retains selected-ID, skip, failure and aggregate evidence. It cannot establish
  GitHub scheduling, Linux/Node 22 execution or remote artifact availability; final integration PR CI
  must supply that evidence before merge.

## Sources

- [Spec #314](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/314),
  [integration #317](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/317) and
  [integration PR #318](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/318).
- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
- [Baseline CLI job](https://github.com/Lilstanie/AI_TRIP_PLANNER/actions/runs/38216568999/job/114702587834):
  14m43s total, 2m35s browser setup, 11m43s acceptance; these are observed CI step times.
