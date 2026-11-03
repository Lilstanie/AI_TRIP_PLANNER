---
date: 2026-11-03
author: Claude Code
branch: fix/TP-350-ios-grouped-lists
pr: none
area: apps/web
contract-impact: none
---

# Phone Trip tab and Mine use grouped lists; a stop opens as a sheet

## What changed

- `apps/web/app/styles/phone/lists.css` (imported last by `phone/index.css`): vertical day list,
  single-row stops, stop details as a sheet above the tab bar, compact Mine trip rows, hidden
  duplicate Trip heading, grey budget status line. Phone only.
- `apps/web/tests/e2e/phone-polish.e2e.mjs` and `phone-polish.failures.md`: checks for each.
- New note `2026-11-03-phone-grouped-lists.md`; cross-link in `2026-10-30-phone-visual-refresh.md`;
  `docs/workspace-ui.md` and `.zh.md`.

## Why

Batch 1 of the redesign Joey approved after reviewing simulator screenshots on 2026-11-03.

## Validation

- `phone-polish.e2e.mjs` (system Chrome, mock data): 78/78 checks passed; red/green below.
- Before/after screenshots at 390 x 844 with the iOS app user agent, plus desktop 1440 x 1000
  unchanged (day strip still sideways).

## Notes for the next person

Batches 2 (chat) and 3 (login, team panel, map sheet, warnings) follow. The stop sheet reuses the
existing place card, so its content is unchanged; only its position moved.
