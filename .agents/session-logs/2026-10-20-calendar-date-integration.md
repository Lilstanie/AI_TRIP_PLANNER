---
date: 2026-10-20
author: Codex
branch: fix/calendar-trip-date-label
pr: 471
area: apps/web, docs
contract-impact: none
---

# Verify calendar date names after integration

## What changed

- Integrated main through `040428cc`, including the narrow time editor fix.
- The calendar browser journey records the original scenario failure and writes its summary before browser cleanup.
- Interrupted screenshot and ARIA collection have bounded timeouts and cannot replace the scenario error.

## Validation

- First integrated browser run stopped during navigation; its cleanup then timed out collecting ARIA. Runner: `2026-10-20T11-59-19-129Z.json`, exit 1.
- `RUN_ID=integrated-recheck CHANNEL=chrome pnpm --filter @trip/web e2e calendar-trip-date-label`: exit 0, 107/107, no skips; runner `2026-10-20T12-05-47-258Z.json`.
- Browser evidence: Chrome 155.0.8059.85, local mock catalog, English/Chinese, 1440/390/375 px, Honolulu/Sydney time zones.
- First integrated web suite: 641 passed, one skipped after PGlite setup exceeded its 10-second hook timeout.
- Focused existing database test: 1/1 passed with no production or timeout changes.
- `pnpm --filter @trip/web run test --maxWorkers=2`: 642/642 in 57 files, exit 0. The earlier shorthand invocation rejected its argument before running tests.
- Web typecheck and lint: exit 0. Docs, translation pairs (27), protected files, artifacts (82), selectors, changed-file formatting, scoped added comments and diff whitespace checks: exit 0.

## Notes for the next person

- Earlier failures remain disclosed; later passes do not erase them. This is no live-provider, real-authentication, physical-device or screen-reader speech acceptance.
- Workspace UI docs were synchronized in the original change. No shared contract or Agent Note update is needed.
