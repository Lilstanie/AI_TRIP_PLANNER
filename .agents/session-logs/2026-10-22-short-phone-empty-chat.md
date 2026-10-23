---
date: 2026-10-22
author: Claude Code
branch: fix/short-phone-empty-chat
pr: none
area: apps/web, docs
contract-impact: none
---

# Empty chat signals hidden examples on a short phone

## What changed

- `apps/web/components/chat/ChatPanel.tsx`: while the chat is empty, the stream carries
  `data-more="true"` when it can still scroll down (a `ResizeObserver` and the scroll event keep it
  current) (#536).
- `apps/web/app/styles/chat.css`: `data-more` fades the stream's bottom 56 px with a mask.
- `apps/web/tests/e2e/short-phone-empty-chat.e2e.mjs` and its failure inventory (written first).
- `docs/workspace-ui.md` and its Chinese pair.

## Why

At 360 × 640 the composer and the six assistant chips leave the English stream 171 px, so all four
examples and Add trip details cannot fit at 44 px; the issue's alternative, a visible cue that the
card continues, is the fix. Removing content was rejected because even an empty card would not fit.

## Validation

- `node scripts/redgreen.mjs short-phone-empty-chat -- apps/web/components/chat/ChatPanel.tsx
  apps/web/app/styles/chat.css`: before exit 1, 32/35 ok; after exit 0, 35/35 ok (360 × 640,
  390 × 844 and 1440 × 900, English and Chinese).
- Web unit tests 642 passed; `phone-touch-targets` 13 ok. `liquid-glass` times out on a disabled
  button with and without this change.

## Notes for the next person

The assistant chips take three to four rows on a 360 px phone; a single scrolling row would give the
chat back most of that height.
