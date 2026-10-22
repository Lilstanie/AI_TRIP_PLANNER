---
date: 2026-10-23
author: Claude Haiku 5.5 (scheduled triage run for Joey)
branch: fix/stay-summary-plurals
pr: none
area: packages/agents
contract-impact: none
---

# Pluralise the English stay summary

## What changed

- `packages/agents/src/summary-copy.ts`: English `stays` and `bookedStay` use a `plural(count, one, many)` helper instead of the literal `room(s)` and `night(s)` placeholders. Chinese copy is unchanged.
- `packages/agents/tests/summary-copy.test.ts`: the pinned English expectations now read `1 room, 4 nights` and `3 nights`, with one-room and one-night cases added to the same test.

## Why

Issue #601: the Stay card read `1 room(s), 3 nights in Sydney`. The issue names `packages/agents/src/accommodation/index.ts`, but the template lives in `summary-copy.ts`; the accommodation agent only calls it.

## Validation

- `pnpm --filter @trip/agents exec vitest run tests/summary-copy.test.ts`: 5 passed; the updated expectations fail against the old source.
- `pnpm --filter @trip/agents test`: 14 files, 144 tests passed.
- `pnpm --filter @trip/agents typecheck` and `lint`: pass.
- `LABEL=after node tests/e2e/stay-summary-plural.e2e.mjs` (apps/web, mock data, Sydney example): the Stay card reads `1 room, 3 nights in Sydney · AUD 690.00`; exit 0. With the old source, the same script fails on `1 room(s), 3 nights in Sydney`; exit 1.
- `pnpm verify:docs`, `pnpm verify:protected`: pass.

## Notes for the next person

Other English strings still carry `(s)` placeholders, for example the transport summary (`transport option(s)`), the dining candidates line and the accommodation allocation assumption in `accommodation/index.ts`. They are not changed here.
