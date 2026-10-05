---
date: 2026-10-05
author: Claude Code (Opus 5.5)
branch: feature/phone-shell-stop-menu
pr: none
area: apps/web, docs
contract-impact: none
---

# Stop menu gains Move earlier / Move later within a day; 44 px phone targets (#176)

## What changed

- `apps/web/lib/trip/item-actions.ts`: new `move` action swaps a stop with its neighbour on the
  same day (start time, then plan order), keeping durations; refuses a swap that ends past 23:59.
- `apps/web/components/trip/TripPlaceList.tsx`: menu offers Move earlier (not on a day's first
  stop) and Move later (not on its last); ideas get neither. Undo and `editVersion` as before.
- `apps/web/app/styles/trip.css`: at `max-width: 520px` the menu trigger and items are 44 px.
- `apps/web/lib/i18n/workspace-messages.ts`: reuses the Timeline's "Move earlier" / "Move later"
  keys; adds the two Undo messages and the refusal message in Chinese.
- `apps/web/tests/e2e/itinerary.e2e.mjs`, the itinerary item actions Agent Note (failure inventory
  written before the code), `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`.

## Why

Each stop takes the other's start time instead of packing them back to back, so a gap before the
later slot survives the swap. The second stop starts later only if the first would overlap it.

## Validation

- `pnpm --filter @trip/web typecheck`, `lint`: pass. `pnpm --filter @trip/web test`: 454 passed.
- `node apps/web/tests/e2e/itinerary.e2e.mjs` against a mock-mode dev server on port 3100
  (`BASE_URL=http://localhost:3100`): every check passes at desktop and phone, including the swap,
  Undo, the absent items, the 23:59 refusal and the 44 px sizes. The only failure is "no console
  errors": `/api/places/search` returns 502 because this container has no Google Maps key.
- `pnpm verify:docs`, `pnpm verify:pairs` (after recording `docs/workspace-ui.md`) and
  `pnpm verify:protected`: pass. `prettier --check` passes on every changed file except
  `itinerary.e2e.mjs`, which already failed it on `origin/main` (long one-line checks).

## Notes for the next person

A swap can leave the pair overlapping the next stop; the Timeline's checks report it.
