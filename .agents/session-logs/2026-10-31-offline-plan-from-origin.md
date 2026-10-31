---
date: 2026-10-31
author: Claude Code
branch: fix/TP-200-offline-plan-from-origin
pr: none
area: packages/orchestrator
contract-impact: none
---

# Offline extraction reads "Plan Tokyo from Sydney, <dates>" as Tokyo from Sydney

## What changed

- `packages/orchestrator/src/chat-offline.ts`: the leading-destination pattern now skips a leading
  "plan" and reads a following "from <city>" as the origin.
- `packages/orchestrator/tests/chat-offline-origin.test.ts`: four cases for the leading form.

## Why

The Stage 2 pre-submission check ran the demo runbook's first prompt on a fresh `git archive` copy
with no keys. The offline parser set the destination to "Plan Tokyo from Sydney", so every section,
the reply and the trip title used that name.

## Validation

- `npx vitest run tests/chat-offline-origin.test.ts` failed 3 of 10 before the fix; after it,
  `npx vitest run` in `packages/orchestrator`: 421 passed.
- `pnpm turbo run typecheck lint --filter=...@trip/orchestrator`: 4 successful.
- `pnpm build`, then `POST /api/chat` with the runbook prompt and no keys: destination Tokyo,
  origin Sydney. Browser screenshot of the same prompt shows the plan titled "Tokyo · 1–4 Feb 2027".

## Notes for the next person

none
