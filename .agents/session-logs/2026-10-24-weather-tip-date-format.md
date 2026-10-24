---
date: 2026-10-24
author: Claude Haiku 5.5 (scheduled triage task)
branch: fix/weather-tip-date-format
pr: none
area: packages/agents, packages/orchestrator, apps/web
contract-impact: none
---

# Weather tip lines show dates as "Tue, 15 June" instead of ISO dates

## What changed

- `packages/agents/src/destination-guide/weather-evidence.ts`: `weatherText` formats each day with an
  `en-AU` `Intl.DateTimeFormat` (UTC), so both forecast and unavailable lines read `Tokyo, Tue, 15 June`.
- `packages/orchestrator/tests/trip-weather-coverage.e2e.test.ts` and `weather-packing.e2e.test.ts`:
  expectations switched from ISO dates to the formatted day text.
- `apps/web/tests/e2e/weather-packing.e2e.mjs`: visible-text check switched to the formatted day text.

## Why

Issue #638: the Travel tips weather text was the one place on the Trip tab that showed `YYYY-MM-DD`.
Structured `weatherEvidence` input keeps ISO dates; only the prose changes.

## Validation

- `pnpm --filter @trip/orchestrator exec vitest run tests/trip-weather-coverage.e2e.test.ts tests/weather-packing.e2e.test.ts`: 2 files, 5/5 passed.
- `pnpm --filter @trip/agents test`: 15 files, 147/147 passed.
- `pnpm turbo run typecheck --filter=...@trip/agents`: 3/3 tasks successful.
- `DATA_MODE=mock pnpm --filter @trip/web e2e weather-packing`: 16/16 checks ok (1440 and 390, en and zh).
- `pnpm exec prettier --write` on the four changed files.

## Notes for the next person

- Weather text is generated in English by the agents package and is not localised; the zh UI shows the English day text.
- Not run: full repository suite, `pnpm build`, `verify:docs` (no docs changed).
