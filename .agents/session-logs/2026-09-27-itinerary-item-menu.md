---
date: 2026-09-27
author: Claude Code
branch: feature/itinerary-item-menu
pr: none
area: packages/shared, apps/web, docs
contract-impact: packages/shared
---

# Itinerary tab with a per-item action menu and Ideas

## What changed

- `packages/shared/src/contracts.ts`: optional `note` and `booked` on `ProposalItem`.
- `apps/web/lib/trip/item-actions.ts`: details, note, booked, remove, ideas and day moves as pure
  plan transforms. `trip-edit.ts` routes only scheduled activities and keeps ideas.
- `components/ui/ActionMenu.tsx` (new); `TripPlaceList` gains the menu, inline editors, Undo, the
  Ideas group, Booked and note display, day-labelled menu names; `TripPanel` tab is Itinerary.
- `tests/e2e/itinerary.e2e.mjs` (new); component tests follow the new labels. Docs in English and
  Chinese; Agent Note `2026-09-27-itinerary-item-actions.md`.

## Why

The owner's review list: Overview becomes Itinerary, and each item is editable like Mindtrip's menu.

## Validation

- Full `pnpm test` passes; typecheck and lint clean.
- `itinerary.e2e.mjs`: 36 checks pass at 1440 and 390 px (every action, undo, Escape and focus,
  adjust schedule opening the Timeline, no console errors).

## Notes for the next person

Unmapped rows now show the description too; mock stops share one name, so menu labels include the
day and time.
