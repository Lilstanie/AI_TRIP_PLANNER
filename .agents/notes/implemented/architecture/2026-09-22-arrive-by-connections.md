# Agent Note: an itinerary item carries the journey into it

Status: implemented
Owner: A (@Lilstanie)

## Problem

The itinerary planner already looked up the route between consecutive activities — it needed the
travel time to tell whether a day fits. It then threw the answer away and kept only a conflict when
the day did not fit. A traveller reading the plan saw "Opera House 09:30–12:00, Bondi 14:00–16:30"
with no indication of how to get between them, how long it takes, or that a bus exists. The data was
fetched, used once for arithmetic, and discarded.

## Decision

`ProposalItem.arriveBy?: ArriveBy` describes the connection **into** an item from the previous one
on the same day: mode, duration, the service designation when the provider named one, and where it
started. The itinerary planner fills it from the lookup it was already making, using `routeOptions`
for the real mode and line where the adapter offers it.

`TravelMode` moves from `ports.ts` to `contracts.ts` — a proposal item names one, and contracts
cannot import ports. `ports.ts` re-exports it, so the public name is unchanged.

## Alternatives considered

**A transport item between the activities.** It renders through the existing card path with no
contract change, but a journey is a line between two places, not a third place: every hop would
become a card, and the day's actual plan would be half travel cards. It would also land in the
itinerary section's item list, where anything with an `estCost` reaches the budget.

**Leave it to the UI to re-derive.** The browser would have to re-request every hop the planner had
already looked up, doubling provider calls to recompute a number the server already had.

## Consequences

- `arriveBy` is optional: absent means the planner could not connect the two, and the UI shows
  nothing rather than guessing a mode.
- The first activity of a day never carries one — there is nothing to travel from.
- The fallback day plan now schedules two stops a day where there are grounded places for both, so
  there is something to connect. The day's activity allowance is split across its stops rather than
  spent on each, so a second stop does not double the itinerary budget.
