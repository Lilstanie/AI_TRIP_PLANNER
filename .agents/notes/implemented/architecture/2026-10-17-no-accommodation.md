# Agent Note: No accommodation as an explicit trip constraint

Status: implemented

## Problem

A traveller who does not need lodging must be distinguished from one who has booked a particular stay. Treating either case as ordinary accommodation planning can invoke unnecessary search and allocate budget to a stay.

## Decision

`TripBrief.noAccommodation` and `PartialTripBrief.noAccommodation` are optional booleans in the shared contract. When true, the workflow excludes the accommodation specialist and the planning board makes no accommodation allocation. When absent or false, existing accommodation planning continues. `bookedStay` remains an independent field for a traveller who has booked a stay; setting `noAccommodation` does not encode or replace that booking.

## Alternatives considered

No alternative was recorded for this decision.

## Consequences

The explicit flag lets the workspace carry a traveller's lodging constraint through chat, draft and saved brief state without changing the meaning of booked stays. Consumers that do not set the flag retain the prior behavior. This adds an optional shared contract field that must be preserved by producers and consumers.

The related [conversation scope decision](../feature/2026-09-27-conversation-scope.md) covers arranged flights and booked stays; this note adds the separate no-accommodation case without changing that decision.

## Sources

- `packages/shared/src/contracts.ts`
- `packages/shared/src/chat.ts`
- `packages/orchestrator/src/workflow.ts`
- `packages/orchestrator/src/board.ts`
- `apps/web/components/preferences/PreferenceList.tsx`
