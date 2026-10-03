# Agent Note: One shared limit for nine travellers and three pets

Status: implemented
Owner: E (@WhW0591)

## Problem

The Who steppers allowed unbounded additions, while each party category accepted 99 and the total
had no maximum. The user explicitly requests a combined limit of nine people and three pets.

## Decision

Shared `TravellerCount` accepts 1–9 people. `TravellerParty` accepts nonnegative integer counts,
at most nine adults, children, infants and seniors combined, and at most three pets independently.
Full and partial briefs, orchestrator patches and settings defaults use the shared limits. Who
disables additions at each limit, keeps removal available, and explains the rule in both languages.
Invalid party counts are owned by the Who editor, not the preferences editor.

This narrows the limits in the [traveller breakdown note](2026-09-24-traveller-party.md), while
preserving its optional breakdown and authoritative `groupSize` decisions.

## Alternatives considered

- Keep 99 per category: it does not match the requested combined cap.
- Limit only the buttons: chat and direct API payloads could bypass the restriction.
- Silently clamp requests: it would generate a trip for fewer people than requested.

## Consequences

Nine people plus three pets are valid; ten people or four pets fail validation before planning.
Existing oversized data is not rewritten or silently reduced and must be corrected to use the
planner. These are product bounds, not verified inventory, pet-policy or booking guarantees.
