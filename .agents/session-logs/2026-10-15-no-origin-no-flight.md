---
date: 2026-10-15
author: Claude Sonnet 5.5
branch: fix/no-origin-no-flight
pr: none
area: packages/agents
contract-impact: none
---

# A trip with no departure city plans no long-haul flight

## What changed

- `packages/agents/src/transport/index.ts`: with no brief origin and no `transport.origin` preference, the
  origin is the first destination instead of the hard-coded "Sydney". `journeyLegs` then plans no arrival
  flight, matching the Where sheet hint "Leave blank to plan the destination only, without long-haul flights."
  The origin assumption line says so.
- `packages/agents/tests/transport/index.test.ts`, `model-boundary.test.ts`: fixtures that relied on the
  Sydney default now state `origin: "Sydney"`; the preference-fallback test sets `origin: undefined`.
- `apps/web/tests/e2e/no-origin-no-flight.e2e.mjs`: new E2E. Plans "a 3-day trip to Tokyo" with no
  departure city and checks the reply and Trip tab show no Sydney leg and no flight.

## Why

Issue #359: a blank departure city still produced a Sydney → Tokyo flight priced into the budget. The owner
decided that a trip without a stated origin gets only the destination plan, with no prompt for a city.

## Validation

- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= pnpm --filter @trip/web e2e no-origin-no-flight`
  with the old source: 3 of 5 checks passed (the flight and Sydney-leg checks failed). With the fix: 5 of 5.
- `npx vitest run` in `packages/agents`: 12 files, 125 tests passed. `pnpm turbo run typecheck --filter=...@trip/agents`: pass.
- `pnpm --filter @trip/agents lint`, `pnpm --filter @trip/web lint`: clean. `pnpm --filter @trip/web test`: 631 passed.

## Notes for the next person

- The `transport.origin` preference still wins over the first-destination fallback.
- A single-destination trip with no origin plans a ground airport-to-city leg, as a trip from the destination itself does.
- `docs/design/stage1/` still describes the Sydney fallback; that package is submitted and was not edited.
