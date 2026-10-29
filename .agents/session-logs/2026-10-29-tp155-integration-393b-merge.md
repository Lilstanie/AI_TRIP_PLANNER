---
date: 2026-10-29
author: Codex
branch: feature/TP-155-trip-action-panels
pr: 782
area: apps/web, docs
contract-impact: none
---

# TP-155 rebase onto Trip-home send tip

## What changed

- Merged integration tip `393b064f` into `feature/TP-155-trip-action-panels`.
- Kept TripHome scroll/composer split with `mainRef` on `.trip-home__scroll` and map host under aside.
- Split list-mode scroll restore from embedded Chat path in `trip-home-action-panels` E2E and paired design docs.

## Why

`#792` locks desktop Chat scroll inside the Chat surface, so the old main-column scroll assertion was no longer true once a Chat was open.

## Validation

- `pnpm --filter @trip/web typecheck` pass
- `LABEL=tp155-scroll-pad-after-393b NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=… CHANNEL=chrome pnpm --filter @trip/web e2e trip-home-action-panels --prod` pass; 50 assertions; artifact `output/playwright/trip-home-action-panels/tp155-scroll-pad-after-393b/`

## Notes for the next person

Exact-HEAD evidence and Spec/Standards/Ponytail must run after this log commit. Fixture browser only; Calendar redesign remains `#796`.
