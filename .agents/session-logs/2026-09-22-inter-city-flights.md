---
date: 2026-09-22
author: Claude Code (with A)
branch: feature/inter-city-flights
pr: none
area: packages/agents
contract-impact: none
---

# Fly a city hop the ground journey cannot fit into one day

## What changed

- `transport/validation.ts` — `fitsInPlanningDay` and `hopDuration` extracted,
  with the day length and departure hours as named constants.
- `transport/index.ts` — ground evidence is gathered first, a hop whose
  scheduled journey cannot fit one planning day is promoted to a flight and
  priced; `TransportEvidence.flights` and `TransportPlan.flights` are now one
  entry per flown hop.
- `transport/legs.ts` — `legMode` accepts a `ModePreference` that overrides the
  planner's choice.
- The model selects one fare per flown hop (`flightIds`), not one overall.

## Why

Only the arrival was ever flown, so every later hop went to ground routing
whatever the distance. Google answers those: Sydney → Brisbane is 15h by
public transport, Brisbane → Adelaide is 46h. The scheduler then rejected them
for not fitting a planning day, and the traveller got conflicts where flights
belonged — two of three hops with no transport at all.

The promotion rule is the scheduler's own `fitsInPlanningDay`, not a distance
threshold. A threshold would be invented and could disagree with the
constraint that actually rejects a hop; sharing the rule makes the two
impossible to contradict. Tokyo → Kyoto (2h) stays ground, as does
Sydney → Parramatta (70min).

A non-finite duration is excluded: that is a broken route, which `routeProblem`
already reports, and promoting on `NaN` would turn bad provider data into a
purchase.

`ModePreference` is unused for now. It exists so "train, not a flight" becomes
a value threaded through the existing decision rather than a second code path
added beside it later.

## Validation

- `pnpm test` 534/534; typecheck, lint, build, `verify:docs`,
  `verify:protected` all clean
- Live, Melbourne → Sydney & Brisbane & Adelaide over nine days, no conflicts:
  Jetstar A$808 return, Jetstar A$372 one way, Virgin Australia A$836 one way,
  `source: live`
- Live, Sydney & Parramatta: still `transit 70 minutes` with
  `drive 31 min, from A$13.29` offered beside it

## Notes for the next person

Each promoted hop costs one SerpApi search, so a four-city trip now spends
three. Nothing sets `ModePreference` yet: wiring it to a per-hop control in the
UI is the next step for letting a traveller choose the train over the flight.
