---
date: 2026-11-05
author: Claude (refinement loop)
branch: fix/TP-376-local-ttl-overflow
pr: pending
area: packages/services
contract-impact: none
---

# TP-376: process-memory expiry no longer deletes long-lived values after 1 ms

## What changed

- `packages/services/src/durable/index.ts`: the in-process store records an expiry time per key and
  drops the value when it is read after that time, instead of a `setTimeout` per key.
- `packages/services/tests/durable.test.ts`: a 30-day value is still there after 20 ms, and a 60 s
  value is gone after 61 s (fake clock). Both were written first and failed on the old store.

## Why

TP-358 (#951, this sweep) gave short-term chat turns a 30-day expiry. `setTimeout` accepts at most
2,147,483,647 ms (about 24.8 days); 2,592,000,000 ms makes Node warn `TimeoutOverflowWarning ...
Timeout duration was set to 1` and fire after 1 ms, so without Redis every chat turn was deleted
right after it was written. The dev server log showed the warning on each chat turn.

## Validation

- Before: `pnpm --filter @trip/services exec vitest run tests/durable.test.ts` — 2 failed
  (`expected undefined to deeply equal { kept: true }`, `expected { kept: false } to be undefined`).
- After: 9 passed; `tsc --noEmit` clean.

## Notes for the next person

- Expired keys are removed on the next read of that key, not proactively.
