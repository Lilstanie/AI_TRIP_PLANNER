---
date: 2026-11-01
author: Claude Code for Joey
branch: refactor/TP-246-chat-trip-logic-to-lib
pr: none
area: apps/web, docs
contract-impact: none
---

# Move chat and trip logic that renders nothing into apps/web/lib (TP-246)

## What changed

- `components/chat/{thinking-model,team-model,team-check}.ts` moved to `lib/chat/`; `components/trip/previewRequest.ts` moved to `lib/trip/preview-request.ts`.
- `ASSISTANT_ORDER` moved from `components/chat/assistant-names.ts` to `lib/chat/assistant-order.ts`, so `lib/chat` does not import from `components/chat`; `checkText` takes a plain `(id) => string` name function instead of the hook's type.
- `lib/trajectory/adapter.ts` now imports `checkText` from `lib/chat`. Docs that named the old paths updated; `docs/development.md` (+ `.zh.md`) says view models and request helpers belong in `lib`.

## Why

Part 2 of Joey's 2026-11-01 structure review. `mentions.ts`, `assistant-names.ts` and `plan-revision.ts` stay in `components`: they are React hooks or depend on `assistants.tsx` (icons), so moving them means splitting files, which waits until after Stage 2.

## Validation

- `pnpm --filter @trip/web typecheck` passed.
- `pnpm --filter @trip/web test`: 60 files, 662 tests passed. Lint: only the existing ChatPanel and PhoneTrajectory hook warnings.

## Notes for the next person

`lib/trajectory/adapter.ts` and `lib/chat/team-check.ts` still import types from `components/`.
