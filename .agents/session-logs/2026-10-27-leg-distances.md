---
date: 2026-10-27
author: Claude Code
branch: feature/TP-123-leg-distances
pr: none
area: apps/web, docs
contract-impact: none
---

# Show distance and Directions on each Leg, with a Show distances switch

## What changed

- `lib/trip/leg-distance.ts`: distance format and Directions URL; `Connection.distance` in `lib/trip/timeline.ts`.
- `LegRow` shows the distance and a Directions link; `TripEditor` has the Show distances switch (`useShowDistances`, local storage).
- `BookingRow` shows Book on a stay whose selected candidate has a `detailsUrl`.
- Chinese strings in `lib/i18n/workspace-messages.ts`; `docs/workspace-ui.md` and `.zh.md`.
- `tests/e2e/leg-distances.failures.md` and `leg-distances.e2e.mjs`.

## Why

Spec #743, ticket #745. Distance comes from the existing `RouteResult.distanceMeters`, so no shared type changed.

## Validation

- `pnpm --filter @trip/web e2e leg-distances --prod`: all checks passed (desktop and phone, English and Chinese, storage unreadable and unwritable).
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint` (warnings only, none in changed files), `check-ui-copy.mjs`.

## Notes for the next person

- Activity stops carry no booking link in `ProposalItem`, so Book appears only on stays. Adding a link to stops is a `packages/shared` change.
- Mock-mode simulated routes carry no distance, so mock data shows no distances.
