---
date: 2026-09-22
author: Claude Code (with A)
branch: feature/city-connections
pr: none
area: packages/shared, packages/agents, apps/web
contract-impact: packages/shared
---

# Say how the traveller gets between the day's stops

## What changed

- `packages/shared/src/contracts.ts` — `ArriveBy` on `ProposalItem`;
  `TravelMode` moved here from `ports.ts`, which re-exports it
  ([note](../notes/implemented/architecture/2026-09-22-arrive-by-connections.md)).
- `packages/agents/src/itinerary/index.ts` — keeps the route it was already
  looking up, and schedules two stops a day where places allow.
- `apps/web/components/trip/ProposalDetails.tsx` — renders the connection as a
  connector above the stop it arrives at.

## Why

The planner looked up travel time between consecutive activities to check the
day fits, then discarded the answer and kept only a conflict when it did not.
The reader saw two activities and a silent gap.

Nothing appeared at first, because the fallback day plan schedules one activity
per day and a single stop has nothing to connect to. Google returns about ten
grounded places for Sydney and three days used three of them, so the plan now
takes a morning and an afternoon stop where there are places for both. The
single-stop layout is untouched, including its 13:00 anchor, so a destination
with thin evidence behaves exactly as before.

`route()` reports every hop as a generic `transit`, so the mode and service
come from `routeOptions` where the adapter offers it.

## Validation

- `pnpm test` 552/552 (6 new); typecheck, lint, build, `verify:docs`,
  `verify:protected` clean
- Live, three days in Sydney: `Sydney Tower Eye → SEA LIFE` transit 14 min,
  `Observatory → Harbour Bridge` transit 4 min, `Darling Harbour → …` **tram
  L2** 15 min, with the day's A$60 split across its two stops

## Notes for the next person

A test caught the budget doubling when two stops each took the whole day's cap;
the cap is per day and is now divided. `describeHop` parses the service out of
the option note — if `transitOption`'s wording changes, that regex goes with it.
