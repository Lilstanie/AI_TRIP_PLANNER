---
date: 2026-09-22
author: Claude Code (with A)
branch: feature/flight-search
pr: none
area: packages/tools, packages/orchestrator, packages/shared, apps/web
contract-impact: packages/shared
---

# Flights people can actually search for, and ground transport to compare

## What changed

- `packages/tools/src/airports.ts` (new) — ~110 cities, up from four.
- `packages/orchestrator/src/dates.ts` (new) — ISO, month names, and numeric
  dates with disambiguation.
- `flight-query.ts` / `flight-answer.ts` (new) — recognise a fare question and
  answer it from one provider, skipping the five specialists.
- `apps/web/components/chat/FlightResults.tsx` (new) — fares as a chat card.
- `packages/tools/src/route-options.ts` (new) + `maps.routeOptions()` — driving
  and public transport for one hop, as alternatives.

## Why

Flight search covered sydney, tokyo, kyoto and paris, so Melbourne or Seoul
threw before reaching the provider. Dates were ISO-only, so "2 Nov 2026" was
invisible and the trip planned without dates.

Numeric dates are the careful part: 11/02/2026 is 2 November to an American and
11 February to an Australian, and this product has both. Where a component
settles it the date is read; where nothing does, it reports ambiguity and the
assistant asks. Guessing moves a trip by months and prices the wrong flights,
silently.

A fare question was being answered by planning a whole trip — a group size, a
budget, and five model calls to bury one number. Recognition is conservative:
an explicit planning verb always wins, because mistaking a planning request for
a lookup skips everything actually asked for.

Ground transport returned one TRANSIT leg, always `mode: "transit"`, always
`price: 0`. Google gives more: the vehicle and line ("bus 333"), and real road
tolls in AUD. It does *not* give Australian transit fares — `transitFare` comes
back empty — so every option carries a `priceBasis` saying how much of its cost
is known. A $0 bus and a $0 toll-free drive mean different things, and
flattening them would make public transport win every budget comparison.

`RouteOption` is separate from `RouteLeg` because callers sum `RouteLeg[]`
durations and advance a clock through them; alternatives in that shape would
read as one very long journey.

## Validation

- `pnpm test` 521/521 (30 new); typecheck, lint, build clean
- Live: Sydney → Seoul returned 9 fares, cheapest Jetstar A$367; "cheapest
  flight from Sydney to Tokyo on 25 Nov 2026" returned 11 fares through the
  chat with no specialist run
- Live: Parramatta → Sydney CBD returned `drive 29min A$13.29 [partial]` and
  `bus 74min A$0 [unavailable] via bus 52`

## Notes for the next person

**`routeOptions()` is reachable on `ctx.tools.maps` but no agent calls it yet** —
the same shape of gap as `transport.origin`, so it is worth wiring into the
transport proposal before assuming it is live.

Two web tests were already failing on `main` from a 5s timeout during parallel
runs, not from behaviour; the timeouts are raised and the suite now passes
twice in a row. `maps.route()` still reports every hop as generic `transit`.
