---
date: 2026-09-22
author: Claude Code (with A)
branch: feature/flight-itinerary-cards
pr: none
area: packages/shared, packages/tools, packages/orchestrator, apps/web
contract-impact: packages/shared
---

# Show the flights behind a fare, both ways

## What changed

- `packages/shared/src/contracts.ts` — `FlightSegment`, `FlightLayover`,
  `FlightLeg`; `outbound`/`inbound`/`roundTrip` on flight shapes
  ([note](../notes/implemented/architecture/2026-09-22-flight-itineraries.md)).
- `packages/tools/src/flight-itinerary.ts` (new) — parses Google Flights'
  shape, tested against a recorded live response.
- `serpapi.ts` / `booking.ts` — `searchReturnLeg` via `departure_token`.
- `flight-answer.ts` — fetches returns for the two itineraries shown in full.
- `apps/web/components/chat/FlightItineraryCard.tsx` (new) + styles.
- `progress-tools.ts` — the booking wrapper now spreads its port.

## Why

A fare was a carrier and a price, which ranks fares and says nothing a
traveller can check against a calendar. The provider already returns airports,
local times, flight numbers, aircraft and layovers; the parser was discarding
all of it.

Round trips need two searches: the first returns outbound options carrying the
whole round-trip price, and the ways home are a second search per itinerary.
Fetching every one would spend the monthly allowance on fares nobody scrolls
to, so returns are fetched for the two shown in full. A round-trip fare with no
`inbound` says "return flights not looked up" rather than reading as one way.

The booking wrapper had the same defect the maps wrapper had in #53 — it
rebuilt the port by listing its methods, so `searchReturnLeg` would have been
dropped before any agent saw it. Fixed the same way, before it could bite.

## Validation

- `pnpm test` 546/546 (9 new); typecheck, lint, build, `verify:docs`,
  `verify:protected` clean
- Live SYD ⇄ Tokyo: Air Niugini A$1055 with
  `OUT SYD→POM PX 2 07:20, POM→NRT PX 54` and
  `IN NRT→POM PX 55 21:40, POM→SYD PX 1`
- In the browser: three cards, five legs, `+1` on the arrival that lands a day
  later, horizontal scroll inside the card row and not on the page

## Notes for the next person

Mock fares have no segments, so mock mode falls back to the fare list — that is
the designed behaviour, not a missing card. `ITINERARIES_SHOWN_IN_FULL` is the
one number that trades allowance for completeness.
