---
date: 2026-10-28
author: Claude
branch: feature/TP-141-home-cards
pr: none
area: apps/web
contract-impact: none
---

# Trip home entry cards: Itinerary, Calendar, Preferences (#768, spec #765)

## What changed

- New `TripHomeCards` (`components/workspace/TripHomeCards.tsx`), passed to `TripHome` as its child in `WorkspaceView`: Itinerary with the scheduled stop count, Calendar, Preferences with the count of preferences on the trip's draft. Counts of zero are left out.
- Itinerary and Preferences call `selectTrip`, which loads the trip's own snapshot, then open the Trip panel or the Preferences panel. Calendar opens the Trips page on the Calendar tab at the month the trip starts (`focusTripId` on `TripsPage`).
- Chinese strings "Trip sections" and "{count} preference(s)"; card styles in `workspace-trips.css`; `docs/workspace-ui.md` and `.zh.md`; the Trip home Agent Note.
- E2E `trip-home-cards` with `trip-home-cards.failures.md` written first.

## Why

The shell had no way into the itinerary, calendar or preferences. The cards read the trip record so the count matches what `selectTrip` opens.

## Validation

- `pnpm --filter @trip/web e2e trip-home-cards --prod`: all checks pass (1440, 768, 600, 390 px, Chinese).
- `pnpm lint`, `pnpm --filter @trip/web typecheck`, `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `check-ui-copy`: pass.

## Notes for the next person

- A phone never reaches the Trip home, so the cards are not shown there until the phone ticket.
- Opening a chat row whose snapshot is older than its trip's, then saving, overwrites the trip's snapshot with the chat's (the E2E records it as an observation). The cards avoid it by loading the trip snapshot; the cause is in the save path and is not fixed here.
- A trip without a plan cannot be stored, so the no-cards state is a defensive guard only.
