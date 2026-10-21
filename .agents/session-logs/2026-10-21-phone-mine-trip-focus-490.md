---
date: 2026-10-21
author: Codex
branch: fix/phone-mine-trip-focus
pr: 496
area: apps/web
contract-impact: none
---

# Keep keyboard focus on the opened phone trip

## What changed

- `PhoneMine.tsx` focuses the trip-title button after a Mine trip opens.
- `phone-mine.e2e.mjs` covers Enter activation and visible focus at 390px and 360px.
- Updated paired workspace UI docs in English and Chinese.

## Why

The list unmounts on selection; without moving focus, browsers reset it to `body`.

## Validation

- Baseline `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e phone-mine --prod`: failed at 390px and 360px with active element `BODY`.
- Same E2E on the fix: passed in 21s; title focused and `:focus-visible` at both widths.
- `pnpm --filter @trip/web typecheck`, `lint`, and `test`: passed; 57 files and 642 tests.
- `pnpm verify:docs`, `verify:protected`, `verify:pairs`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `format:check-changed origin/main`, and `git diff --check`: passed.

## Notes for the next person

The browser screenshot is captured at `output/playwright/phone-mine/390-trip-title-focus.png`.
