---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-218-return-day-ends-before-flight
pr: pending
area: packages/shared/src/arrival.ts, packages/agents/src/itinerary
contract-impact: packages/shared
---

# End the return day's stops before the return flight (TP-218)

## What changed

- `inboundDeparture` in `@trip/shared` reads the selected round-trip fare's return departure.
- The itinerary adds a transfer window on that day from three hours before the flight, tells the
  model the departure, skips a fully blocked day in the fallback and in the missing-day check, and
  notes the cut-off.
- Agent Note `implemented/bug-fix/2026-10-31-plan-before-return-flight.md`.
- The pace-cap helpers move to `itinerary/pace-cap.ts` to keep `index.ts` under 1000 lines.

## Why

The live packed Tokyo check on `main` 7926bf5 planned six sights on the return day until 19:00.

## Validation

- `vitest run` in `packages/shared` (58), `packages/agents` (207), `packages/orchestrator` (422);
  `tsc --noEmit` in shared and agents.

## Limitations

- Needs the return leg from PR #865; without it nothing changes.
- No new automated test; the live Mac run checks it.
