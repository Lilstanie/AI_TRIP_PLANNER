---
date: 2026-10-22
author: Claude Code
branch: fix/chinese-map-and-splitter-labels
pr: none
area: apps/web, docs
contract-impact: none
---

# Map status notice and chat/map divider value follow the interface language

## What changed

- `apps/web/components/map/TripMapCanvas.tsx`: the "no confirmed place yet" and "could not be
  loaded from the map service" notices go through `t()` with a `count` parameter (#552).
- `apps/web/components/workspace/SplitResizer.tsx`: `aria-valuetext` goes through `t()` (#549).
- `apps/web/lib/i18n/workspace-messages.ts`: four Chinese entries.
- `apps/web/tests/e2e/chinese-map-splitter-labels.e2e.mjs`: plans the Kyoto trip from #552 in
  zh-CN and en-AU, checks the map notice and the divider value before and after ArrowLeft.
- `docs/workspace-ui.md` and its Chinese pair name the language of both texts.

## Validation

- `DATA_MODE=mock pnpm --filter @trip/web e2e chinese-map-splitter-labels` with the source change
  stashed: exit 1, 6/10 (all four zh-CN text checks fail with the English strings).
- Same command with the change: exit 0, 10/10.
- Other checks are listed in the pull request's Evidence section.

## Notes for the next person

- The partial map notice only appears when some places resolve; stubbing `/api/places` empty
  shows the "could not be shown on the map" card instead.
