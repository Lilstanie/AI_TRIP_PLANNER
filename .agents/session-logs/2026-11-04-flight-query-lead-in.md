---
date: 2026-11-04
author: Claude Code
branch: claude/funny-edison-0owjty
pr: none
area: packages/orchestrator
contract-impact: none
---

# Flight questions with a long lead-in reach the model-free flight answer

## What changed

- `packages/orchestrator/src/chat/flight-query.ts`: the origin starts after `from` or `从` when the
  message has one (`PAIR_FROM`, `PAIR_CN_FROM`); otherwise it starts at a word boundary with no
  length cap, so `city()` strips whole lead-in words. `LEADING_CN` strips `最便宜的` and `最低价的`.
- `packages/orchestrator/tests/flight-query-lead-in.failures.md`: the failure inventory, written
  before the fix.
- `packages/orchestrator/tests/flight-query.test.ts`: English and Chinese lead-in cases, and long
  lead-ins that must still decline.

## Why

The origin capture was a lazy run of at most 31 characters matched from the leftmost position with
`from` optional. A longer lead-in made the capture start mid-word ("heapest flight from Los
Angeles"), so the question went to the coordinator. The same cause gave wrong cities instead of
declining: "I want to fly from Sydney to Tokyo" parsed as origin "I want", and a Chinese lead-in
over ten characters kept "一下最便宜的" in the origin. Raising the cap would only move the cliff.

## Validation

- `pnpm --filter @trip/orchestrator exec vitest run tests/flight-query.test.ts` on the old code:
  2 failed, 13 passed (the two new lead-in tests).
- `pnpm --filter @trip/orchestrator test`: 40 files, 440 tests passed.
- `pnpm turbo run typecheck --filter=...@trip/orchestrator`: 2 tasks successful.
- `pnpm --filter @trip/orchestrator lint`, Prettier check on changed files,
  `node scripts/check-file-length.mjs`: clean.

## Notes for the next person

A Chinese lead-in that is not a known lead word and has no `从` ("你好洛杉矶到东京") still glues onto
the origin; Han text has no word boundary to cut at.
