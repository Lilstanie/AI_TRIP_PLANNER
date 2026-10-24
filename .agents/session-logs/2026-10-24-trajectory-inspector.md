---
date: 2026-10-24
author: Claude
branch: feature/TP-74-trajectory-inspector
pr: none
area: apps/web, docs
contract-impact: none
---

# Trajectory record inspector: conflict detail and Esc with focus return

## What changed

- `lib/trajectory/adapter.ts`: a conflict check carries a Result naming each conflict and the specialist it sends back.
- `components/trajectory/TrajectoryTable.tsx`: Esc and the close control close the inspector and focus the record's row.
- `tests/e2e/trajectory-inspector.{failures.md,e2e.mjs}`: failure inventory and E2E (mock data, 1440, en and zh).
- `docs/workspace-ui.md` and `.zh.md`: Inspector bullet and verification line.

## Why

TP-72 already copied DSH's inspector with objective, arguments, results, failures and no token or duration fields.
#670 still lacked a readable conflict, Esc and focus return.

## Validation

- `redgreen.mjs --base origin/feature/TP-72-trajectory trajectory-inspector`: before 8/9 ok (failed), after 38/38 ok (passed).

## Notes for the next person

The sandbox Chromium is build 1243 while Playwright wants 1194; a symlinked `PLAYWRIGHT_BROWSERS_PATH` was used.
