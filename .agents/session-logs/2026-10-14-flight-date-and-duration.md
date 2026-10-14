---
date: 2026-10-14
author: Claude Code
branch: fix/flight-date-and-duration
pr: none
area: packages/orchestrator
contract-impact: none
---

# Hand mixed-ambiguity flight dates to the chat model and floor flight-row hours

## What changed

- `packages/orchestrator/src/flight-query.ts`: `parseFlightQuery` returns `undefined` when any date token is ambiguous, so the chat model asks which date was meant instead of pricing the wrong trip (#331).
- `packages/orchestrator/src/progress-tools.ts`: `flightDetail` floors the hour count, matching the other duration formatters (#332).
- Added failing-first cases to `tests/flight-query.test.ts` (ambiguous return, ambiguous departure, both ambiguous, one unambiguous slash date) and `tests/progress-tools.test.ts` (59, 60, 100, 150 and 330 minutes).

## Why

Dropping only the ambiguous token shifted the remaining date into the wrong slot. Declining the shortcut reuses the path that already asks when every date is ambiguous. The chat E2E scripts need live data, so the parser and progress-tool seams carry the regression cases.

## Validation

- New tests ran red first: the parser returned a one-way query; 59/100/150/330 minutes rendered as 1h 59m, 2h 40m, 3h 30m, 6h 30m.
- `npx vitest run` in `packages/orchestrator` — 230 tests passed after the fix.
- `pnpm typecheck` — 6 of 6 tasks passed.
- `pnpm lint` — 6 of 6 tasks passed, no ESLint warnings or errors.

## Notes for the next person

The flight row still prints `0h 59m` for sub-hour flights, as `supervisor.ts` does; the route and transit rows omit a zero hour.
