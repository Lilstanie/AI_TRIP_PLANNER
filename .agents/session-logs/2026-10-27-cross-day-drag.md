---
date: 2026-10-27
author: Claude Code (Sonnet 5.5)
branch: feature/TP-127-cross-day
pr: none
area: apps/web, docs
contract-impact: none
---

# Drag stops across days and to or from Ideas (TP-127, #749)

## What changed

- `TripEditor.tsx`, `DayStrip.tsx`, `useItineraryDrag.ts`, `drag-target.ts`, `timeline.css`: day tabs and
  Ideas are drop targets, hovering a tab opens its day, Ideas sits above the day strip and is always shown.
- `item-actions.ts`: a parked Stop goes last in Ideas.
- `cross-day-drag.failures.md` and `cross-day-drag.e2e.mjs`, written before the code; docs and an Agent Note.

## Why

See the Agent Note `2026-10-27-cross-day-drag`.

## Validation

See the handback report for the commands run and their results.

## Notes for the next person

An Idea lands at the end of a day. The dragged row is not drawn after a hover opens another day.
