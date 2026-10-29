---
date: 2026-10-30
author: Codex
branch: feature/TP-156-trip-calendar
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Integrate TP-155 panels and finish Trip Calendar

## What changed

- Merged tip `7473c09c` (#795 action panels) onto preserved Calendar commit `673c9b7e`.
- Fixed Undo so adding a time to an untimed activity restores All day, and anchored the Month
  weekday header to `weekStart(visibleMonth)`.
- Updated paired Calendar research rows in `docs/design/mindtrip-interactions.md(.zh)`.
- Kept Calendar click-to-edit on the shared Itinerary editor; no drag-reschedule.

## Why

Parent required Calendar on the #795 tip without discarding either side. Research still called
Calendar read-only after Week/Month shipped.

## Validation

- Undo red/green and Month-header red/green retained under `/tmp/tp156-*.log` and
  `output/playwright/trip-home-calendar/`.
- Exact-HEAD Calendar E2E, typecheck, lint, docs/pairs/protected/format/E2E gates and three
  independent reviews run on the committed HEAD that includes this log; paths recorded for parent.

## Notes for the next person

Evidence is fixture/browser only. Do not push or merge; parent owns tip integration.
