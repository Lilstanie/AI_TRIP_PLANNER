# Agent Note: the journey closes on the last day

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A live test on the deployed site (2026-11-02) planned two trips that could not be travelled.

1. Perth to Bangkok and Chiang Mai, 10 days: the round-trip flight returned from Bangkok at 21:30
   on day 10, but the traveller spent that day in Chiang Mai until 17:30 and no leg took them back
   to Bangkok. `journeyLegs` only built the arrival flight and the forward hops between cities; the
   return flight was assumed to leave from wherever the trip ended.
2. Sydney to Melbourne for a weekend, driving: only the drive there was planned. The ground arrival
   had no matching leg home, so day 2 ended with dinner in Melbourne and nine hours of driving
   were missing from the plan and its cost.

## Decision

- `journeyLegs` adds a closing leg on the last day. After a flown arrival into a multi-city trip
  that ends elsewhere, it is a hop from the last city back to the first (`closing: "to-first-city"`),
  planned like any inter-city hop. After a ground arrival it is a leg from the last city to the
  origin by the same mode (`closing: "home"`).
- A ground closing hop to the first city over six hours is flown, because the traveller still has
  to reach the return flight; the transport model is told to arrive three hours before it.
- The itinerary reads a transport item from a destination city to a place outside the trip as a
  transfer home, so stops that day end before the leg leaves.
- Accommodation ignores a closing hop back to the first city when it splits nights.

## Alternatives considered

**Search open-jaw flights (fly home from the last city).** Often the better trip, but SerpApi
multi-city searches cost one call per leg combination and change the flight card and selection
model; kept for later.

**Warn instead of planning the leg.** The plan would still be untravellable, and the cost would
still be missing.

## Consequences

- Multi-city trips gain one priced leg; Tokyo and Kyoto fixtures cost about AUD 60 more.
- Kyoto and Osaka style trips whose airport is nearer the last city still return to the first city
  for the round-trip flight.
