---
date: 2026-11-01
author: Claude Code for Joey
branch: fix/TP-246-thinking-deps-union
pr: none
area: apps/web
contract-impact: none
---

# Stop TS2590 in ThinkingProcess after an incremental typecheck (TP-246 follow-up)

## What changed

- `apps/web/components/chat/ThinkingProcess.tsx`: the `useMemo` dependency list holds `hasError` (a boolean) instead of the `Notice` value `error`.

## Why

After #898 moved `thinking-model.ts`, `tsc --noEmit` with the previous commit's `tsconfig.tsbuildinfo` failed with TS2590 at that dependency array: the array literal's element type is a union that includes every `Notice` member, which TypeScript only manages to reduce in some check orders. A clean run passed, so CI was green, but the pre-push hook and local typechecks on an existing checkout failed. The memo only ever used `Boolean(error)`, so depending on the boolean keeps behaviour the same and removes the large union.

## Validation

- Typecheck at 644e87a, then at this branch reusing that build info: passed (the same sequence on 769f26c gives TS2590).
- Clean `tsc --noEmit` without build info: passed.

## Notes for the next person

none
