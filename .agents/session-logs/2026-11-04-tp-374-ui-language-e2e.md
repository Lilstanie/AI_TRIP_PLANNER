---
date: 2026-11-04
author: Claude (refinement loop)
branch: fix/TP-374-ui-language-e2e
pr: pending
area: apps/web/tests/e2e, docs
contract-impact: none
---

# TP-374: ui-language E2E waits for the current workspace again

## What changed

- `apps/web/tests/e2e/ui-language.e2e.mjs`: after each reload it waits for the real workspace's
  sidebar New chat entry in the expected language (`New chat` / `新聊天`) instead of a
  "Conversation" / "对话" tab the workspace removed.
- `docs/e2e-known-failures.md` and its pair: the entry moves from failing on `main` to covered.

## Validation

- Before, on `main` with a mock-data dev server: `FAIL journey completes: TimeoutError ... waiting
  for getByRole('tab', { name: 'Conversation', exact: true })`.
- After: 11 of 11 checks `ok`.
- `pnpm verify:docs`, `pnpm verify:pairs`, Prettier.

## Notes for the next person

- No CI check can catch an E2E waiting on removed copy: raw E2E scripts do not run in CI and
  `verify:e2e-selectors` checks class names, not accessible names.
