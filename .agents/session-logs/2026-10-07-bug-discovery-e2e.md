---
date: 2026-10-07
author: Codex
branch: main
pr: none
area: apps/web/tests/e2e
contract-impact: none
---

# Diagnose two E2E defects without changing business code

## What changed

- Added ignored reproduction scripts and evidence under `output/e2e/bug-audit/`.
- Recorded findings in `output/e2e/bug-audit/report.md`.
- Added this session log; no production source or existing test was changed.

## Why

The user requested bug discovery. Confirmed failures are reported separately from
model dependencies, stale production output and real-provider validation gaps.

## Validation

- `pnpm test`: all six tasks succeeded; five cached; web 454 tests ran freshly.
- `node apps/web/tests/e2e/itinerary.e2e.mjs`: desktop/phone passed on existing build.
- `node apps/web/tests/e2e/timeline.e2e.mjs`: current source passed; live routes skipped.
- `node apps/web/tests/e2e/source-budget.e2e.mjs`: desktop 11 checks passed; phone timed out.
- `node output/e2e/bug-audit/quality-exit.cjs`: twice failed as expected; child exit 0 despite 3 FAILs.
- `node output/e2e/bug-audit/phone-budget-selector.cjs`: twice failed as expected; old button absent.
- `node apps/web/tests/e2e/phone-map.e2e.mjs`: current source 54/54 passed without browser map keys.
- `node apps/web/tests/e2e/phone-state.e2e.mjs`: current source 100/100 passed.
- Browser commands used CHANNEL=chrome, bundled PLAYWRIGHT and isolated BASE_URL overrides.

## Notes for the next person

- Fix plan-quality's missing aggregate failure exit status.
- Update source-budget's phone navigation and fact-editor entry points.
- No docs or Agent Note update needed for this diagnosis; updates accompany a future fix.
- Live models/providers, signed-in persistence and real devices remain unverified.
