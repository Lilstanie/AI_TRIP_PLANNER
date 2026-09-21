# Agent Note: A trip states its origin and the journey is an ordered list of legs

Status: implemented
Owner: B (@fonever2)

## Problem

Transport read its origin from a long-term preference `transport.origin` that nothing ever wrote,
so every trip departed from a hard-coded "Sydney", and a Sydney trip skipped flight pricing
entirely. The journey was implicit: one flight query, a separately derived list of route queries,
and two more places rebuilding the first hop for labels.

## Decision

`TripBrief.origin` is an optional field in `packages/shared`, filled from the Preferences form or
chat extraction ("a trip from A to B", "departing X"). `packages/agents/src/transport/legs.ts`
builds every hop in travel order with `journeyLegs()`, and `legMode()` decides flight or ground
per leg. `transport/index.ts` derives both its flight query and its route queries from that list.

## Alternatives considered

**Write the `transport.origin` preference instead.** Not adopted: the origin belongs to a trip,
not to a long-term preference.

**Keep the four separate derivations.** Rejected: a multi-city journey would need all four edited
consistently.

## Consequences

- Behaviour is unchanged today: only the first hop flies. Changing which legs fly is a change to
  `legMode()` alone.
- `origin` is an additive, optional contract change.

## Sources

[2026-09-22 trip origin and legs log](../../../session-logs/2026-09-22-claude-trip-origin-and-legs.md)
