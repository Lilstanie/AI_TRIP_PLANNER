---
date: 2026-09-23
author: Claude Opus 5
branch: fix/remember-the-question
pr: none
area: packages/orchestrator
contract-impact: none
---

# Remember the question a turn ended on

## What changed

- `packages/orchestrator/src/chat.ts`: `runTripChat` now records the assistant's side of a turn that
  ends by throwing. `AskUserError` is remembered as the coordinator's short reply plus each question
  and its option labels; `IncompleteBriefError` is remembered as the question it carries. Both are
  rethrown unchanged, so the API frames are untouched.
- `COORDINATOR_PROMPT` gains one line: an answer to a question asked earlier in the conversation is
  settled, so record it and move on.

## Why

Only a turn that returned a `ChatResponse` was remembered. A turn that ended in a question ended by
throwing, so the question never reached short-term memory: the next turn showed the coordinator the
traveller answering a question nobody had asked, and it asked the same thing again. A live run
reproduced it — two structured questions answered, then the identical two questions.

## Validation

- `pnpm --filter @trip/orchestrator test` — 111 passed, including a new case asserting the question
  and its option labels reach the store.
- Live run with `DEEPSEEK_API_KEY`: "somewhere in Japan next spring with my partner" asked region and
  timing, then a narrower window-and-budget pair, then planned 11 days across Tokyo and Kyoto/Osaka
  at about AUD 7,250 — no question repeated.

## Notes for the next person

The flight-answer path returns rather than throws, so it was already remembered; only the two
throwing paths needed this.
