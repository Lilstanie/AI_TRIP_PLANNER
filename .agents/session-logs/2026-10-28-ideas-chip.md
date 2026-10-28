---
date: 2026-10-28
author: Claude
branch: feature/TP-133-ideas-chip
pr: none
area: apps/web, docs
contract-impact: none
---

# Ideas as an "N ideas" chip, legs without Show distances

## What changed

- `TripEditor`: the Ideas section and Add to Ideas button became an "N ideas" chip that opens the Add to trip panel on its Ideas tab and is a drop target (hidden at zero).
- Deleted the Show distances switch, `useShowDistances`, `SHOW_DISTANCES_KEY` and the `showDistance` prop; legs always show.
- `AddToTripPanel` has one day target and an `initialTab`; strings `1 idea` and `{v0} ideas` added with zh, dead ones removed.
- New Agent Note `2026-10-28-ideas-chip.md`; "Superseded in part" lines on the itinerary-interaction, cross-day-drag and add-to-trip-panel notes.
- Docs (en and zh), glossary, new `ideas-chip` E2E with its failures inventory; ten older E2E scripts and one component test follow the chip.

## Why

Parked places took rows above the plan; the switch hid something nobody asked to hide.

## Validation

- `pnpm --filter @trip/web e2e ideas-chip --prod`: passed (desktop, phone, zh; 100+ checks, artifact in `output/playwright/ideas-chip/after/`).
- Same runner, passed after the edits: instant-edits, trip-add-stop, add-to-trip-panel, settle-path, leg-distances.
- check-entry-point, timeline, cross-day-drag (phone), itinerary-walkthrough (phone), drawer-walkthrough, itinerary and ask-ai-menus (phone) fail identically on the base commit, so their edits for the chip are unverified.
- Typecheck, lint, verify:docs, pairs, protected, e2e-selectors, e2e-artifacts, check-ui-copy and the touched Vitest files passed.

## Notes for the next person

- Idea rows no longer render, so ideas cannot be added directly, edited in place or removed from a list; restaurant suggestions can be scheduled but not dismissed. The `idea` and `suggestion` branches in `TimelineStop` are now unused.
- The chip is absent at zero ideas, so a first stop is parked from its menu, not by drag.
