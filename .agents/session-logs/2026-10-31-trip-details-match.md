---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-217-trip-details-match
pr: pending
area: packages/agents/src/itinerary, packages/agents/src/transport, apps/web/components/map
contract-impact: none
---

# Make plan notes, return flight, flight-day map and drive labels match the trip (TP-217)

## What changed

- Model itinerary drafts no longer contribute their own assumption lines; fallback drafts keep the
  code-written ones.
- The transport agent fetches the return leg of the chosen (and cheapest) round-trip fare with
  `searchReturnLeg`, so the return flight row has times.
- `TripMapCanvas` shows every trip stop when the focused day has none.
- A hop whose only route is an OSRM estimate gets `arriveBy.mode` `drive` instead of `transit`.

## Why

The live packed Tokyo check on `main` 7926bf5: the notes said days 3-5 were cut to 6 sights and day 6
had no activities (both false), the return flight had no time, the flight-day map was empty, and
OSRM legs read "Public transport".

## Validation

- `vitest run` in `packages/agents` (207), `packages/tools` (173), `packages/orchestrator` (422);
  `apps/web` map and trip tests (71); `tsc --noEmit` in agents and web; eslint on changed files.

## Limitations

- The return day is still planned to the evening; stops are not yet cut before the return flight.
- Each planning run with a SerpApi round trip makes one or two extra return-leg requests.
