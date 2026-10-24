---
date: 2026-10-24
author: Claude Sonnet 5.5
branch: feature/TP-73-trajectory-timeline
pr: none
area: apps/web, docs
contract-impact: none
---

# Trajectory timeline, search and live tail (#669, TP-73)

## What changed

- `components/trajectory/TrajectoryToolbar.tsx`, `TrajectoryView.tsx`, `locales.ts`: hit count, previous and
  next buttons, Enter and Shift+Enter stepping through search hits in event order, wrapping.
- `TrajectoryTable.tsx` and its CSS: `data-search-hit` and `data-search-active` highlight; the pending scroll
  also runs on a timeline click or a search step, so the ledger scrolls to the record.
- `tests/e2e/trajectory-timeline.{e2e.mjs,failures.md}`: overview lanes, block click, three searches,
  stepping, no durations, and a gated stream for the live tail, in English and Chinese.
- Docs: `workspace-ui` en and zh, and the trajectory-tab Agent Note.

## Why

Before the fix, clicking an overview block selected its record but left the ledger where it was.

## Validation

- `node scripts/redgreen.mjs --base origin/feature/TP-72-trajectory trajectory-timeline -- <trajectory sources>`:
  before 8/10 ok (failed, then crashed on the missing hit counter), after 80/80 ok (1440, en and zh, mock data).
- Screenshots and `result.json` are under `output/playwright/trajectory-timeline/`.

## Notes for the next person

- The live tail already worked in the TP-72 copy; its checks pass before and after, so they are
  regression cover, not a red case.
- The flight number is searched in the traveller message; mock data has no flight results.
- The mock run has no durations to show, so the duration check scans text and attributes for time units.
