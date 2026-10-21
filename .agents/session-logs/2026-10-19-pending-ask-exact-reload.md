---
date: 2026-10-19
author: Codex
branch: fix/pending-ask-progress
pr: 448
area: apps/web
contract-impact: none
---

# Cover the unanswered-question reload reproduction

## What changed

- `apps/web/tests/e2e/pending-ask-refresh.e2e.mjs` now reloads an unanswered question after confirming the pending ask reached the saved catalog.
- The browser flow verifies the restored prompt, options, continue action, and skip action at mobile and desktop widths.

## Why

The issue's original reproduction reloads before any answer is selected. Existing coverage only reloaded after partial progress. The catalog save is debounced, so the E2E waits for persisted state before refreshing.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e pending-ask-refresh` — passed 27 assertions at 375px and 1440px; no browser errors. Artifact: `output/e2e/runner/2026-10-18T16-45-13-512Z.json`.
- `pnpm --filter @trip/web test` — 57 files and 632 tests passed; Vitest emitted existing jsdom canvas-not-implemented warnings.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, and `pnpm format:check-changed origin/main` — passed.
- Initial E2E attempts exposed incorrect fixture assertions and a refresh before the debounced save; corrected the assertions and waited for the persisted ask before the passing run.

## Notes for the next person

No remaining gaps identified in this regression path.
