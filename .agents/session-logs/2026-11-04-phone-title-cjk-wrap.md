---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/phone-title-cjk-wrap
pr: pending
area: apps/web
contract-impact: none
---

# Phone chat title breaks Chinese only at spaces

## What changed

- `apps/web/app/styles/phone/chat.css`: the two-line phone chat title adds `word-break: keep-all`
  (CJK breaks only at spaces) and `overflow-wrap: anywhere` (a run longer than the line still wraps).

## Why

Chinese text may break between any two characters, so "巴厘岛 · 12月4日 – 12月9日" left a lone "日"
on the second line of the clamped title.

## Validation

- Browser probe (390 × 844, zh, dark, mock plan from the Bali prompt), lines of the title:
  before `["巴厘岛 · 12月4日 – 12月9","日"]`, after `["巴厘岛 · 12月4日 – ","12月9日"]`.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs` run before push.

## Notes for the next person

none
