---
date: 2026-10-31
author: Claude Code
branch: fix/accommodation-search-loop
pr: none
area: packages/agents
contract-impact: none
---

# A failed stay search no longer loops the accommodation specialist

## What changed

- `packages/agents/src/accommodation/index.ts`: a search tool failure now ends the model loop, and the
  search runs at most once per specialist call.
- `packages/agents/tests/specialist-search-failure.test.ts` and its failure inventory.

## Why

The tool error went back to the model, and `tool_choice: required` forced another call, so one
failure cost 13 provider searches before the recursion limit of 25 stopped it. Raising the limit
would only spend more. Transport turns a failed flight search into empty options, so it is unchanged.

## Validation

- Real DeepSeek model, throwing `searchStays`: before 13 searches, 13 model calls, 14.8 s; after
  1 search, 1 model call, 1.1 s. Normal stay path: 1 search, 2 model calls, valid proposal.
- New test on the unfixed code: failed with 13 and 12 searches; passes after the fix.
- `pnpm --filter @trip/agents exec vitest run`: 189 passed before the log was added.

## Notes for the next person

The fake model proves the loop ends, not that a real model is forced to call a tool.
