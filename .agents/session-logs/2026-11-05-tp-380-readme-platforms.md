---
date: 2026-11-05
author: Claude Code (for Joey, member C)
branch: docs/TP-380-readme-platforms
pr: none
area: docs
contract-impact: none
---

# Redesign README around the three platforms, with live screenshots

## What changed

- `README.md` and `README.zh.md`: centred header (icon, tagline, language and platform badges),
  screenshot wall, Features, Platforms with per-platform Install, a parts table under How it works,
  Build from source. The Stage 2 report section and burn-down are copied unchanged.
- `docs/readme/*.png`: seven screenshots of a live Kyoto plan in the Mac app layout (light and dark)
  and the iPhone app layout (Chat, Trip, Map, Mine), taken with Playwright on Joey's Mac.

## Why

Joey asked for the README to follow the layout of his `suiji-notes` README and to show the Mac and
iPhone apps. Cloud mock data shows only "Mock attraction" rows and a blank map, so the shots use live
data on a local server.

## Validation

- `pnpm verify:docs`: Agent Notes, skills and Markdown links are valid.
- `pnpm verify:pairs`: Checked 35 documentation pairs against origin/main.
- `pnpm verify:protected`: Protected-file rules hold relative to origin/main.

## Notes for the next person

The local Google key is expired and public Overpass refused automated lookups, so the screenshots
show the live flight, hotel and OSM map but no named sights or map pins. Retake them with
`MAPS_PROVIDER=osm` plus `GEOAPIFY_API_KEY`, or a working Google key, for a fuller itinerary.
