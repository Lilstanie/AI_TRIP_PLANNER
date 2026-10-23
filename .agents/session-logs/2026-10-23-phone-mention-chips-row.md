---
date: 2026-10-23
author: Claude Code
branch: fix/phone-mention-chips-one-row
pr: none
area: apps/web, docs
contract-impact: none
---

# Phone assistant chips stay in one scrolling row

## What changed

- `apps/web/app/styles/thinking.css`: at 520 px and below, `.assistant-chips` no longer wraps. It
  scrolls sideways with no scrollbar, and its chips keep their 44 px height. While more chips are
  hidden, `data-more="true"` fades the last 56 px (#606).
- `apps/web/components/chat/AssistantChips.tsx`: a `ResizeObserver` and a scroll listener keep
  `data-more` current.
- `apps/web/components/chat/ChatPanel.tsx`: the empty-chat fade ignores the stream's own bottom
  padding. With the taller stream, a 4 px padding overflow at 390 × 844 had turned the fade on over
  nothing.
- `apps/web/tests/e2e/phone-mention-chips-row.e2e.mjs` and its failure inventory (written first).
- `docs/workspace-ui.md` and its Chinese pair.

## Why

The three-row chip strip took 144 px and left the 360 × 640 message list 170 px tall. One scrolling
row keeps the 44 px targets (#585) and follows the fact chips' existing pattern.

## Validation

- `node scripts/redgreen.mjs phone-mention-chips-row -- apps/web/components/chat/AssistantChips.tsx
  apps/web/app/styles/thinking.css`: before, exit 1 with 36/46 ok (3 rows / 144 px in English and 2
  rows / 94 px in Chinese, a 170 px list at 360 × 640); after, exit 0 with 46/46 ok.
- With the chip change, `phone-sheet-targets`, `assistant-rename`, `specialist-mention` and
  `phone-touch-targets` pass. `short-phone-empty-chat` failed at 390 × 844 in English (the fade
  showed with nothing hidden) and passes after the padding fix.
- Web unit tests 642 passed; typecheck, lint and the root `verify:*` checks pass.
