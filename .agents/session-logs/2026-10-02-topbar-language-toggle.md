---
date: 2026-10-02
author: Codex
branch: feature/localisation-currency
pr: none
area: apps/web, docs
contract-impact: none
---

# Top-bar language toggle

## What changed

- Added a one-press English/Simplified Chinese button directly beside the Mock/Live data control.
- Reused the persisted account language setting, so the top-bar button and Settings stay in sync.
- Matched the existing Liquid Glass top-bar button style and collapsed to an accessible globe button at phone width.
- Extended the localisation/currency browser path and synchronized the English and Chinese workspace UI documentation.

## Why

Language is a frequent workspace action and should be reachable without opening account settings. Grouping it with the data-mode control keeps the top-right utility actions visually and semantically consistent.

## Validation

- `PLAYWRIGHT=... CHANNEL=chrome node apps/web/tests/e2e/localisation-currency.e2e.mjs` — passed at 1440×1000 and 390×844; verified adjacency, two-way switching, persistence, no browser errors and no phone overflow.
- `corepack pnpm --filter @trip/web typecheck` — passed.
- `corepack pnpm --filter @trip/web lint` — passed with the existing Next.js lint-command deprecation notice.
- `corepack pnpm --filter @trip/web test` — passed: 41 files, 405 tests; existing non-failing jsdom canvas warnings remain.
- `corepack pnpm verify:docs`, `corepack pnpm verify:pairs`, and `corepack pnpm verify:protected` — passed.

## Notes

- Settings keeps the detailed Language & region selector; both entry points update the same setting.
- No API or shared planning contract changed.
