---
date: 2026-10-27
author: Claude Code
branch: feature/TP-117-phone-map-empty
pr: none
area: apps/web, docs
contract-impact: none
---

# TP-117 Phone Map without a trip shows a basemap and one hint

## What changed

- `TripMapCanvas` renders the basemap and one glass hint when there is no trip; `TripMap` gained `quiet` and `center`; `useHomeBase` resolves the home city.
- Removed `LocationPrompt` and the opening location question; Show my location is the only trigger.
- `PhoneMapSheet` is hidden without a trip and collapses to handle plus one line on an empty day.
- Rewrote `phone-map-empty-hint.e2e.mjs` with its failures file; `day-stops-sheet-state` now seeds a trip through the shared `phone-map-seed.mjs`.
- Updated `docs/workspace-ui.md` and its `.zh.md` pair and added the Agent Note `2026-10-27-phone-map-empty-hint.md`.

## Why

One sentence and one action per empty screen; location is asked when it is useful.

## Validation

See the final report of the ticket for the commands run and their results.

## Notes for the next person

`phone-map-unplaced-stop` fails at the Mine language switch step; see the report.
