---
date: 2026-10-22
author: Claude Code
branch: fix/triage-accessibility-chat-search
pr: none
area: apps/web/tests, docs
contract-impact: none
---

# triage-accessibility waits on the visible empty-chats line

## What changed

- `apps/web/tests/e2e/triage-accessibility.e2e.mjs`: the wait after typing a search term targets the
  visible `.history-empty` line instead of any element with the text "No matching chats.", which
  also matched the sr-only search status and threw in strict mode.
- `docs/e2e-known-failures.md` and its Chinese pair: the entry is removed.

## Why

The product is right: the status region and the visible line both say it. Only the test's locator
was ambiguous, so the script stopped before its Who, budget and map checks ran.

## Validation

- `DATA_MODE=mock pnpm --filter @trip/web e2e triage-accessibility` on main: exit 1 after 1 check,
  "strict mode violation ... resolved to 2 elements". With the change: exit 0, every check ok.

## Notes for the next person

`sidebar-search-counts` and `calendar-trip-identity-search` read the status by role, so they were
not affected.
