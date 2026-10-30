---
date: 2026-10-31
author: Claude Code
branch: fix/TP-175-serpapi-flight-group-price
pr: none
area: packages/tools
contract-impact: none
---

# Stop doubling SerpApi flight fares for a group

## What changed

- `packages/tools/src/serpapi.ts`: `searchFlightsSerpApi` uses Google Flights' `price` as the group
  total instead of multiplying it by `passengers` again.
- Existing tests in `serpapi.test.ts`, `booking.test.ts` and `provider-matrix.e2e.test.ts` now stub
  the provider's group price.
- SerpApi Agent Note and the review-trip-planner conversion rule state the real provider contract.

## Why

A real-model, all-live trip (Sydney to Tokyo, 2 adults) on main returned 1,919 AUD for one adult and
3,838 AUD for two from SerpApi; the adapter showed 7,676. The fake overspend dropped the dining budget
to zero and pushed the hotel out of Shinjuku.

## Validation

- `pnpm --filter @trip/tools exec vitest run tests/serpapi.test.ts` with only the test changed:
  1 failed (900 expected, 1800 received); after the fix the whole package passes, 141/141.

## Notes for the next person

The return-leg call reads only the leg, not the price, so it needed no change.
