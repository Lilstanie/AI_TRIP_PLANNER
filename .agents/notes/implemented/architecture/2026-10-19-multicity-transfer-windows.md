# Agent Note: Timed activity windows on multi-city transfer days

Status: implemented
Owner: A (@Lilstanie)

## Problem

A multi-city itinerary could place an activity in the departure city after the transfer, or in the
arrival city before it, because validation checked only the day and city. Untimed activities also
could not be ordered safely around a transfer.

## Decision

Activities on a day with a scheduled inter-city transfer must have start and end times. An activity in
the departure city must end no later than the transfer departure; an activity in the arrival city
must start no earlier than the transfer arrival. The activity must belong to exactly one of those
cities, and invalid or overlapping times make the itinerary inconsistent. Existing overnight-city
rules still determine which city is valid at the end of the day.

The itinerary validator builds each day's transfer windows once and orders them by departure time.
Both city validation and fallback scheduling consume those same windows.

## Alternatives considered

- **Validate only the city and calendar day.** Rejected because it allows activities to overlap a
  transfer or occur after leaving their city.
- **Allow untimed activities and infer their order.** Rejected because no evidence establishes whether
  an untimed stop happens before or after the transfer.

## Consequences

The itinerary specialist may reject a draft that lacks enough transfer or activity times to establish
the order. The `itinerary-by-city` Agent Lab check verifies these transfer windows. The change does
not alter the shared plan contract.

## Sources

- [Issue #437](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/437)
- [Itinerary specialist](../../../../packages/agents/src/itinerary/index.ts)
- [Architecture](../../../../docs/architecture.md)
- [Multi-city evaluator test](../../../../packages/orchestrator/tests/agent-lab-evaluate.test.ts)
