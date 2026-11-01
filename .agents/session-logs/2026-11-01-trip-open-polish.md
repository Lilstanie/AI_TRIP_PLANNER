---
date: 2026-11-01
author: Claude Code (for Joey)
branch: feature/TP-228-trip-open-polish
pr: pending
area: apps/web
contract-impact: none
---

# Trip open interaction, travel-mode picker and calendar polish (TP-228)

## What changed

- `WorkspaceView.tsx`: the top-bar Trip button opens and closes Trip through `viewTransition(..., "trip")`.
- `motion.css`: the `trip` transition names only `.workspace-shell`, so the top bar stays still while
  the workspace cross-fades.
- `trip-workspace.css`: timeline and map are two rounded cards with the chat map's gap; they rise in
  on open unless reduced motion is on.
- `glass.css`: Trip button hover, press, focus ring and a dark selected state while Trip is open.
- `timeline.css`: travel-mode select is a borderless pill with its own chevron, 44 px on coarse pointers.
- `trip-home-calendar.css`, `workspace-trips.css`: Week/Month switch matches the other segmented
  controls, trip picker is a pill, week columns shrink to 96 px so all seven days fit at 1440 px,
  events are opaque with a coloured leading edge.
- `docs/workspace-ui(.zh).md`: Trip button and card sentence.

## Why

Joey asked for the top-right Trip interaction, the square trip/map panels, the public transport picker
and the Week/Month calendar to look better before the Stage 2 demo.

## Validation

- `tsc --noEmit`, `eslint` (one existing warning elsewhere), `prettier --check`, `check-file-length`,
  `check-ui-copy.mjs`, `verify:e2e-selectors`, `verify:docs`, `verify:pairs`: pass.
- `trip-workspace-layout` E2E against `next dev` (mock data): all checks ok, 0 FAIL.
- Before/after Playwright screenshots at 1440 and 900 px, and the calendar Week/Month views.

## Notes for the next person

Phone has no top-bar Trip button; only the travel-mode picker and calendar changes reach phone.
