---
date: 2026-10-06
author: Claude Code
branch: refactor/deepening-review-fixes
pr: none
area: apps/web, docs
contract-impact: api
---

# Review fixes for the workspace deepening (#196)

## What changed

- `docs/api.md` + `docs/api.zh.md`: a "failure bodies" paragraph (`{ error, notice }`) linked from
  `/api/chat` (400 text "The request was invalid. Please retry.", the NDJSON `error` frame), the
  places routes, `/api/routes/from-location` and the account routes.
- Removed the never-set workspace `notice` state, `dismissNotice`, its banner in
  `WorkspaceView.tsx`, the `.notice` CSS and the two dictionary keys only it used. `retryStorage`
  stays: the storage error banner still uses it.
- `apps/web/lib/money.ts`: fares group thousands from four digits (`KRW 1,400`), as spec story 19
  asks; `money.test.ts` failure case first; `docs/workspace-ui.md` (+ zh) Money paragraph.
- `timeline.e2e.mjs`: the two `KRW 1400` assertions now expect `KRW 1,400` (intended change), and
  a new stop-numbers section: Day 2 start times disagree with plan order and Day 2 revisits Day 1's
  first place; timeline, Trip drawer list, map fallback list and popups and the phone map sheet all
  show `1 Alpha, 3 Delta, 4 Charlie`. It also checks the timeline's Move later request and the trip
  list's Move later swap. Numbers are written to `numbers-summary.json`.
- `source-budget.e2e.mjs`: the 390 px pass uses the phone shell (Mine tab for Settings and chats,
  the trip-title sheet for the budget); the 1440 px pass is unchanged.

## Why

The timeline's Move later re-times the day from server-side Google routes, which mock fixture
places cannot have, so the E2E checks the position it requests (after Delta in plan order) instead
of the applied result. The trip list's Move later is applied in the browser and is checked end to end.

## Validation

- `pnpm --filter @trip/web lint`, `typecheck`: clean. `test`: 53 files, 592 tests passed.
- `pnpm verify:docs`, `pnpm verify:protected`: pass. `check-pairs.mjs`: 24 pairs OK.
- Production build with mock tools on port 3107: `timeline` (all ok; the route check is skipped
  without a map key, as before), `source-budget` 22/22 at 1440 and 390, `phone-map` and
  `display-currency` and `phone-shell` exit 0 with no failed check.

## Notes for the next person

- With a map key set, the map-marker check logs a skip: markers are drawn on the canvas.
