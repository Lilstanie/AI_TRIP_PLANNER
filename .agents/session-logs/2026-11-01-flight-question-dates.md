---
date: 2026-11-01
author: Claude Code
branch: fix/TP-248-flight-question-dates
pr: 899
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
- `packages/orchestrator/src/chat.ts`: the coordinator has a `search_flights` tool; the turn ends in
  `FlightAnswerReady`, which `apps/web/app/api/chat/route.ts` streams as a flight answer.
- `packages/agents/src/prompts/capabilities.ts`: no longer denies fare search and live prices.

## Why

Joey asked "看一下 12 月 15 ， 悉尼到上海，1 月 5往返的航班" on the deployed site and was told flight
search is not built. SerpApi returned fares for that route from AUD 1,832. The model had read the
message correctly but had no search tool: only the fixed parser could reach the fare search.

## Validation

- `vitest run tests/flight-query.test.ts`: 4 failed before the fix; passes after it.
- `vitest run tests/chat-flight-search.test.ts`: 2 failed before the tool; passes after it.
- Orchestrator, agents and chat route Vitest suites and typecheck pass.

## Notes for the next person

Vitest only, with a scripted model: no real model has chosen `search_flights` yet. The 16 GB machine
freezes during local builds, and Vercel is rate limited, so run a Chinese flight question on the
deployed site once it deploys.
