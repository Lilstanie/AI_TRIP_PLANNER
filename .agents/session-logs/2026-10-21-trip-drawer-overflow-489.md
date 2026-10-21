---
date: 2026-10-21
author: Codex
branch: fix/workspace-control-overflow
pr: 489
area: apps/web, docs
contract-impact: none
---

# Keep expanded stop editors inside the narrow Trip drawer

## What changed

- Record #489 drawer geometry and focused editor bounds in `workspace-control-overflow.e2e.mjs`; add the failure mode to its inventory.
- Let expanded place cards span the timeline stop row and keep their fields/actions within the available card width.
- Clarify the narrow-drawer behavior in the English and Chinese workspace UI docs.

## Why

The #488 baseline moved the drawer body horizontally when focusing a 172px editor in a 181px body. The content was inside the timeline's narrow body column, and the input's intrinsic minimum width enlarged the form. A horizontally overflowing date strip is intentional; the drawer itself remains at `scrollLeft=0` and editor controls stay inside it.

## Validation

- `LABEL=baseline-489 pnpm --filter @trip/web e2e workspace-control-overflow` — reproduced EN/ZH 1024px End: body `scrollLeft=20`, input x=950–1122 outside body x=834–1015.
- `LABEL=final-489 pnpm --filter @trip/web e2e workspace-control-overflow` — passed EN/ZH at desktop, split, boundary and phone widths; focused input/buttons fit the drawer, no unexpected overflow outside the day strip, no page errors. Artifacts: `output/playwright/workspace-control-overflow/final-489/`.
- `pnpm exec prettier --write apps/web/tests/e2e/workspace-control-overflow.e2e.mjs apps/web/app/styles/trip.css apps/web/app/styles/timeline.css apps/web/components/trip/timeline/TimelineStop.tsx` — passed.

## Notes for the next person

Browser viewport simulation only; no installed-app or physical-device keyboard check. The day strip intentionally retains its own horizontal scrolling.
