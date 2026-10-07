---
date: 2026-10-07
author: Claude Opus 5 (with A / @Lilstanie)
branch: feature/intra-city-in-getting-around
pr: none
area: apps/web
contract-impact: none
---

# Getting around now covers movement inside a city too

## What changed

- `apps/web/components/trip/ProposalDetails.tsx`: `dayConnections()` reads the day plan's `arriveBy`
  legs; the transport section interleaves them with its own items, ordered by arrival time; the day
  plan no longer draws connectors; `Connection` gained an optional `to`, because in Getting around
  the stop is not beside it.
- Same file: a section with no items but with legs is no longer reported as empty. A single-city trip
  produces exactly that.
- `TripPanel` derives the legs once and gives them to the transport section; `TripSection` forwards.
- `apps/web/lib/i18n/workspace-messages.ts`: `" to {v0}"`.
- Agent Note `2026-10-07-intra-city-legs-in-getting-around`; the `arriveBy` note's Consequences now
  say where the connector is drawn.
- `Connection.test.tsx` rewritten for the new home (5 cases) and a wiring case added to
  `ProposalDetails.test.tsx`.

## Why

Transport was split across two sections of the same plan, so "how do I get around on this trip?" had
two incomplete answers. The legs stay connectors rather than becoming transport items: an item with a
day and a time joins the cross-agent overlap check, and a squeezed gap would be reported twice, once
as the itinerary's geography conflict and once as a time overlap over the same minutes.

## Validation

`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm verify:docs`, `pnpm verify:protected` clean.
`pnpm test` 992/992.

**Not verified end to end in the browser.** The mock place provider returns one place per city, so
the fallback day plan schedules a single stop a day and no two stops exist to connect — a mock plan
has zero legs, in the old place or the new one. Live mode would exercise it but spends the shared
SerpApi allowance through the stay search, so it was not run. The rendering and the TripPanel wiring
are covered by the two component tests instead.

The empty-section bug was found by that wiring test, not by reading: with the transport section
carrying no items, Getting around said "No detailed items were returned" while legs existed.

## Notes for the next person

- Someone scanning the day plan no longer sees hop durations without opening Getting around. If that
  reads as a loss, the fix is a compact hint in the day plan, not moving the leg back.
- The transport summary still counts only the specialist's own items, so it can disagree with what
  Getting around lists for a single-city trip.
