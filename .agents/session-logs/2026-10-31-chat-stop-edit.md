---
date: 2026-10-31
author: Claude Code
branch: feature/TP-209-chat-stop-edit
pr: none
area: packages/orchestrator
contract-impact: none
---

# A stop change said in chat reaches the itinerary specialist

## What changed

- `packages/orchestrator/src/chat.ts`: coordinator tool `change_itinerary` runs the itinerary
  specialist alone on the current plan with the change as its revision, as an @ mention does, and
  returns the stops it removed and added. The prompt sends stop changes there instead of
  `replan_trip` and forbids claiming a change that was not made.
- `packages/orchestrator/src/stop-changes.ts`: the removed and added stops between two plans.
- `docs/architecture-diagrams(.zh).md`.

## Why

In the live Tokyo check, "把第3天下午14:30的五十稲荷神社换成浅草寺" without @ changed nothing
and re-ran every agent, because `replan_trip` has no way to carry a specific change.

## Validation

- `packages/orchestrator` vitest 422 passed; no new tests (Joey asked for as few as possible).
  Live check on the Mac follows the merge.

## Limitations

- The specialist still redrafts the whole itinerary; the removed and added lists show the traveller
  what moved, but code does not pin the other stops.
