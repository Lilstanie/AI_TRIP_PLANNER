---
date: 2026-10-08
author: Claude
branch: feature/one-day-trip-view-238
pr: none
area: apps/web, docs
contract-impact: none
---

# Merge the Trip drawer's Itinerary and Timeline tabs into one day view (#238)

## What changed

- `components/trip/TripPanel.tsx`, `TripEditor.tsx`, `timeline/TimelineStop.tsx`, new `timeline/StopForms.tsx`:
  one view with budget, day strip, the day's stops in visiting order, Ideas, then sections and Review plan.
  Each stop has a "…" menu, a time form and a compact place card (`stop-place-card`).
- Deleted `components/trip/TripPlaceList.tsx` and its test; removed the tab state from `useWorkspace.ts` and
  `WorkspaceView.tsx`; removed the dead `.trip-places*` rules from `app/styles/trip.css`.
- `lib/trip/trip-edit.ts`: a place edit is exempt from the "confirm the place for every stop first" blocker.
- `tests/e2e/itinerary.e2e.mjs`, `tests/e2e/timeline.e2e.mjs`, and three unit tests updated for the one view.
- Docs: `docs/workspace-ui.md` and `.zh.md` (pair recorded); Agent Note moved from `proposed/` to
  `implemented/feature/2026-10-08-one-day-trip-view.md`, with the three build deviations recorded there.

## Why

The spec (#233) asks for one view. Moves stay in the browser because the server refuses any day with an
unconfirmed stop. The place-edit exemption stops a deadlock when two unconfirmed stops share a day. See the
Agent Note for the trade-offs.

## Validation

- `pnpm --filter @trip/web test`: 52 files, 594 tests passed.
- `cd apps/web && npx tsc --noEmit`: exit 0. `pnpm --filter @trip/web lint`: no warnings or errors.
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline itinerary`: exit 0. Itinerary summary 80 passed, 0 failed.
  Timeline: 42 checks ok, 0 failed. One section skipped: the route check needs a Maps key (the place
  search returned 503/502).
- `node scripts/verify-docs.mjs`, `check-pairs.mjs` (24 pairs), `verify-protected-files.mjs origin/main`: passed.
- Prettier on every changed file; the two docs were reformatted and re-recorded.

## Notes for the next person

- Real Google Places matching and the route check need `MAPS_API_KEY`. E2E stubs the place-save provider call
  and records the place id, so the real save path is not covered here.
- Timeline E2E writes `numbers-summary.json` (the numbers shown), not a pass/fail summary; the runner JSON
  under `output/e2e/runner/` holds the pass/fail per script.
- The `editorView` catalog field remains, though no tab writes it.
