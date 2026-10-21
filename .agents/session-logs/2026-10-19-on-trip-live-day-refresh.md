---
date: 2026-10-19
author: Codex
branch: fix/restore-trip-day-view
pr: 450
area: apps/web, docs
contract-impact: none
---

# Keep Today current while a trip remains open

## What changed

- `TripEditor.tsx` refreshes the destination-local date each minute and on window focus or document visibility changes.
- A prior-day manual selection yields to the current Today; same-day selections still restore per trip.
- `on-trip-day.e2e.mjs` covers midnight rollover, focus, visibility, reload restoration, and date boundaries.
- English and Chinese workspace UI docs describe the refreshed Today behavior.

## Why

- A Trip view left open across destination-local midnight previously retained yesterday's Today marker until reloaded.

## Validation

- `DATA_MODE=mock CHANNEL=chrome pnpm --filter @trip/web e2e on-trip-day` — passed; runner `output/e2e/runner/2026-10-18T18-18-05-891Z.json`.
- `pnpm --filter @trip/web test` — 57 files, 632 tests passed; existing jsdom canvas warnings were logged.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, changed-file Prettier, and `git diff --check` — passed.
- Earlier E2E attempts reproduced the stale Today behavior, then exposed test-clock setup and an ineffective visibility assertion; the final run verifies each refresh path independently.

## Notes for the next person

- GitHub CI for the updated PR head has not run yet.
