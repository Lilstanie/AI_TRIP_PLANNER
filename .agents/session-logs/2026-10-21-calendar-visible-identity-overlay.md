---
date: 2026-10-21
author: Codex
branch: fix/calendar-visible-trip-identity
pr: 499
area: apps/web, docs
contract-impact: none
---

# Keep compact calendar identity markers visible above phone navigation

## What changed

- The calendar E2E scrolls the mine panel enough to expose the final duplicate marker.
- The E2E asserts rendered marker glyphs fit within each event bar and above the fixed phone tab bar.
- The failure inventory documents the tab-bar overlap case.

## Why

Review of the previous phone screenshot showed the bottom marker could be obscured by fixed navigation at the initial scroll position. The refreshed evidence captures a readable state and guards its visible bounds.

## Validation

- `CHANNEL=chrome LABEL=integrated-final-upload pnpm --filter @trip/web e2e calendar-trip-identity-search` passed at 1440px, 390px and 375px, including duplicate identity and bar/tab-bar glyph bounds; runner artifact `output/e2e/runner/2026-10-21T05-03-08-158Z.json`.
- Screenshots: `output/playwright/calendar-trip-identity-search/integrated-final-upload/calendar-390.png`, `calendar-375.png`, and `calendar-1440.png`.
- Web tests passed: 57 files, 642 tests. Web typecheck, lint, docs, pairs, protected files, E2E selectors/artifacts, changed-file formatting, Prettier and scoped added-comment check passed.

## Notes for the next person

The browser journey uses local fixtures and mock mode; it does not verify live providers, authentication or physical devices. Keep screenshot and runner evidence until the parent uploads or quotes it.
