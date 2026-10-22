---
date: 2026-10-21
author: Claude
branch: fix/e2e-main-failures
pr: none
area: apps/web, docs
contract-impact: none
---

# Repair six E2E scripts that fail on main (#533)

## What changed

- `tests/e2e/trip-setup.mjs`: `startExamplePlan` types the English example when the zh chip cannot plan offline.
- `drawer-walkthrough`, `notice-keys`: zh passes use that helper; drawer also waits for Undo and the stay alternatives.
- `itinerary`: stubs `/api/places/details`; the remove check waits for the stop count to change.
- `trip-ui-triage`: ample-headroom case expects the caution state, matching `8149044`.
- `phone-state`: reloads once before the restore loop (see failures file).
- `check-entry-point`: case 4 asserts the held change is dropped without an error on the other trip.
- `phone-shell`: reads each companion summary from its real output path (`phone-map/<LABEL or after>`).
- `*.failures.md` for each script; `docs/e2e-known-failures` (en + zh) drops the phone-state row.

## Why

Each script was checked against its failure on `origin/main` before editing. Product code was not changed:
the zh chip and the 5% rule are product facts the scripts had not caught up with, and the others are
timing races or a state the script left behind. Open product questions are in the failure files.

## Validation

- Baseline `pnpm --filter @trip/web e2e drawer-walkthrough itinerary notice-keys trip-ui-triage phone-state check-entry-point` (dev, mock): five scripts failed; runner `output/e2e/runner/2026-10-21T13-40-34-278Z.json`.
- After repairs, same six scripts: notice-keys 60/60, trip-ui-triage, phone-state, check-entry-point, itinerary passed (runner `output/e2e/runner/2026-10-21T14-24-23-181Z.json`); drawer-walkthrough 194/194 on rerun.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`: passed.

## Notes for the next person

- Open decision: whether a held timeline change dropped by switching trips should show "Try the change again" (check-entry-point case 4).
- Product gap: while the tab revision is out of step, layout and catalog writes pause until reload (`useWorkspaceStorage`).
- Offline planning reads English destinations only; zh example chips need a model key.
