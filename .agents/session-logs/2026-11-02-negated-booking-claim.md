---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-282-negated-booking-claim
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# A reply that says nothing was booked is not a booking claim

## What changed

- `packages/orchestrator/src/chat/chat-grounding.ts`: `ungroundedClaim` removes negated booking phrases ("nothing was booked or reserved", "no flights were booked", "还没有预订") before testing the booking and flight-ticket claim patterns.
- `packages/orchestrator/tests/chat-plan-changes.test.ts`: one test.
- `docs/api.md` + `.zh.md`: one clause.

## Why

Live test 2026-11-02 (Queenstown, first turn): the reply became the fixed "I can't verify that requested change from the resulting itinerary." When a draft trips the booking check, the rewrite is told "Nothing was booked or reserved…", repeats it, and the word "booked" made the rewrite fail the same check, so the fixed sentence replaced it.

## Validation

- `pnpm --filter @trip/orchestrator test` 432 passed (the new test failed before the change), typecheck and lint passed.

## Notes for the next person

The negation window stops at a comma, so "Don't worry, I've booked your flights" is still a claim.
