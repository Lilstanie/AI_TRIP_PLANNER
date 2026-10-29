---
date: 2026-10-29
author: Codex
branch: feature/TP-155-trip-action-panels
pr: 782
area: apps/web, docs
contract-impact: none
---

# TP-155 final selector and format cleanup

## What changed

- Point expanded-panel E2E layout check at `.trip-home-action-content`.
- Format Mindtrip interaction proposed note so `format:check-changed` passes.
- Keep map host ownership under TripHome aside; drawer never owns the map.

## Why

`verify:e2e-selectors` rejected the removed `.trip-home-action-map` class. Exact-HEAD
evidence must follow the selector/format fixes.

## Validation

- `pnpm verify:e2e-selectors` pass
- `pnpm format:check-changed origin/main` pass
- exact-HEAD `trip-home-action-panels --prod` rerun recorded after this commit

## Notes for the next person

Fixture browser evidence only. Calendar redesign remains #796. Independent Spec /
Standards / Ponytail still needed on the final SHA.
