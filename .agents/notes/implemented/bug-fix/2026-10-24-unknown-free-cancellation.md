# Agent Note: Unknown cancellation terms are not false

Status: implemented
Owner: C (HeadmasterEggy)
Jira: TP-31

## Problem

The live hotel adapter reported `freeCancellation: false` for every stay because SerpApi's hotel
result does not carry cancellation terms. A confirmed free-cancellation preference then filtered out
every candidate, and the run stopped with "No valid stays".

## Decision

`freeCancellation` on a stay option and on a stay candidate is optional. `undefined` means the terms
are unknown; `false` means the source confirmed no free cancellation. The live adapter omits the field
instead of setting `false`. A free-cancellation preference drops only candidates confirmed `false`, so
unknown stays stay eligible, and the plan says "cancellation terms unknown" wherever it describes a
stay. The chat progress, supervisor and booking row show the same three-state label.

## Alternatives considered

Keeping `false` and waiving the preference for live searches would hide a real preference. Dropping
every unknown stay would repeat the failure whenever a provider does not report terms.

## Consequences

The shared `StayCandidate` and `StayOption` contracts change: consumers must treat a missing value as
unknown. Mock fixtures still set explicit booleans, so Agent Lab results are unchanged.
