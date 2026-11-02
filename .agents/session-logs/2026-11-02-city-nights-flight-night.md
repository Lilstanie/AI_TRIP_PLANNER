---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-279-city-nights-flight-night
pr: none
area: packages/agents, docs
contract-impact: none
---

# Asked city nights survive the night spent flying

## What changed

- `packages/agents/src/transport/legs.ts`: `cityStartDays` gives spare nights to the first city when every city has asked nights that add up to fewer than the trip has, instead of falling back to an even split.
- `packages/agents/tests/transport/legs.test.ts`: one test (Sydney to London and Paris, 12 days, London 4 / Paris 6).
- `docs/architecture-diagrams.md` + `.zh.md`: one clause.

## Why

Live test 2026-11-02 (EU trip): after "one more day in Paris, one less in London" the brief held London 4 / Paris 6, but stays stayed 5/5, the hop stayed on day 7, and the reply claimed the change. The first night is spent on the flight, so asked nights sum to 10 against 11 trip nights.

## Validation

- `pnpm --filter @trip/agents test` 209 passed, `pnpm --filter @trip/orchestrator test` 430 passed; the new test failed before the fix.

## Notes for the next person

When asked nights exceed the trip, the even split still applies.
