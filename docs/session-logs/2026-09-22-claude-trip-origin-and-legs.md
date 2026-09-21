---
date: 2026-09-22
author: Claude Code (with A)
branch: feature/trip-origin
pr: none
area: packages/shared, packages/orchestrator, packages/agents, apps/web
contract-impact: packages/shared
---

# State where a trip departs from, and make the journey a list of legs

## What changed

- `TripBrief.origin` (optional) plus a Preferences field, chat extraction and
  `PartialTripBrief`/`BriefPatch` support.
- `packages/agents/src/transport/legs.ts` (new) — `journeyLegs()` builds every
  hop in travel order; `legMode()` decides flight vs ground.
- `transport/index.ts` derives its flight query *and* its route queries from
  that one list instead of re-deriving the itinerary in four places.
- Offline extractor learns "a trip from A to B" and "departing X".

## Why

Transport read its origin from a long-term preference `transport.origin` that
nothing ever wrote — no form field, no extraction path — so every trip departed
from the hardcoded `"Sydney"`. A Sydney trip then compared equal to its own
origin and skipped flight pricing entirely.

The journey itself was implicit: one hardcoded flight query for
`origin → destinations[0]`, a separately derived list of inter-city route
queries, and two more places that rebuilt `origin → destinations[0]` to label
the result. A→B→C→D would have meant editing all four. One ordered leg list
makes that a change to `legMode()` instead.

Behaviour is deliberately unchanged: only the first hop flies today. The 97
existing agent tests pass untouched, which is the evidence for that claim.

## Validation

- `pnpm test` 488/488 (11 new); typecheck, lint, build clean
- In the browser, a Melbourne → Sydney brief produced
  `1 transport option(s) for Melbourne ↔ Sydney · known estimate AUD 1680.00`,
  where every trip previously departed Sydney

## Notes for the next person

`TransportEvidence.flights` and `TransportPlan.flight` are still singular — the
remaining single-flight assumption, now confined to those two names. Turning on
B→C flights means changing `legMode()` and mapping the search over
`flightLegs(legs)`; the list it maps over already exists. Each flown leg costs
one SerpApi search against the shared monthly allowance.
