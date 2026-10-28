---
date: 2026-10-28
author: Claude Code
branch: feature/TP-129-review-fixes
pr: none
area: apps/web, packages/orchestrator, docs
contract-impact: none
---

# Code-review fixes for the Mindtrip itinerary (spec #743, PR #752)

## What changed

- Brief draft dates follow the plan after a local edit that changes `brief.dates` (Add day, Remove day, Undo), so a later Replan keeps the added day (`lib/workspace/session.ts`).
- A mention revision keeps `dayNotes` only for days the rebuilt plan still has (`packages/orchestrator/src/workflow.ts`).
- Add day after the last day opens the new day (`useTripDay.selectDay` no longer clamps to the previous render's day count).
- Add to trip: amusement parks are Experiences, a place with no type shows under every filter, a filter that hides every result shows "No places found", and Custom start time is capped at 22:59 so the one-hour range is always valid.
- `/api/places/search` adds the kind word only when the combined query stays within 200 characters.
- Drag: a Day chip only takes a drop where it is visible (`elementsFromPoint`), not where the strip clips it.
- Walkthrough drags aim at points inside the viewport.
- Each E2E script and its failure inventory carry the new check; the orchestrator and route tests have a failure inventory written first.

## Why

Findings 1 to 8 of the review of #752 were real; the checks failed before the fixes. Finding 9 (outside pointerdown closes a Stop popover and drops typed text) is the decision of the Agent Note `2026-10-27-itinerary-interaction.md`, so it is unchanged. The touch concern (finding 8) did not reproduce over CDP: a held drag neither pans nor is cancelled, which `drag-in-day` now asserts.

## Validation

See the final report of this session for the commands run and their results.

## Notes for the next person

The earlier "snapshot after an Undo held the pre-Undo plan" is the 350 ms save debounce in `useWorkspaceStorage`: localStorage shows the old plan until it fires. 25 drag-then-Undo rounds with 30 ms polling saw no stale write after the restore.
