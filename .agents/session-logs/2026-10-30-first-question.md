---
date: 2026-10-30
author: Claude Code
branch: feature/TP-169-first-question
pr: none
area: packages/orchestrator, apps/web tests, docs
contract-impact: none
---

# A vague request gets one question in the traveller's language

## What changed

- `packages/orchestrator/src/brief-intake.ts`: `nextFieldAsk` asks for the first missing field in the
  message's language, names a known destination, and lists the remaining fields; `requireReady` uses
  it when the model wrote no question. The `missing` labels returned to the model are unchanged.
- `packages/orchestrator/src/chat-offline.ts`: generic words (旅游, 旅行, 度假, holiday, trip …) are not
  read as a destination.
- `packages/orchestrator/tests/incomplete-brief-ask.failures.md`, `tests/chat.test.ts`,
  `apps/web/tests/e2e/first-question.e2e.mjs`, `docs/api*.md`.

## Why

"我想去旅游" saved 旅游 as the destination and got the English checklist "To start planning, include
the start and end dates, …". Mindtrip asks one friendly question at a time.

## Validation

- `first-question.e2e.mjs` against dev (mock data): before 3/8, after 8/8, English and Chinese.
- `pnpm --filter @trip/orchestrator exec vitest run`: 416 passed.

## Limitations

- With a model key the model writes its own question; only the fixed fallback changed.
