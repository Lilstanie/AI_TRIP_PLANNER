---
date: 2026-10-07
author: Claude Code (for Joey)
branch: feature/trip-display-currency
pr: 229
area: apps/web, packages/agents, docs
contract-impact: none
---

# Review fixes for the trip display currency (PR #229)

## What changed

- `apps/web/lib/trip/trip-edit.ts`: `EditRequest.displayCurrency`; a swapped stay's sentence, the conflicts
  recomputed by `settle` and the before/after use the trip's effective currency instead of AUD.
- `useChooseCandidate.ts`, `useTimelineEdits.ts`: send the Settings currency with every edit request.
- `packages/agents`: stay and transport unit notes ("per room per night", "All amounts are ...") name the
  display currency and add `estimateNote()`; the stay and transport prompt budgets label `maxTotalCost` as AUD.
- `trip-display-currency.e2e.mjs`: new API checks, red before the fix; `docs/api(.zh).md`; the Agent Note.

## Why

The first review found the editor and the static notes still wrote AUD in a CNY trip. Planning, guardrails
and stored amounts stay AUD.

## Validation

See the final commit message and the review report; commands were run, not assumed.

## Notes for the next person

- `timeline.e2e.mjs` fails the same way on origin/main (503 console errors, "Use" button timeout), so it is
  not a regression of this branch.
