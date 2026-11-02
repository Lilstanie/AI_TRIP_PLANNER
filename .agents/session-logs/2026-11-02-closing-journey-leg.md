---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-264-closing-journey-leg
pr: pending
area: packages/agents, packages/orchestrator, docs
contract-impact: none
---

# Close the journey on the last day (TP-264)

## What changed

- `packages/agents/src/transport/legs.ts`: `journeyLegs` adds a closing leg on the last day: back to
  the first city after a flown multi-city trip, home by the same mode after a ground arrival.
- `packages/agents/src/transport/index.ts`: a ground closing hop over six hours is flown; the
  model sees `closing` on flights and hops and is told to arrive three hours before the return flight.
- `packages/agents/src/itinerary/transfer-windows.ts`: a leg to a place outside the trip is a
  transfer home; `accommodation/planning.ts` ignores the closing hop when it splits nights.
- `packages/orchestrator/src/agent-lab/evaluate.ts`: the multi-city check reads the last day's
  closing hop as a transfer.
- Agent Note `.agents/notes/implemented/bug-fix/2026-11-02-closing-journey-leg.md`; architecture
  docs (en + zh).

## Why

Live test on production: Bangkok + Chiang Mai had no leg back to Bangkok before the 21:30 return
flight, and a Sydney to Melbourne drive had no drive home.

## Validation

- `pnpm --filter @trip/agents test`: 207 passed; `@trip/orchestrator`: 430 passed; `@trip/tools`
  173; web vitest 663. Updated expectations: closing leg in legs/transport tests, fixture totals
  (+AUD 59.92 Kyoto→Tokyo train) in budget and weather planning tests.
- Typecheck all packages and web; `verify:docs`, `verify:pairs`, `verify:protected`, Prettier,
  file length: pass.

## Notes for the next person

Open-jaw flights (fly home from the last city) would often be better; not built.
