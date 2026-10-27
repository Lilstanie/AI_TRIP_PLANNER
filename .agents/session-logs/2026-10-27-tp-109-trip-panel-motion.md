---
date: 2026-10-27
author: Claude Code
branch: feature/TP-109-trip-panel-motion
pr: none
area: apps/web, docs
contract-impact: none
---

# Trip panel disclosures share one expand/collapse motion

## What changed

- `app/styles/motion.css`: `disclosure` primitive (height and opacity, shared duration and easing, instant under reduced motion).
- `TripPanel.tsx`, `TripTips.tsx`: budget breakdown and Travel tips use it.
- New `trip-panel-motion.e2e.mjs` and `.failures.md`; docs and zh pair updated; Agent Note added.

## Why

See [the note](../notes/implemented/feature/2026-10-27-trip-panel-disclosure-motion.md).

## Validation

See the pull request evidence; commands are listed in the final report of this ticket.

## Notes for the next person

`itinerary`, `drawer-walkthrough` and `phone-map` E2E fail on the integration tip before this change too.
