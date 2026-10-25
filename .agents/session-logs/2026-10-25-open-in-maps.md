---
date: 2026-10-25
author: Claude Opus 5.5 (project thread)
branch: feature/TP-86-open-in-maps
pr: none
area: apps/web
contract-impact: none
---

# Open in Maps

## What changed

- `apps/web/components/trip/timeline/TimelineStop.tsx`: a stop whose place has coordinates gets an
  Open in Maps item in its ⋮ menu. It opens
  `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` in a new tab.
- `apps/web/lib/i18n/workspace-messages.ts`: zh "在地图中打开".
- `apps/web/tests/e2e/open-in-maps.e2e.mjs`: at 390 px, picks a stubbed place for the first stop through
  Replace place, then checks the menu item and the URL of the tab it opens.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`: the stop menu list.

## Why

Issue #666 (Jira TP-86): on a trip day the traveller had no way to hand a stop to their own maps app.

## Validation

- `node scripts/redgreen.mjs open-in-maps -- apps/web/components/trip/timeline/TimelineStop.tsx apps/web/lib/i18n/workspace-messages.ts`:
  before exit 1, 1/2 ok; after exit 0, 3/3 ok.
- `pnpm turbo run typecheck lint test --filter=@trip/web`: 8/8 tasks.

## Limits

Mock plans use placeholder stop names that are never looked up, so the item appears in the demo only after
the traveller picks a place. The place details card is unchanged; it already links to Google Maps.

## Docs and Agent Notes

`docs/workspace-ui.md` and its zh pair. No Agent Note.
