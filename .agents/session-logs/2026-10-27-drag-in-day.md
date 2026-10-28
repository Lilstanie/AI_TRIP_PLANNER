---
date: 2026-10-27
author: Claude Code (Sonnet 5.5)
branch: feature/TP-126-drag-in-day
pr: none
area: apps/web, docs
contract-impact: none
---

# Drag a Stop within its day with an insertion line (TP-126, #748)

## What changed

- `components/trip/useItineraryDrag.ts` and `lib/trip/drag-target.ts`: pointer drag for mouse and touch.
- `TripEditor.tsx`, `TimelineStop.tsx`, `timeline.css`: insertion line, row drag props, Alt+Arrow
  reorder with a live region; native `draggable` removed.
- `workspace-messages.ts`: one new announcement string with its Chinese text.
- `drag-in-day.failures.md` and `drag-in-day.e2e.mjs`, written before the code; docs and an Agent Note.

## Why

Native drag and drop has no touch support or insertion line. See the Agent Note `2026-10-27-drag-in-day`.

## Validation

See the handback report for the commands run and their results.

## Notes for the next person

#749 extends `accepts` and `onDrop`. The Move earlier and Move later menu items are left for #746.
