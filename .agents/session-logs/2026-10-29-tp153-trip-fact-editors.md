---
date: 2026-10-29
author: Codex
branch: feature/TP-153-trip-fact-editors
pr: none
area: apps/web, docs, .agents/notes
contract-impact: none
---

# TP-153 separate Trip home fact editors from preferences

## What changed

- `TripHome` renders destination/dates/travellers/budget through `TripFactChips`; preferences stay on the action drawer.
- Fact editors Save without replanning; Replan trip is an explicit secondary once a Plan exists.
- Added `trip-fact-editors` E2E, failure inventory, save/replan Agent Note, and workspace UI docs.
- Merged integration tip `c85d5f21` before the feature commit.

## Why

#793 / TP-153 needs independent fact entries and a clear Save versus Replan split without a second fact model.

## Validation

- `LABEL=exact-34ea20c9cee598e4993348a51c2e118b66d04290 pnpm --filter @trip/web e2e trip-fact-editors` → 40/40 pass.
- Evidence: `output/playwright/trip-fact-editors/exact-34ea20c9cee598e4993348a51c2e118b66d04290/` plus runner `output/e2e/runner/2026-10-29T10-52-29-464Z.json`.
- Standards / Spec / Ponytail full reviews on `5376693f...34ea20c9`.

## Notes for the next person

Did not push, comment, or merge. Fixture browser E2E only; no live-provider or physical-device proof.
