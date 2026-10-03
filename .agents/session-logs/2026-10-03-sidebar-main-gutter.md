---
date: 2026-10-03
author: Codex
branch: feature/localisation-currency
pr: none
area: apps/web, docs
contract-impact: none
---

# Separate the sidebar card from the main workspace

## What changed

- Added the existing 8 px floating-surface gutter between the desktop sidebar card and the main workspace.
- Reset that margin at the existing 1000 px narrow-screen breakpoint, where the persistent sidebar is removed.
- Added a browser regression assertion that measures the rendered `aside` and main-section bounds.
- Documented the desktop and narrow-screen spacing in both workspace UI language variants.

## Why

The Liquid Glass sidebar had top, bottom and outer margins but its inner edge ended on the same grid line where the main workspace began. Their rendered bounds therefore had a 0 px gap and the rounded sidebar card visually collided with the section beside it.

## Validation

- The new browser assertion failed before the fix with a measured `0px` gap.
- `PLAYWRIGHT=... CHANNEL=chrome node apps/web/tests/e2e/localisation-currency.e2e.mjs` — passed with an 8 px desktop gap at 1440×1000 and no horizontal overflow at 390×844.
- Reviewed the generated desktop screenshot under `output/playwright/localisation-currency/`.
- `corepack pnpm --filter @trip/web typecheck` — passed.
- `corepack pnpm --filter @trip/web lint` — passed with the existing Next.js lint-command deprecation notice.
- `corepack pnpm --filter @trip/web test` — passed: 41 files, 405 tests; existing non-failing jsdom canvas warnings remain.
- `corepack pnpm verify:docs`, `corepack pnpm verify:pairs`, and `corepack pnpm verify:protected` — passed.

## Notes

- No API, persistence, or shared planning contract changed.
