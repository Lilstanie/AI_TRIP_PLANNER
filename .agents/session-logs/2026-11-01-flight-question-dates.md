---
date: 2026-11-01
author: Claude Code
branch: fix/TP-248-flight-question-dates
pr: pending
area: packages/orchestrator, packages/agents
contract-impact: none
---

# Flight questions read everyday dates and reach the fare search

## What changed

- `packages/orchestrator/src/dates.ts`: `MONTH_DAY_TOKEN` and `parseMonthDay` read Chinese dates and
  dates without a year, taking the first occurrence on or after the previous date.
- `packages/orchestrator/src/flight-query.ts`: dates are removed before cities are read, and Chinese
  lead-ins and trip words stay out of city names.
- `packages/orchestrator/src/flight-answer.ts`: a Chinese route gets a Chinese reply.
- `packages/agents/src/prompts/capabilities.ts`: no longer denies fare search and live prices.

## Why

Joey asked "看一下 12 月 15 ， 悉尼到上海，1 月 5往返的航班" on the deployed site and was told flight
search is not built. SerpApi returned fares for that route from AUD 1,832.

## Validation

- `vitest run tests/flight-query.test.ts`: 4 failed before the fix; passes after it.
- Orchestrator and agents Vitest suites, typecheck and orchestrator lint pass.

## Notes for the next person

Vitest only: the 16 GB machine freezes during local builds, and Vercel is rate limited, so this has not
run on the deployed site.
