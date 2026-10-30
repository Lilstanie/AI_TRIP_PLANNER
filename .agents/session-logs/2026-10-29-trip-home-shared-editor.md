---
date: 2026-10-29
author: Codex
branch: feature/TP-154-shared-trip-editor
pr: 782
area: apps/web, docs
contract-impact: none
---

# Share one editable Trip view between home and conversation

## What changed

- `WorkspaceView`, `TripHomeActionDrawer` and `useWorkspace` now route Trip-home Itinerary and the
  conversation Trip through the same latest Plan, pending edit, day selection and Undo state.
- `TripEditor` exposes its state-driven view for the home entry, while `usePlanRevision` compares
  Plan values so equivalent state objects do not become stale.
- `DayStrip` counts fixed itinerary rows and labels booking-only days as booked.
- Added the public fixture journey and failure inventory in
  `trip-home-shared-editor.e2e.mjs` and `trip-home-shared-editor.failure-inventory.md`.
- Updated the Trip home decision and English/Chinese UI documentation.

## Why

The existing home action was a second read-only itinerary. Sharing the existing editor and state
keeps activities, flights, stays, previews and Undo aligned without adding another Plan model.

Retained earlier failures at
`output/playwright/trip-home-shared-editor/t6-test-fixes/summary.json`; the final passing run is
`output/playwright/trip-home-shared-editor/t6-precommit-eebd2171/summary.json`.

## Validation

- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed with existing hook warnings.
- `pnpm --filter @trip/web test` — 57 files and 635 tests passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`,
  `pnpm verify:e2e-selectors`, and `pnpm verify:e2e-artifacts` — passed.
- `pnpm --filter @trip/web e2e trip-home-shared-editor --prod` with blank provider/Clerk credentials,
  mock data, mock tools and label `t6-precommit-eebd2171` — 23 assertions passed in 35 seconds.

## Notes for the next person

The evidence uses simulated maps and local provider fixtures. Live providers, physical devices and
the real failure inventory artifacts are separate verification classes. `format:check-changed
origin/main` reports two pre-existing parent-owned files; every file changed by this implementation
is formatted. Raw E2E currently lists this journey as unsupported by the isolated local CLI, so the
command above is the legacy fixture runner with the explicit credential boundary.
