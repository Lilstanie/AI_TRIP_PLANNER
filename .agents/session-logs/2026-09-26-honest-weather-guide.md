---
date: 2026-09-26
author: Claude Code
branch: fix/honest-weather-guide
pr: none
area: packages/tools, packages/agents, apps/web/tests, docs
contract-impact: none
---

# Real climate data after 14 days; destination guide no longer falls back on long summaries

## What changed

- `packages/tools/src/weather.ts`: in live mode a date beyond the forecast window returns the same
  week of the last three years from the Open-Meteo historical archive, instead of a hemisphere-and-
  month fixture labelled as a provider. Mock mode still uses the mock fixture.
- `packages/agents/src/destination-guide/index.ts`: the model schema has no length limits;
  `fitDraft` clips prose at a sentence end and slices arrays before the strict schema. Open-Meteo
  results are labelled `live`.
- `apps/web/tests/e2e/plan-quality.e2e.mjs`: checks the guide is model-written and that no live
  tool result is a fixture.
- `docs/development.md`: weather provider table.

## Why

Every live run reported "Seasonal climate fixture" weather (Bali in October as "cooler") under an
`estimated` label. The guide fell back in 4 of 9 runs: the model wrote a 414–465 character summary
against a 400 limit, and the retry reused the failed call id, so the agent ended with no result.

## Validation

- `@trip/tools` 113 and `@trip/agents` 117 tests pass; `tsc --noEmit` clean in both.
- `RUNS=3 node apps/web/tests/e2e/plan-quality.e2e.mjs` (live): 9/9 pass; guide model-written and
  `live` from the Open-Meteo archive in every run.

## Notes for the next person

Other specialists use the same strict `max()` structured output and may hit the same retry trap.
