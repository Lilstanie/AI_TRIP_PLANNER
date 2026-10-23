---
date: 2026-10-21
author: Codex
branch: fix/budget-category-breakdown-485
pr: 502
area: apps/web, docs
contract-impact: none
---

# Show budget estimates by category

## What changed

- `TripPanel.tsx` shows estimated accommodation, transport, meals and activities amounts, plus unpriced item counts.
- `workspace-messages.ts` adds Chinese labels and estimate/unpriced markers; `trip.css` styles the rows.
- Added a Chrome E2E journey and updated paired English and Chinese workspace documentation.

## Why

- The four section totals communicate the known budget composition while clearly excluding proposal items without prices.

## Validation

- Before implementation, the focused browser journey failed because the budget card had no category breakdown.
- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true LABEL=latest-main pnpm --filter @trip/web e2e budget-category-breakdown`: passed at 800×600, including four amounts summing to 360, estimated and unpriced markers, and Chinese translations. Runner: `output/e2e/runner/2026-10-21T03-57-09-680Z.json`.
- `pnpm --filter @trip/web test`: 57 files and 642 tests passed.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`, `pnpm verify:docs`, `pnpm verify:pairs` (27 pairs), `pnpm verify:protected`, `pnpm verify:e2e-artifacts` (91 scripts), `pnpm verify:e2e-selectors`, `pnpm format:check-changed origin/main`, `git diff --check`, and Prettier: passed.

## Notes for the next person

- Browser evidence uses synthetic local data; it does not cover live providers, production data or authentication. Per-item cost expansion remains deferred.
