---
date: 2026-10-08
author: Claude Code (Haiku 5.5)
branch: feature/day-view-specialists-239
pr: none
area: apps/web, docs
contract-impact: none
---

# Move specialist content into the one day view (#239, part of #233)

## What changed

- Stopped rendering the five specialist cards; `TripSection.tsx` and `ProposalDetails.tsx` and their two
  component tests are removed. Plan sections stay in the data.
- `lib/trip/timeline.ts` derives booking rows: one stay row per night, flight in on day 1, flight out on the
  last day, inter-city flights on their day. `components/trip/timeline/BookingRow.tsx` opens each to its card
  with Alternatives, using the existing `choose` edit.
- `components/trip/TripTips.tsx` puts the destination guide at the top of the day view, expanded by default,
  remembered folded per trip in `localStorage` (try/catch).
- Dining picks show under Ideas as suggestions (`lib/trip/restaurants.ts`). Scheduling copies one into the
  itinerary through `lib/trip/item-actions.ts`, so Undo restores it. `identifyActivities` gives dining `meal`
  items ids.
- Agent Note proposed: `.agents/notes/proposed/feature/2026-10-08-day-view-specialists.md`.

## Why

The day view already shows stops, legs and check-in, so the specialist cards repeated the same facts. The
stay and fare choices, and the guide and restaurants, were out of reach from the day. The note records the
failure modes and the alternatives that were rejected.

## Validation

Run in `/home/claude/AI_TRIP_PLANNER/.claude/worktrees/agent-a9eb0de1485a5bb0e`:

- `cd apps/web && npx tsc --noEmit`: exit 0
- `pnpm --filter @trip/web lint`: exit 0 (no ESLint warnings or errors)
- `pnpm --filter @trip/web test`: exit 0, 50 files, 582 tests passed
- `node scripts/verify-docs.mjs`: exit 0
- `node scripts/verify-protected-files.mjs origin/main`: exit 0
- `pnpm exec prettier --check` on every changed and new file: exit 0
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: exit 0, 24 pairs (re-recorded after Prettier)
- `DATA_MODE=mock pnpm --filter @trip/web e2e itinerary timeline workspace-chinese choose-fare-and-stay`:
  exit 0. Checks passed: itinerary 117, timeline 47, workspace-chinese 39, choose-fare-and-stay 28
  (14 at 1440 px, 14 at 390 px). Timeline skipped 1 check: the route check needs a map key, and the place
  search answered 503/502. Runner output: `output/e2e/runner/2026-10-08T18-25-07-452Z.json`.

## Notes for the next person

- Flight out sits on the last day of the strip (the day before the return date). Confirm before moving it.
- Restaurants scheduled from Ideas have no price and show "Price unknown".
- The meal-budget envelope and the "Important notes" assumptions are no longer shown; they stay in the data.
- Phone reload persistence of the tips fold is not covered by E2E (desktop only).
- The route check E2E is skipped without a map key.
- The Agent Note stays in `proposed/`; it needs review before it moves to `implemented/`.
