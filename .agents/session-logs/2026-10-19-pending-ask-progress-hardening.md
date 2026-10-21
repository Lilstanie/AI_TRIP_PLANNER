---
date: 2026-10-19
author: Codex
branch: fix/pending-ask-progress
pr: 448
area: apps/web
contract-impact: none
---

# Reject invalid persisted answers for single-select questions

## What changed

- `apps/web/lib/workspace/ask-user.ts` rejects duplicate saved selections and multiple selections for single-select questions.
- `apps/web/tests/e2e/pending-ask-refresh.e2e.mjs` covers malformed saved answers after a reload.

## Why

Catalog data can be stale or edited outside the UI. The restore boundary now drops invalid progress so it cannot be submitted as a valid single answer.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e pending-ask-refresh` before the fix: failed the new assertion at 375px and 1440px; malformed multi-answer progress remained selected.
- `CHANNEL=chrome pnpm --filter @trip/web e2e pending-ask-refresh` after the fix: passed at 375px and 1440px with no browser errors.
- `pnpm --filter @trip/web test`: 57 files and 632 tests passed; jsdom emitted canvas implementation warnings.
- `pnpm --filter @trip/web typecheck`: passed.
- `pnpm --filter @trip/web lint`: passed.
- `pnpm exec prettier --write apps/web/lib/workspace/ask-user.ts apps/web/tests/e2e/pending-ask-refresh.e2e.mjs`: passed.

## Notes for the next person

- The default Playwright Chromium executable was unavailable; the installed Chrome channel ran the browser E2E successfully.
