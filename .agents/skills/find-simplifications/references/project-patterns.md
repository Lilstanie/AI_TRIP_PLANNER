# Project simplification patterns

These decisions calibrate a survey. Read current code and later notes before applying them; an old
removal does not establish that a similar feature is still unused.

## Require a complete effect path

The [decision-apparatus removal](../../../notes/implemented/simplification/2026-09-22-remove-hitl-decisions.md)
removed checkpoints with no downstream decision handling. Its question removal was later partly
superseded by [ask-user questions](../../../notes/implemented/feature/2026-09-23-ask-user-question.md),
whose answers feed the next turn. The useful distinction is whether the user's action changes a
working flow, not whether the feature resembles something previously removed.

## Remove a duplicate owner, preserve migration obligations

The [workspace catalog decision](../../../notes/implemented/architecture/2026-09-24-workspace-catalog-trip-storage.md)
replaces a separate Save trip snapshot flow with one catalog. It still reads the active legacy
workspace snapshot as migration input when no catalog exists. Search persisted keys and load paths
before declaring the old representation redundant; do not erase user data because a button is gone.

## Consolidate representation at the correct point

The [AUD decision](../../../notes/implemented/architecture/2026-09-20-aud-base-currency.md) gives stored
amounts one currency, while provider-native fare evidence keeps its currency outside totals. A
single accounting representation reduces downstream branches without pretending original evidence
uses the same units.

## Keep a wrapper's complete interface

The [feature-wiring decision](../../../notes/implemented/process/2026-09-24-end-to-end-feature-wiring.md)
records repeated loss of methods and data across wrappers. Preserving an original typed port and
overriding decorated behavior removes a parallel member inventory. Verify the actual consumer and
exception paths, not only the wrapper's type declaration.

## Retain test coverage owners

[PR #291](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/291), merged as `f046094`, implements
[Issue #286](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/286),
[Issue #288](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/288) and
[Issue #289](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/289). These are Issues, not separate
merged PRs. The [implemented coverage map](../../../notes/implemented/simplification/2026-10-10-repository-surface-reduction.md)
records the accepted removals; inspect current scripts and later decisions before reusing it.

- `map-provider-http` owns concurrent details HTTP success, absent fabricated ratings and
  language-separated details including the Kyoto Station name. `map-fallback` retains the visible
  card, route from the traveller's location, cycling persistence and mixed-provider outage journeys.
  HTTP assertions alone do not replace those browser integration boundaries.
- `agent-lab-failures` owns all five registered fault outcomes and independently recomputed figures,
  streamed/downloaded artifact equality, offline outcome/run-ID replay, Run all sequencing,
  cancellation and workspace storage isolation. `agent-lab-release` retains the representative
  `provider-empty-result` fault, its download/replay, benchmark and cross-view flow, isolation, leak
  checks and accessibility/layout matrix. Release smoke alone cannot justify deleting the full matrix.
- `trip-setup.mjs` shares place fixtures, workspace boot, day-to-plan conversion and polling for
  `auto-save-places`, `plan-revision` and `check-entry-point`, plus `touchSized` for every 44 px
  touch-target check. Their assertions, interception,
  held responses and screenshots remain local. Cancellation and stale ownership are distinct promises;
  do not hide them behind a flag-heavy universal setup.

Repeat the existing commands with each script's documented fixture environment and production mode
where required; retain summaries and the raw evidence under `output/e2e/` and `output/playwright/`.
For these examples, select both `map-provider-http` and `map-fallback`, both `agent-lab-release` and
`agent-lab-failures`, or all three trip consumers, as appropriate to the changed boundary. Historical
counts in #291 establish what ran then, not a pass on a new tree.

The same PR added failure-first details/photo checks for provider-unavailable 503 before the broader
404 handler, and pinned only Date for an expiring route fixture while retaining explicit DST/window
clocks. Preserve those failure boundaries rather than weakening assertions to make consolidation pass.
Its net line count includes helpers, imports and regressions; it establishes no runtime speedup.
