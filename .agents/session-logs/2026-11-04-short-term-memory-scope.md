---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/short-term-memory
pr: pending
area: packages/services, apps/web
contract-impact: none
---

# Short-term chat memory expires and stays per account

## What changed

- `packages/services/src/memory/index.ts`: each short-term write sets a 30-day expiry
  (`SHORT_TERM_TTL_SECONDS`), so a trip's 20 turns no longer stay in Redis forever.
- `apps/web/lib/account/memory.ts`: a signed-in traveller's short-term turns are keyed by account and
  trip; signed-out turns keep the trip-only key.
- Tests written before each fix: `packages/services/tests/durable.test.ts` (the `set` carries `EX`),
  `apps/web/tests/lib/account/short-term-scope.test.ts` (another account with the same trip id
  reads nothing).
- `docs/architecture.md` and its Chinese pair describe the expiry and the account key.

## Why

The key was `trip:memory:short:<tripId>` with no expiry. Every new trip left a key behind, and two
accounts that sent the same trip id read each other's turns as model context.

## Validation

- Services test: failed before (`[ 'EX', 'undefined' ]` expected, the `set` had no expiry), 7/7 after.
- Web test: failed before (account B read account A's turn), 2/2 after.

## Notes for the next person

- Signed-in travellers' existing turns move to a new key on deploy; the next turn falls back to the
  visible conversation the client already sends (`history`).
- Not fixed: the append is still read-modify-write, so two concurrent turns on one trip can drop one.
