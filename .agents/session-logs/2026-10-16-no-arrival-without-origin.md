---
date: 2026-10-16
author: Claude Opus 5.5
branch: fix/no-arrival-without-origin
pr: pending
area: packages/agents, docs, GLOSSARY.md
contract-impact: none
---

# No arrival journey without a departure city (issue #397)

## What changed

- `packages/agents/src/transport/legs.ts`: `journeyLegs` no longer adds a `<destination> airport → <destination>` ground leg when the origin is missing or equals the only destination.
- `packages/agents/tests/transport/legs.test.ts` and `index.test.ts`: the two existing cases that asserted the airport transfer now assert no arrival journey.
- `apps/web/tests/e2e/no-arrival-without-origin.e2e.mjs`: new E2E covering no origin, origin equal to the destination, and origin Melbourne.
- `GLOSSARY.md`: new term **Journey** (travel between cities), distinct from **Leg** (within one day).
- `docs/architecture.md` and `.zh.md`: the no-arrival rule.

## Why

Decided with the owner: a trip with no departure city has no arrival; Day 1 starts with its first activity. The [journey-legs note](../notes/implemented/feature/2026-09-22-journey-legs-and-trip-origin.md) set up the leg list and origin field but did not decide the airport transfer, so no implemented decision is reversed.

## Validation

- `node tests/e2e/run.mjs no-arrival-without-origin` without the fix: both no-arrival cases FAIL with the invented transfer; the Melbourne case then hit the 240 s mock-reply timeout.
- Same command with the fix: 10/10 checks passed.
- `pnpm --filter @trip/agents exec vitest run`: 126 passed. `pnpm --filter @trip/orchestrator test`: 249 passed. `pnpm --filter @trip/web test`: 632 passed.
- `pnpm turbo run typecheck --filter=...@trip/agents`: 3 successful. `pnpm lint`: 6 successful.
- `pnpm verify:e2e-artifacts`, `verify:e2e-selectors`, `verify:pairs`, `verify:docs`: pass.

## Notes for the next person

- A "no accommodation needed" option is tracked separately in #408.
