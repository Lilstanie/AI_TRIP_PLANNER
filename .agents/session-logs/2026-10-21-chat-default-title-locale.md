---
date: 2026-10-21
author: Claude
branch: fix/chat-default-title-locale
pr: none
area: apps/web, docs
contract-impact: none
---

# Translate the default title of a New trip chat

## What changed

- `ChatsPanel.tsx` translates the stored `New trip` title as well as `New chat`, so the Chats row and its action label follow the interface language (#491).
- `chinese-locale-controls.e2e.mjs` starts a New trip chat in English, switches to Chinese, and asserts the row title and action label are `新行程` and `新行程的操作`.
- `workspace-ui.md` and `workspace-ui.zh.md` describe the New trip title behaviour in both languages.

## Validation

- Before the fix, the new assertion fails: no `新行程` row appears after switching language.
- After the fix, `pnpm --filter @trip/web e2e chinese-locale-controls --prod` passes all checks, including the new one.
- `pnpm --filter @trip/web typecheck`, `lint`, `test` (57 files, 642 tests) pass.
- `pnpm verify:docs`, `verify:protected`, `verify:pairs`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `format:check-changed origin/main`, and `git diff --check` pass.

## Notes for the next person

- The title is still stored in English; only display is translated. A chat the user renames keeps its custom name, and a custom name that happens to equal `New trip` is also translated, the same existing trade-off as `New chat`.
