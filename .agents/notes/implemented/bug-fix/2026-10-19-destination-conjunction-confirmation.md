# Agent Note: Confirm ambiguous destination conjunctions

Status: implemented

## Problem

Splitting every `and` corrupts complete place names such as Trinidad and Tobago. Offline extraction
cannot reliably distinguish those names from multiple cities.

## Decision

Offline extraction normalises explicit `&` and `、` separators. A newly extracted name containing
`and` uses the existing question flow to offer the complete name or explicitly separated stops.
The answer retains collected fields, and an existing plan remains available during clarification.
A destination already present in structured known fields is accepted when the answer repeats it.
Model extraction supplies the cities directly; its result is not split again by a string heuristic.

The [journey legs decision](../feature/2026-09-22-journey-legs-and-trip-origin.md) still owns visit
order and leg construction. This note changes only how ambiguous offline text reaches that form.

## Alternatives considered

**Split every conjunction.** Rejected because it turns one place name into an invented journey.

**Keep every conjunction unchanged.** Rejected because genuine multi-city requests would silently
become one destination instead of asking the traveller.

## Consequences

Ambiguous offline requests need one confirmation. Explicit separators need none. No place-name
allowlist or additional persistent confirmation state is maintained.

## Sources

- [Issue #445](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/445)
- [API destination representation](../../../../docs/api.md)
