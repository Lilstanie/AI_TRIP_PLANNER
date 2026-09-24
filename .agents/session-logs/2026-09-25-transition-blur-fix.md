---
date: 2026-09-25
author: Claude Code (Opus 5.5)
branch: feature/apple-style-ui
pr: none
area: apps/web
contract-impact: none
---

# Remove the blurred strip left by page switches that start from the Chats panel

## What changed

- `app/styles/motion.css`: the Chats panel has no `backdrop-filter` while a view transition runs
  (`html[data-transition]`, set before the old view is captured) or while it is closed, and uses
  `--glass-bg-strong` instead.

## Why

Chrome keeps a captured element's backdrop-filter live on its view-transition snapshot, so the
fading panel blurred the new page beneath it into a strip. Naming the panel only while open (the
earlier fix) covered opening a trip from Your trips, but not New chat or opening a chat from it.

## Validation

- Frames captured 20–200 ms into four switches (to Your trips, open trip, New chat, open chat from
  the panel): no blurred strip in any of them.
- `pnpm --filter @trip/web test` 371 pass; lint clean; `tsc --noEmit` pass; E2E 28/28 pass.

## Notes for the next person

Any other glass element given a `view-transition-name` needs the same treatment.
