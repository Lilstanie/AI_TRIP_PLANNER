---
date: 2026-11-01
author: Claude Code (for Joey)
branch: feature/TP-243-multi-stop-mock
pr: none
area: packages/tools, docs
contract-impact: none
---

# Mock plans have three stops a day with transport rows between them (TP-243)

## What changed

- `packages/tools/src/maps-port.ts`: with `MOCK_PLACES=multi` (read once into `ToolRuntimeConfig.mockMultiStop`), mock places return a fixed list per category (9 sights,
  2 museums, 5 restaurants, `Mock <place>, <city>`) after the old `Mock attraction near <city>`;
  a route between two mock places is a 20-minute transit leg (other mock routes stay a 140-minute train).
- `docs/development.md` (+ zh) and `ui-verification` describe the flag.
- Opt-in because the multi-stop default changed Agent Lab benchmark rounds and conflicts in
  `@trip/orchestrator` tests (CI run 1); the default mock stays as before.

## Why

Mock planning returned one place, so every day had one identical stop and no transport rows; UI
threads built their own multi-stop trips (retro 2026-11-01, item D).

## Validation

- Production build with `MOCK_PLACES=multi`, mock mode, no model key, `POST /api/chat` plan for Melbourne→Sydney (4 days) and
  Sydney→Tokyo (5 days): main gave 1 stop a day, the same stop every day; the branch gives 3 a day,
  no repeats over 5 days, and the "plan reuses the same stop" reply lines are gone.
- Browser at 1440 × 1000: the Trip panel shows three stops on Day 1 with transit rows between them.
- Without the flag: `pnpm --filter @trip/orchestrator test` 422 passed (was failing with the default
  changed); `@trip/tools` 173, `@trip/agents` 207, `@trip/web` 662 passed; typecheck and lint clean.
- `pnpm --filter @trip/web e2e run chat-generation new-chat` could not start: the container's
  Playwright browser build is missing (`headless_shell-1194`). CI runs the journeys.

## Notes for the next person

Day 1 still shows a geography conflict (morning stop ends 12:00, lunch 12:15, leg 20 min + 15 buffer).
That is the itinerary's fixed slots, not the fixture.
