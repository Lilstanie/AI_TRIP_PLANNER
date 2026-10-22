---
date: 2026-10-22
author: Claude Code
branch: fix/phone-map-unplaced-stop
pr: none
area: apps/web, docs
contract-impact: none
---

# Phone Map Day stops rows lead with the place name

## What changed

- `apps/web/components/workspace/PhoneMapSheet.tsx`: each row's title is the stop's place name
  (`location`, else `detail`), like the Trip tab; the secondary line is the start time. A stop with
  no map number drops the empty circle and says "Not found on the map" in that line (#541).
- `apps/web/tests/e2e/phone-map-unplaced-stop.e2e.mjs` and its `.failures.md`, in English and Chinese.
- `apps/web/tests/e2e/timeline.e2e.mjs`: reads the row name from the new `.phone-map-sheet__title`.
- `docs/workspace-ui.md` and its Chinese pair.

## Why

The sheet and the Trip tab disagreed about what a stop is called, and the row's accessible name was
the whole description paragraph. The description stays on the Trip tab.

## Validation

- `node scripts/redgreen.mjs phone-map-unplaced-stop -- apps/web/components/workspace/PhoneMapSheet.tsx`:
  before exit 1, 4/12 ok; after exit 0, 12/12 ok.
- `phone-map`: 348 ok, exit 0 on two runs; one earlier run hit a 30 s click timeout.
  `timeline`: 105 ok, exit 0, including the map-sheet Day 2 numbers check.

## Notes for the next person

Tapping an unplaced row still only marks it selected; the "Not found on the map" text now explains
why the map does not move.
