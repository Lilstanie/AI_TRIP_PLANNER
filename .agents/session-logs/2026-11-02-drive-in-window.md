---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-268-drive-in-window
pr: none
area: packages/agents, docs
contract-impact: none
---

# No stops during the ground journey into the trip

## What changed

- `packages/agents/src/itinerary/transfer-windows.ts`: a non-flight leg from outside the trip into a trip city becomes a transfer window (`home → city`), like the closing `city → home` leg from #916.
- `docs/architecture.md` and `.zh.md`: one sentence each.

## Why

Prod re-run after #916: Sydney → Melbourne drive weekend had Melbourne stops 09:30–16:30 while the drive ran 08:00–16:58. Only flights had a landing time; ground arrivals had no window.

## Validation

- `pnpm --filter @trip/agents test` 207 passed; `@trip/orchestrator` 430 passed (flights excluded by `selectionId` `flight-*`, which the landing rule already covers).
- Scratch tsx check: day 1 09:30 stop rejected, 17:30 stop accepted.

## Notes for the next person

none
