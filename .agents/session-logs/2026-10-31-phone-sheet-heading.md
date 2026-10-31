---
date: 2026-10-31
author: Claude Code for Joey (HeadmasterEggy)
branch: fix/TP-199-phone-sheet-heading
pr: pending
area: apps/web, docs
contract-impact: none
---

# Phone Trip details sheet, Mine headings and chat drag (TP-199)

## What changed

- `glass.css`: the phone top-bar rule that gives children `position: relative` now skips
  `.fact-popover`, `.fact-popover-scrim` and `.phone-trajectory`. It had overridden the sheet's
  `position: fixed`, so Trip details opened inside a 366 px top bar at y = -56.
- `phone-polish.css`: `--phone-tabbar-gap`; brief sheets and scrim end at `62px + gap` (the floating
  tab bar from TP-193 covered their last 6 px); Mine section titles `flex: none; nowrap`;
  `overscroll-behavior: none` on html/body and `contain` on `.chat__stream`.
- `phone-polish.e2e.mjs` + failures list: four new checks per phone run.

## Why

Joey's iPhone screenshots: 行程/聊天 stacked one character per line, the preference sheet broken in
the top bar, and swiping a chat dragged the whole page. The top-bar bug predates TP-193 (#782 rule).

## Validation

- `phone-polish.e2e.mjs`: 63/63 with the fix; 53/63 with the CSS stashed (the 10 new checks fail).
- iOS rubber-band itself cannot be reproduced in Chromium; the check asserts the computed
  overscroll values.
