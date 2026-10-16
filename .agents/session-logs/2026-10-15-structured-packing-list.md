---
date: 2026-10-15
author: Claude Haiku 5.5 (/implement, approved by the user for #352)
branch: feature/packing-list-items
pr: none
area: packages/shared, packages/agents, apps/web
contract-impact: packages/shared
---

# Show the packing tip as a list, not a paragraph (#352)

## What changed

- `packages/shared/src/contracts.ts`: `ProposalItem` gains optional `packing: string[]`.
- `packages/agents/src/destination-guide/index.ts`: the `weather-packing` item sets `packing` and keeps `detail` to the weather summary.
- `apps/web/components/trip/TripTips.tsx`: renders `packing` as a list under the weather text.
- `packages/agents/tests/destination-guide/index.test.ts`: the model-draft test checks the packing array (written red first).
- `apps/web/tests/e2e/weather-provider-planning.e2e.mjs`: expects the weather text in `detail` and the four items in `packing`.
- Agent Note: `.agents/notes/implemented/feature/2026-10-15-structured-packing-items.md`.

## Why

The packing list was joined into one string, so the tips panel could only show a paragraph. A structured field keeps the items as data. See the Agent Note for the alternatives.

## Validation

- Red: the new assertion failed with `expected undefined to deeply equal [ 'Layers', 'Walking shoes' ]` before the schema and agent change.
- Results of the commands below are recorded in the PR body.

## Notes for the next person

- The E2E expectation was updated but not run here, because the signed-in workspace cannot be reached in this environment.
