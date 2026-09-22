---
date: 2026-09-22
author: Claude Code (with A)
branch: feature/city-connections
pr: 56
area: apps/web, packages/agents
contract-impact: none
---

# Quick prompts that exercise each travel shape, and the day plan they exposed

## What changed

- `apps/web/lib/planning/quick-prompts.ts` — four examples, one per travel
  shape: a single city, one city to another, hops too far to travel on the
  ground, and hops close enough to stay on it.
- `packages/agents/src/transport/legs.ts` — `cityForDay`, and `cities` moved
  here from `transport/index.ts` so the itinerary can share both.
- `packages/agents/src/itinerary/index.ts` — searches places per city and
  draws each day's stops from the city that day is spent in.

## Why

The old examples all stated a destination and nothing else, so nothing in the
blank chat exercised an origin, a flown city hop, or a ground one. A change
that broke any of those was invisible until someone typed a prompt by hand.

Writing examples that do exercise them surfaced a real defect. Places were
searched once for the whole `"Sydney & Wollongong"` string, and the day plan
cycled through the mixed result, so day 3 held a Wollongong lookout at 09:30
and the Sydney CBD at 14:00 — two hours apart, reported as a conflict. One stop
a day had hidden it; two stops made it visible. Days now follow the same
day-to-city split the journey legs use, so the two plans describe one trip.

`Tokyo & Kyoto` was the first candidate for the ground-hop example and cannot
serve: Google Routes returns `{}` for that pair by transit, since intercity
rail is outside its coverage there. `Sydney & Wollongong` is 95 minutes by
HEAVY_RAIL and answers properly.

## Validation

- `pnpm test` 556/556 (3 new); typecheck, lint, build, `verify:docs`,
  `verify:protected` clean
- Each example run live: Sydney alone gave three local connections
  (`train M1`, transit); Melbourne → Sydney added a A$808 flight;
  Melbourne → Sydney & Brisbane gave A$768 and A$340 with no conflicts;
  Sydney & Wollongong stayed on the ground with Sydney on days 1–2 and
  Wollongong on days 3–5

## Notes for the next person

Google occasionally returns no transit route between two central Sydney places
(`Observatory → Customs House`), which still reads as a geography conflict. It
is an address-resolution miss, not a planning error, and is worth separating
from a real one.
