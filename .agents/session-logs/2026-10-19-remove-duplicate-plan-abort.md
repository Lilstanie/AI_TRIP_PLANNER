---
date: 2026-10-19
author: Codex
branch: feature/long-term-memory-integration
pr: none
area: apps/web
contract-impact: none
---

# Remove the duplicate plan abort cleanup

## What changed

- Removed a redundant unmount cleanup effect from `apps/web/components/trip/plan-revision.ts`.

## Why

The existing effect already aborts the active request when its plan changes or the hook unmounts.

## Validation

- `PLAYWRIGHT=/private/tmp/playwright-chrome.cjs pnpm --filter @trip/web e2e plan-revision` — passed; browser journey summary at `output/playwright/plan-revision/after/summary.json`.
- The first browser attempts could not locate the cached Chromium shell and then could not resolve Playwright from the isolated worktree. The passing retry used the installed main-workspace Playwright package and Google Chrome.
- `git diff --check`, `pnpm verify:docs`, `pnpm verify:protected`, and `pnpm format:check-changed origin/main` — passed.

## Notes for the next person

The E2E was run with installed Google Chrome instead of Playwright's cached Chromium shell.
