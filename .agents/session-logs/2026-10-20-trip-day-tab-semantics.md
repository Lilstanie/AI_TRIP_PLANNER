---
date: 2026-10-20
author: Codex
branch: fix/day-tab-panel-semantics
pr: none
area: apps/web, docs
contract-impact: none
---

# Connect trip day tabs to the selected day panel

## What changed

- Added unique day-tab IDs and `aria-controls`; the selected day timeline is now a labelled, focusable tabpanel.
- Extended `trip-initial-scroll` to verify tab/panel semantics and keyboard selection in desktop English and Chinese phone views.
- Added a failure inventory and updated English and Chinese workspace UI documentation.

## Why

The existing day strip already used the tab pattern and roving focus, but exposed no relationship to the displayed day content.

## Validation

- `pnpm --filter @trip/web e2e trip-initial-scroll` — passed at 1280×800, 1440×1000, and 390×844; mock-mode only.
- `pnpm --filter @trip/web run test --maxWorkers=2` — passed, 57 files / 642 tests.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-artifacts`, `pnpm verify:e2e-selectors` — passed.

## Notes for the next person

Browser evidence uses deterministic mock data; it does not verify live providers, authentication, or deployed devices.
