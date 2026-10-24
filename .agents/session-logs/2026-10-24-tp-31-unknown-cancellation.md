---
date: 2026-10-24
author: Claude (Joey's thread, TP-31)
branch: fix/TP-31-unknown-cancellation
pr: none
area: packages/agents, packages/tools, packages/shared, packages/orchestrator, apps/web
contract-impact: packages/shared
---

# Unknown free cancellation is not treated as false (TP-31)

## What changed

- `packages/shared/src/contracts.ts`, `ports.ts`, `describe.ts`: `freeCancellation` is optional on stay candidates and options.
- `packages/tools/src/serpapi.ts`: live hotels omit the field instead of reporting `false`.
- `packages/agents/src/accommodation/planning.ts`: a free-cancellation preference drops only candidates confirmed `false`.
- Display: `progress-tools.ts`, `supervisor.ts`, `BookingRow.tsx` and `workspace-messages.ts` show "Cancellation terms unknown".

## Why

The decision and its alternatives are in
[the Agent Note](../notes/implemented/bug-fix/2026-10-24-unknown-free-cancellation.md).

## Validation

- `packages/agents`: `tests/accommodation` 30/30, including a new test for a live stay with unknown terms (red before the change).
- `packages/shared` 58/58, `packages/tools` 141/141, `packages/agents` 149/149, `packages/orchestrator` 311/311, `apps/web` i18n 14/14.
- `tsc --noEmit` clean in shared, tools, agents, orchestrator and web.

## Notes for the next person

- Mock booking fixtures still set explicit booleans, so Agent Lab output is unchanged.
