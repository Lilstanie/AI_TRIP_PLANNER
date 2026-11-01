---
date: 2026-11-01
author: Claude Code for Joey
branch: refactor/TP-249-style-folders
pr: none
area: apps/web, docs
contract-impact: none
---

# Group app/styles by area (TP-249)

## What changed

- `apps/web/app/styles/` now has `chat/` (7 files), `trip/` (3), `workspace/` (13 incl. `index.css`), `phone/` (9 incl. `index.css`) and `agent-lab/` (6 incl. `index.css`); tokens, base, forms, settings, auth, map, glass, motion and intro stay at the top level.
- The aggregators `agent-lab.css`, `phone.css` and `workspace.css` became each folder's `index.css`; `globals.css` and the aggregators point at the new paths. No rule changed.
- `docs/development.md` (+ `.zh.md`) describes the folders and the import-order rule; design docs and one implemented note updated to the new paths.

## Why

Item 3 of Joey's 2026-11-01 structure review (47 CSS files in one folder). The cascade depends on import order, so the move keeps every import in place.

## Validation

- Inlining every local `@import` from `globals.css` before and after gives byte-identical CSS (14,245 lines).
- `pnpm --filter @trip/web build`: compiled successfully. `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`: ok.

## Notes for the next person

none
