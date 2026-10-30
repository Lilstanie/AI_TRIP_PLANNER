---
date: 2026-10-31
author: Claude Code
branch: feature/stop-cards
pr: none
area: apps/web
contract-impact: none
---

# Itinerary stops read as cards with a place photo

## What changed

- `TimelineStop.tsx`: a 56 px thumbnail from the place's photo, removed if the image fails.
- `timeline.css`: stop cards with a border, and hover and selected states.
- `trip-home-map` E2E covers the thumbnail with a fixture photo.
- `docs/workspace-ui.md` and its Chinese pair describe the row.

## Why

Mindtrip's stop rows are cards with a thumbnail. The time column and stop dots stay, because other
journeys and Day map depend on them. The menu was already hidden until hover on desktop.

## Validation

- `pnpm --filter @trip/web e2e trip-home-map --prod`: passed, including the thumbnail.
- `pnpm --filter @trip/web exec vitest run tests/components/trip`: 3 passed.
- `check-ui-copy` passed.
- `trip-workspace-layout` fails the same two chat header checks here and on `main`; recorded in `docs/e2e-known-failures.md`.

## Notes for the next person

Thumbnails appear only in Live mode or for OpenStreetMap places, so Mock runs look text-only.
