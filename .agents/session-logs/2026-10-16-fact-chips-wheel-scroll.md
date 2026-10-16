---
date: 2026-10-16
author: Claude Opus 5.5
branch: fix/fact-chips-wheel-scroll
pr: pending
area: apps/web
contract-impact: none
---

# Scroll the trip-fact chip row with a vertical wheel (issue #356)

## What changed

- `apps/web/components/preferences/TripFactChips.tsx`: a non-passive `wheel` listener on the chip row turns vertical wheel movement into horizontal scrolling, only while the row can still move that way.
- `apps/web/app/styles/trip-facts.css`: the edge fade widens from 32 px to 56 px.
- `apps/web/tests/e2e/fact-chips-wheel-scroll.e2e.mjs`: new E2E at 1024 x 768 after an example plan.
- `docs/workspace-ui.md` and `.zh.md`: describe the wheel and fade.

## Why

Decided with the owner: keep the top bar one row high instead of wrapping or shrinking the chips. The handler leaves the event alone at either end of the row, for Ctrl-zoom, and for horizontal gestures, so page scrolling still works.

## Validation

- `node tests/e2e/run.mjs fact-chips-wheel-scroll` without the fix: 5/10, the wheel moved the row 0 px.
- Same command with the fix: 10/10 checks passed (row overflows by 142 px; wheel reaches the end; fades flip; wheel over the chat leaves the row alone).
- `pnpm --filter @trip/web typecheck`, `lint`: exit 0. `vitest run tests/components/preferences/TripFactChips.test.tsx`: 21 passed.
- `pnpm verify:e2e-artifacts`, `verify:e2e-selectors`, `verify:pairs`, `verify:docs`: pass.

## Notes for the next person

- `.agents/translation-pairs.json` also changes in the #357 branch; after one merges, re-record `docs/workspace-ui.md` on the other.
