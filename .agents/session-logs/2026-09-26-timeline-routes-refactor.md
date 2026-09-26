---
date: 2026-09-26
author: Claude Code
branch: refactor/timeline-routes
pr: none
area: apps/web, docs
contract-impact: none
---

# Rebuild the Timeline & routes tab; fix drawer glass and fake chat busy state

## What changed

- `apps/web/components/trip/TripEditor.tsx` now composes `components/trip/timeline/`: `useTimelineEdits`
  (requests, preview, undo, routes), `DayStrip`, `TimelineStop` (row plus editor), `TimelineParts`
  (fixed rows, connections) and `EditPreviewPanel`; `lib/trip/timeline.ts` derives each day's rows.
- A stop matched on the map can be confirmed in one click ("Use this place"); route checks and
  moves need confirmed places, which before could only be set by searching every stop by hand.
- `app/styles/timeline.css` replaces the old editor rules in `trip.css`, `workspace-drawers.css`
  and `workspace-responsive.css`; `forms.css` exempts the day and stop buttons from pill styling.
- `app/styles/motion.css`: `.workspace-main` is named for view transitions only while one runs.
- `ChatPanel` takes `locked` for a pending edit instead of `busy`.
- `lib/trip/trip-edit.ts`: plain-language routing blocker; differences name the stop, not its text.
- `tests/e2e/timeline.e2e.mjs` (new); existing component tests follow the new labels.

## Why

The tab was a flat dump of text and controls. A permanent `view-transition-name` made the drawer's
glass stop blurring the chat behind it, and a pending edit showed "Preparing your request" and a
stop button in the chat though no request ran.

## Validation

- `pnpm --filter @trip/web test`: 371 passed; `tsc --noEmit` and `pnpm --filter @trip/web lint` clean.
- `CHANNEL=chrome LABEL=after node apps/web/tests/e2e/timeline.e2e.mjs`: 28 checks pass — day tabs,
  select and edit, time preview, apply and undo, move to another day, search and confirm places,
  route check with checked journeys, no fake chat busy state, no side scroll or console errors at
  1440 and 390 px in light and dark. Before/after screenshots under `output/playwright/timeline/`.

## Notes for the next person

Accommodation splits nights evenly and ignores transport's hop day (Tokyo & Kyoto: Tokyo hotel
until day 5, Kyoto from day 3). Activity costs are still often AUD 0.
