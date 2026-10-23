---
date: 2026-10-23
author: Claude Code
branch: refactor/resize-observer-test-stub
pr: none
area: apps/web
contract-impact: none
---

# jsdom gets a ResizeObserver stub; components drop their guards

## What changed

- `apps/web/tests/setup.ts` defines a no-op `ResizeObserver` when jsdom has none.
- `ChatPanel.tsx`, `TripFactChips.tsx`, `ui/motion.ts` and `map/TripMap.tsx` call `ResizeObserver`
  directly. Their `typeof ResizeObserver` guards are gone; they existed only for jsdom.
- `short-phone-empty-chat.e2e.mjs` now waits up to 5 s for the location prompt before dismissing it.
  It used to check only once, which lost a race and failed 2 of 3 local runs.

## Why

This is retro item 4 from 2026-10-22, which Joey approved. Every browser the app supports has
`ResizeObserver`, so the guards shaped production code around the test environment. Each new
component had to remember the guard: #598 broke 12 unit tests by leaving it out.

## Validation

- Web unit tests: 642 passed. With the old `setup.ts` and the guards removed, 67 fail, so the stub
  is what carries them.
- Typecheck and lint pass.
- `node scripts/redgreen.mjs short-phone-empty-chat -- <the four components>`: 35/35 ok before and
  after. After the wait fix, three consecutive runs pass.
- `pnpm verify:e2e-selectors` and `pnpm verify:e2e-artifacts` pass.
