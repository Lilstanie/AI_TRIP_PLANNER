---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/offline-brief-leading-place
pr: pending
area: packages/orchestrator, apps/web
contract-impact: none
---

# Offline brief reads "Plan X from Y 2026-…" without a comma; party label says "children"

## What changed

- `packages/orchestrator/src/chat/chat-offline.ts`: the leading-destination pattern accepts a space,
  or `from`, between the place and the first ISO date, not only a comma.
- `packages/orchestrator/tests/chat-offline-origin.test.ts`: four cases written before the fix
  (three red on `main`, one guard that "Plan a trip to …" still reads Sydney).
- `apps/web/lib/workspace/trip-facts.ts`: the English Who label uses each row's plural label instead
  of appending "s" to the singular, so "2 children" no longer reads "2 childs".

## Why

Signed-out visitors on the deployed site and keyless local runs use the rule parser. "Plan Singapore
from Sydney 2026-12-07 to 2026-12-11 …" left the destination empty and the planner asked "Where would
you like to go?" for a request that named it.

## Validation

- `pnpm --filter @trip/orchestrator exec vitest run tests/chat-offline-origin.test.ts`: 3 failed before
  the fix, 14 passed after.
- `pnpm --filter @trip/orchestrator test`: 40 files, 441 tests passed.
- Browser (dev server, mock data, no model key): the message above plans a 5-day Singapore trip, and
  the top bar reads "2 adults, 2 children".

## Notes for the next person

none
