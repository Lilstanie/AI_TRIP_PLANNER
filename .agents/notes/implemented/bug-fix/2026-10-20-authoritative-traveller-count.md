# Agent Note: Preserve the authoritative traveller count during chat extraction

Status: implemented

## Problem

Chat extraction can produce both an explicit `groupSize` and a descriptive `party`. Deriving the
people count from the breakdown can overwrite a total the traveller stated, and retaining a
mismatched breakdown sends contradictory party data downstream.

## Decision

The existing [traveller-party decision](../architecture/2026-09-24-traveller-party.md) remains
authoritative: `groupSize` controls people and costs, while `party` is optional descriptive detail
and pets do not count as people. Offline extraction only derives `groupSize` when the message has no
explicit total. Brief normalization preserves an existing or stated `groupSize` and drops `party`
when its people count does not match. The chat tool handler also restores an explicit total found in
the traveller's message if model extraction returns a conflicting count.

## Alternatives considered

- **Derive the total from every extracted breakdown.** Rejected because it replaces the authoritative
  total when the traveller states both values.
- **Keep mismatched party data and rely on downstream consumers to ignore it.** Rejected because it
  leaves contradictory facts in the normalized brief and is easy for future consumers to misuse.

## Consequences

Explicit totals remain stable for planning and costing; matching breakdowns remain available for
traveller-aware planning. A mismatch loses descriptive detail until the traveller provides a
consistent breakdown.

## Sources

- [Traveller party decision](../architecture/2026-09-24-traveller-party.md)
- [Issue 444](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/444)
