# Agent Note: long inter-city ground hops are flown when a fare exists

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The live re-run on 2026-11-02 planned Bangkok to Chiang Mai as a ten-hour coach that took the
whole of day 6, although flights take about an hour. Only the closing hop back to the first city
(see `2026-11-02-closing-journey-leg.md`) and hops that did not fit in a planning day were flown.

## Decision

- Any inter-city ground hop over six hours whose mode the traveller has not chosen is priced as a
  flight. When a fare comes back the hop is flown; when none does, the ground route stays and the
  flight search leaves no conflict behind.
- Hops that do not fit in a planning day are still flown even without a fare, as before.
- A mode the traveller chose (`legModes`) is never overridden.

## Alternatives considered

**Show both and let the traveller pick.** The plan needs one priced leg for totals and day
planning; the alternatives line already lists other modes.

## Consequences

- One extra flight search per long hop; trips such as Bangkok to Chiang Mai or Hanoi to Ho Chi Minh
  City gain a day of activities.
