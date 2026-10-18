# Agent Note: Multi-city transfer-day consistency

Status: implemented
Owner: A (@Lilstanie)

## Problem

An itinerary could place activities after leaving a city, before arriving in another city, or in a
city that did not match the planned overnight stay. Accommodation could also search a city where the
trip had no overnight nights.

## Decision

Build each day's transfer windows from the scheduled transport. Transfer-day activities require
usable start and end times; activities must fit before departure or after arrival, and the final city
reached that day must match the scheduled overnight stay. Omit cities with zero nights from hotel
search. If there is no transport proposal, use scheduled stays to anchor the city. Once a transfer
has established a city, a later stay in a different city without a connecting transfer leaves the
location unresolved. If an overnight city conflicts with the transfer sequence, omit activities for
that day and report a geography conflict.

## Alternatives considered

- **Validate only the activity's city and day.** Rejected because it allows impossible travel timing
  and overnight locations.
- **Assume ordering for untimed transfers.** Rejected because no evidence establishes whether an
  activity happens before or after the transfer.

## Consequences

The itinerary specialist may reject a draft when transfer order cannot be established. Stay segments
can anchor the city when no transport route has been recorded; after a route is established, a stay
cannot imply an unrecorded transfer. The change does not alter the shared plan contract.

## Sources

- [Issue #437](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/437)
- [Itinerary specialist](../../../../packages/agents/src/itinerary/index.ts)
- [Architecture](../../../../docs/architecture.md)
