---
date: 2026-10-22
author: Codex
branch: fix/collapsed-thinking-disclosure-548
pr: 553
area: apps/web, docs
contract-impact: none
---

# Verify Think disclosure after integrating current main

## What changed

- Merged `origin/main` at `1c1602146052881cb0063fc930e159e5f2384116` into the #553 branch.
- Preserved the #554 trip-date unit changes and reran its focused calendar E2E alongside the Think disclosure E2E.
- Updated #553 evidence for the integrated tree.

## Why

The mainline integration had an unrelated calendar date-label change; rerunning that focused journey confirms it coexists with the disclosure fix.

## Validation

- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e thinking-disclosure`: 23 checks passed; deterministic streamed fixture, English desktop and Chinese phone, not a live planner run.
- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e calendar-trip-date-label`: 181 checks passed across English/Chinese desktop and phone widths.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`: passed.
- `pnpm verify:docs`, `pnpm verify:pairs` (28 pairs), `pnpm verify:protected`, `pnpm format:check-changed origin/main`, `git diff --check`, `pnpm verify:e2e-artifacts` (101 scripts), and `pnpm verify:e2e-selectors`: passed.

## Notes for the next person

Screenshots were captured and visually inspected; local Chrome file-access settings prevented uploading them to the PR. Browser E2E uses simulated streamed events. GitHub CI is pending for the integrated head at time of this log.
