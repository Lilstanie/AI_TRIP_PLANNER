---
date: 2026-10-02
author: Claude
branch: fix/weather-test-pinned-clock
pr: none
area: packages/tools
contract-impact: none
---

# Pin the clock in the weather provider-failure test

## What changed

- `packages/tools/tests/weather.test.ts`: the "surfaces provider failures" test now sets the system time to
  2026-09-21 like the other tests in the file.

## Why

The test's query targets 2026-10-01 and did not set a clock, so from 2026-10-02 the date was in the past
and validation rejected it before the mocked 503 was reached. `@trip/tools#test` failed on `main` and on
every branch, including the CI run of #119.

## Validation

- Reproduced locally: 1 failed, 4 passed in `weather.test.ts`. After the change `pnpm --filter @trip/tools test`
  passes (9 files, 113 tests).
- `pnpm verify:docs` and `pnpm verify:protected`: see below.

## Notes for the next person

Other tests in the repository may also depend on the real date; this one was found only because CI failed.
