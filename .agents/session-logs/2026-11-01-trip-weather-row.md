---
date: 2026-11-01
author: Claude Code for Joey
branch: fix/TP-227-trip-weather
pr: none
area: apps/web, docs
contract-impact: none
---

# Show trip weather above each day with an animated icon (TP-227, #872)

## What changed

- `apps/web/components/trip/TripWeather.tsx`: weather row with an SVG icon picked from the weather words (sun, partly, cloud, fog, rain, snow, storm).
- `TripEditor.tsx` renders the row under the day heading; `TripTips.tsx` no longer repeats the weather sentence and the tip is labelled Packing / 行李.
- `trip-weather.css` (new, imported after `timeline.css`): row style and icon animations (global reduced-motion rule stops them).
- `packing-checklist.e2e.mjs`: one check that the weather shows once, with an icon. Docs: `workspace-ui.md` and `.zh.md`.

## Why

#872: the weather existed but sat in the fifth tip of the collapsed Travel tips block, so nobody found it. The guide stores weather as text only, so the icon comes from keywords; a per-day structured forecast would need a `packages/shared` change, left out before the Stage 2 deadline.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e packing-checklist`: 25/25 checks passed (en 1440, zh 390).
- `pnpm --filter @trip/web typecheck` passed; lint shows only the existing PhoneTrajectory warning.
- `check-ui-copy.mjs`: no added helper-copy classes.

## Notes for the next person

Keyword matching follows the Open-Meteo and mock wording; an unknown summary falls back to the partly cloudy icon.
