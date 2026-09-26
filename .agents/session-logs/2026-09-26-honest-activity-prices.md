---
date: 2026-09-26
author: Claude Code
branch: fix/honest-activity-prices
pr: none
area: packages/agents, apps/web, packages/orchestrator/tests, docs
contract-impact: none
---

# Stop inventing activity prices

## What changed

- `packages/agents/src/itinerary/index.ts`: activities carry no `estCost`; a model's figure is
  dropped, the activity-cost guardrail and the fallback's per-stop allowance are gone, and the
  proposal says how many stops are unpriced.
- `apps/web/components/trip/TripPanel.tsx`: the budget card notes the unpriced stops;
  `ProposalDetails` says "Price unknown" like the timeline.
- Tests: the two itinerary tests that locked invented prices now check none is passed on; the demo
  total drops the old AUD 420 allowance; ProposalDetails copy.
- `apps/web/tests/e2e/plan-quality.e2e.mjs`: fails on any priced activity.
- Docs: `docs/architecture.md`, `docs/workspace-ui.md`.

## Why

Google Places returns no price for attractions (checked: Tokyo Tower, Skytree, Meiji Jingu), so
every activity price was the model's guess: AUD 0 for most, 300 for a free shrine. The cost
guardrail on those guesses also caused rejected drafts and retries.

## Validation

- Full `pnpm test` passes after the updates; typecheck and lint clean.
- `ONLY=tokyo-couple,bali-solo RUNS=1` (live): 2/2 pass, no priced activity.
- `LABEL=prices node apps/web/tests/e2e/timeline.e2e.mjs`: 28 checks pass; screenshot shows the note.

## Notes for the next person

A ticket-price source (see the api-scout skill) could price paid attractions later.
