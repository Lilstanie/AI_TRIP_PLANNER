---
date: 2026-10-14
author: Codex
branch: fix/foreign-currency-tolls
pr: none
area: packages/tools, packages/agents
contract-impact: none
---

# Preserve partial foreign toll cost in transport plans

## What changed

- `packages/tools/src/route-options.ts` labels AUD toll totals as partial whenever quoted foreign-currency tolls are excluded.
- `packages/agents/tests/transport/foreign-currency-tolls.e2e.test.ts` verifies the ToolGateway-to-plan route and saves provider, route-option, and plan evidence under ignored `output/e2e/foreign-currency-tolls/`.

## Why

A route could be marked as partially priced while its chosen plan detail omitted that fact. The route and plan now communicate the same cost boundary and preserve the foreign quote as excluded from the AUD total.

## Validation

- `pnpm --filter @trip/agents test` — 12 files, 125 tests passed.
- `pnpm --filter @trip/tools test` — 11 files, 140 tests passed.
- `pnpm --filter @trip/agents typecheck` and `pnpm --filter @trip/tools typecheck` — passed.
- `pnpm verify:docs` and `pnpm verify:protected` — passed.
- `pnpm exec prettier --check packages/tools/src/route-options.ts packages/agents/tests/transport/foreign-currency-tolls.e2e.test.ts` and `git diff --check` — passed.

## Notes for the next person

- No docs or Agent Note update is needed; this change clarifies existing route-price semantics without changing a shared contract.
- The synthetic provider response and resulting route/plan evidence are retained in the ignored output directory for repeatable inspection.
