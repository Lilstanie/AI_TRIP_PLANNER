---
date: 2026-10-14
author: Codex
branch: fix/budget-source-replacement
pr: 333
area: apps/web
contract-impact: none
---

# Verify budget source replacement through the browser

## What changed

- Added `apps/web/tests/e2e/budget-source-replacement.e2e.mjs` covering budget source replacement, display-only changes, reload and history recovery.

## Why

- The browser flow catches stale source metadata in chat requests and persisted plans across consecutive replacements.

## Validation

- `pnpm --filter @trip/web e2e budget-source-replacement` — passed, 14 assertions.

## Notes for the next person

- Uses the local mock planning mode; no external credentials or live providers are involved.
