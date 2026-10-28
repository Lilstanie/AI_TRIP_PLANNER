---
date: 2026-10-28
author: Claude
branch: feature/TP-136-tips-order
pr: none
area: apps/web, packages/agents, docs
contract-impact: none
---

# Short Travel tips folded at the bottom (TP-136, #762)

## What changed

- `TripEditor`: Travel tips render after the days and the Add button, so the panel reads budget line, ideas chip, days, tips. Folded by default; the per-trip `trip-tips-folded:<tripId>` preference is unchanged.
- `TripTips`, `lib/trip/tip-text.ts`: at most five items, the first sentence of each, packing as one comma (Chinese: enumeration comma) line.
- `destination-guide`: output holds at most five one-sentence tips (one attraction, customs, safety, entry and health, weather and packing), packing at most four short items, the cross-month scope inside the sentence, the official-source verify caution moved to the assumptions. The prompt asks for a leading short sentence.
- `short-travel-tips` E2E and failure inventory; `trip-ui-triage` and `weather-packing` wording of the packing check; two existing destination-guide unit assertions follow the new contract; `docs/workspace-ui`, `docs/architecture` (en, zh where paired).

## Why

Joey found the tips a wall of text between the budget and the plan. The plan type is unchanged, so old plans are shortened at render time.

## Validation

See the pull request body for the commands run and results.

## Notes for the next person

Weather text for several cities now shows only the first city's sentence in the tip.
