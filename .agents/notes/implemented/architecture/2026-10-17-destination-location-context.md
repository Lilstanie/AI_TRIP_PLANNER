# Agent Note: Selected destination coordinates are scoped to their place name

Status: implemented

## Problem

Planning dates near midnight can fall on different calendar days in UTC and at the destination. A selected place also provides coordinates that can become stale if a later chat changes the destination.

## Decision

The chat request may include a destination name with latitude and longitude from a selected place suggestion. The server uses those coordinates only when the normalized selected-place name matches the brief destination, then resolves the destination's local calendar date with the offline timezone lookup. Requests without matching coordinates use UTC. Existing plans remain editable regardless of whether their dates are historical.

## Alternatives considered

- Reuse coordinates without checking the place name: rejected because a destination edit could inherit the previous place's timezone.
- Call a remote timezone provider: rejected because date validation should work without provider credentials or network access.
- Require coordinates for every request: rejected because existing clients and manually entered destinations may not have a selected place.

## Consequences

Selected destinations receive locally correct past-date clarification while the lookup stays offline. Manual or unmatched destinations retain the UTC fallback, so their local date can differ near midnight.

## Sources

- [API contract](../../../../docs/api.md)
- [API 合约](../../../../docs/api.zh.md)
- [Session log](../../../session-logs/2026-10-17-triage-implement-spec.md)
