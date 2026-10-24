---
date: 2026-10-25
author: Claude Opus 5.5 (project thread)
branch: fix/TP-80-weather-unavailable-once
pr: none
area: packages/agents
contract-impact: none
---

# Weather unavailable once per city

## What changed

- `packages/agents/src/summary-copy.ts`: `weatherUnavailable(city, dates)` in English and Chinese lists
  every day without weather in one sentence.
- `packages/agents/src/destination-guide/weather-evidence.ts`: `weatherText` keeps a line per forecast
  day and groups each city's unavailable days into one line, placed at the first missing day.
- `apps/web/tests/e2e/weather-unavailable-once.e2e.mjs`: Melbourne → Sydney · 5 days in English and
  Chinese; the Travel tips show the unavailable statement once.
- `docs/architecture.md` and `docs/architecture.zh.md`: one sentence.

## Why

Issue #684 (Jira TP-80): a 5-day trip printed "weather unavailable; check a current forecast before
travel" five times.

## Validation

- `node scripts/redgreen.mjs weather-unavailable-once -- packages/agents/src/summary-copy.ts packages/agents/src/destination-guide/weather-evidence.ts`:
  before exit 1, 4/6 ok (5 statements); after exit 0, 6/6 ok (1 statement).
- `pnpm --filter @trip/agents test` 150 passed, `pnpm --filter @trip/orchestrator test` 315 passed.

## Docs and Agent Notes

`docs/architecture.md` and its zh pair. No Agent Note.
