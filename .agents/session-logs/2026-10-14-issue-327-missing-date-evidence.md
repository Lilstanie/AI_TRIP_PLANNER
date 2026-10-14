---
date: 2026-10-14
author: Codex
branch: fix/issues-323-330
pr: none
area: packages/tools
contract-impact: none
---

# Close missing-date weather evidence gap

## What changed

- Added live-provider regression cases proving Google and Open-Meteo reject a successful response
  that omits the requested date, without returning a forecast.

## Why

Failure inventory: either provider may omit the requested local calendar date or return unrelated
dates; network errors must remain visible; no fixture, neighboring date, or historical climate may
be presented as live forecast evidence.

## Validation

- `pnpm --filter @trip/tools exec vitest run tests/weather.test.ts` — passed (15 tests).
- `pnpm --filter @trip/tools test` — passed (142 tests); `pnpm --filter @trip/tools typecheck` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, added-comment check, and `git diff --check` — passed.

## Notes for the next person

- This follows the #327 review fix in `2026-10-14-issue-326-327-review-fixes.md`; that frozen log was not edited.
