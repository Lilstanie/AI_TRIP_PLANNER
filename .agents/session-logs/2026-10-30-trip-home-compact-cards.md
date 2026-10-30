---
date: 2026-10-30
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: apps/web, docs
contract-impact: none
---

# Compact Trip action counts and remove the extra composer frame

## What changed

- `workspace-trips.css` removes the home composer wrapper's background, border and shadow.
- `TripHomeCards.tsx` renders bare numeric counts; card flex rows align them right of titles
  and reduce the minimum card height from 72 to 48 pixels.
- Added per-profile browser layout checks and updated the failure inventory and existing
  Ideas count assertions. Paired action-design docs and the implemented action note match.
- Updated the loop handoff at `/tmp/mindtrip-implementation/handoff.md`.

## Validation

- `pnpm --filter @trip/web e2e run trip-home-send`: red before the fix at
  `output/e2e/local-test-cli/2026-10-30T02-44-06-631Z-7790-0js463/`; green after at
  `output/e2e/local-test-cli/2026-10-30T02-45-46-488Z-8082-qk1z5r/`.
- Covers English/Chinese and desktop/tablet/phone/breakpoint profiles. Checked desktop and phone
  screenshots visually; no browser errors or external requests.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`: passed.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs`: passed.
- Web typecheck and native Next lint on `TripHomeCards.tsx`: passed.
- Prettier on changed source/scripts and `git diff --check`: passed.

## Notes for the next person

- Browser fixture results do not establish live-map/provider or physical-device behavior.
- Local WIP on the PR #782 branch; no remote writes. Earlier shared-composer WIP preserved.
- Calendar weekly time-axis spec finding remains outside this visual correction.
