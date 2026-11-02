---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-272-fare-per-person
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# Flight answers show the currency code and a per-person share

## What changed

- `packages/orchestrator/src/chat/flight-answer.ts`: amounts use `formatMoney` (`AUD 5,678.00`, not `$5,678.00`); more than one traveller adds the per-person share in both languages.
- `docs/architecture.md` + `.zh.md`: one sentence.

## Why

Live test 2026-11-02: a family of four asked "机票多少钱一个人" and got only "$5,678.00" for the whole party.

## Validation

- `pnpm --filter @trip/orchestrator test` 430 passed (existing reply regexes match the unchanged prefix).

## Notes for the next person

none
