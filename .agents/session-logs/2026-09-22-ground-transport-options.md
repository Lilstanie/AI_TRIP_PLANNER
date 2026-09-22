---
date: 2026-09-22
author: Claude Code (with A)
branch: feature/ground-transport-options
pr: none
area: packages/orchestrator, packages/agents, apps/web
contract-impact: none
---

# Wire the drive-vs-transit comparison through to the itinerary

## What changed

- `packages/orchestrator/src/progress-tools.ts` — forward `routeOptions`, and
  spread `tools.maps` so a future port method is not dropped again.
- `packages/agents/src/transport/index.ts` — gather options per ground hop and
  state the choice on the hop's item.
- `packages/agents/src/transport/legs.ts` — `legMode` keys on a leg's role, not
  its position.
- `packages/agents/src/transport/validation.ts` — accepted modes derived from
  `TravelMode` as a keyed record, so the contract cannot drift past it.
- `apps/web/components/map/TripMap.tsx` — advanced markers use `gmp-click`.

## Why

`routeOptions` shipped in #43 and nothing called it. The cause was not a
missing call site: `withProgressTools` rebuilt the `maps` port by listing its
methods, so `routeOptions` never reached the agent. The agent saw `undefined`,
took its "no comparison available" branch, and the feature looked merely
unused. Spreading the original first makes the whole class of loss impossible.

Two latent bugs surfaced while testing this live, both invisible to the tests
that existed:

`legMode` keyed on index 0 to mean "the arrival hop". A trip whose origin is
already its first destination has no arrival hop, so the first city hop
inherited index 0 and was priced as a flight — Sydney to Parramatta, 25km
apart, went to the airline search and came back unpriced.

`routeProblem` validated modes against a hardcoded list predating `drive`, so a
legitimate driving leg would have been rejected as invalid. It is now a
`Record<TravelMode, true>`, which fails the build rather than falling behind.

Costs are unchanged: only the scheduled leg reaches the budget. Alternatives are
quoted with their basis, because Google returns real AUD tolls but no Australian
transit fare, and an unqualified "$0 bus" beside a "$13.29 drive" reads as free
rather than unpriced.

## Validation

- `pnpm test` 534/534 (3 new); typecheck, lint, build, `verify:docs` and
  `verify:protected` clean
- Live, Sydney → Parramatta inside a six-day three-city trip:
  `Ways to make this hop: drive 31 min, from A$13.29; bus 76 min, fare not published`
- Before the `legMode` fix that same hop reported `Flight provider unavailable`

## Notes for the next person

`maps.route()` still reports every hop as generic `transit` priced at 0, which
is what raises the "fare unavailable" conflict; `routeOptions` now carries the
real modes and tolls beside it. Folding the scheduled cost onto that basis is
the next step, and it changes budget totals, so it wants its own change.
