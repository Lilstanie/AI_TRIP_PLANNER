# Failure inventory: notice keys

Baseline: `origin/main` `25ce9fa` (2026-10-21), same invocation as the other five scripts; runner `output/e2e/runner/2026-10-21T13-40-34-278Z.json`. The en passes are green; the first zh pass times out waiting for `.trip-editor`.

- Trigger and cause: identical to `drawer-walkthrough` (zh example chip is answered with "include the destination" offline).
- Expected: the zh pass reaches a plan and checks notice keys on the trip editor.
- Would hide a regression: as for `drawer-walkthrough`, the zh UI keys are still asserted on the zh interface; only the planning prompt language changes.
- Repair: the zh pass uses `startExamplePlan` with the English example.
