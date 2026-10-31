---
date: 2026-10-31
author: Claude Code
branch: feature/TP-119-packing-checklist
pr: none
area: apps/web
contract-impact: none
---

# Travellers can tick off the packing list in Travel tips

## What changed

- `TripTips.tsx`: packing items render as checkboxes labelled by the item; ticks are saved per trip
  under `trip-packing:<tripId>` in `localStorage`.
- `timeline.css`, `phone-shell.css`: checklist rows, struck-through ticked items, 44 px rows on phone.
- `packing-checklist.e2e.mjs` and its failure inventory; `docs/workspace-ui.md` and its pair.

## Why

Ticks stay in the browser, like the folded Travel tips preference, so the shared plan contract and
saved plans do not change. Joey asked for as few tests as possible, so the E2E covers the main journey
only.

## Validation

- `DATA_MODE=mock node scripts/redgreen.mjs packing-checklist --prod -- <TripTips, CSS>`: main 1/6,
  branch passes the journey checks.
- `DATA_MODE=mock pnpm --filter @trip/web e2e packing-checklist --prod`: 23/23.

## Notes for the next person

No "Clear ticks" action; untick items one by one. Deleting a trip leaves its `trip-packing:` key.
