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

See the pull request body.

## Notes for the next person

Other English strings still carry `(s)` placeholders, for example the transport summary (`transport option(s)`), the dining candidates line and the accommodation allocation assumption in `accommodation/index.ts`. They are not changed here.
