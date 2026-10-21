---
date: 2026-10-21
author: Codex
branch: fix/calendar-visible-trip-identity
pr: 499
area: apps/web, docs
contract-impact: none
---

# Make compact calendar trip identities readable

## What changed

- `TripsPage.tsx` renders compact duplicate labels as `#1`, `#2` markers.
- `workspace-trips.css` styles the markers with a contrasting badge and 13px text.
- The calendar E2E requires the exact markers and measures glyph bounds inside each phone bar at 390px and 375px.
- Updated the paired workspace UI docs.

## Why

The screenshot reviewed on #495 showed both destination labels clipped before their distinguishing suffixes. A compact badge makes the unique number readable at a glance.

## Validation

- Integrated Chrome E2E passed 33 assertions at 1440px, 390px and 375px; runner artifact `output/e2e/runner/2026-10-21T04-33-29-249Z.json`.
- Screenshots: `output/playwright/calendar-trip-identity-search/integrated-visible-marker/calendar-390.png`, `calendar-375.png`, `calendar-1440.png`.
- Web tests: 57 files, 642 tests passed. Web typecheck and lint passed.
- `verify:docs`, `verify:protected`, `verify:pairs`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `format:check-changed`, Prettier and the scoped added-comment check passed.

## Notes for the next person

Screenshots and runner evidence remain in ignored `output/` until the parent uploads or quotes them. Browser journey uses local fixtures and mock mode; it does not verify live providers, authentication or physical devices.
