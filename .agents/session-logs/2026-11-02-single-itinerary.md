---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-278-single-itinerary
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# A change to named days keeps one itinerary section

## What changed

- `packages/orchestrator/src/planning/workflow.ts`: after a mention or `change_itinerary` revision, a revised proposal is appended only when no kept proposal has the same agent.
- `packages/orchestrator/tests/mention-day-notes.test.ts`: one test with `change_itinerary` on day 2.
- `docs/architecture.md` + `.zh.md`: one sentence.

## Why

Live test 2026-11-02 (New York): after "book a Broadway show for the last night" the plan had two itinerary sections, and the reply told the traveller a stop appeared twice. `scopedItineraryEdit` returns a new object when days are named, so the `proposals.includes(next)` check appended the raw revision again.

## Validation

- `pnpm --filter @trip/orchestrator test` 431 passed (new test failed before the fix); typecheck passed.
