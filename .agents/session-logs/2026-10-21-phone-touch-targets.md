---
date: 2026-10-21
author: Claude Code for Joey
branch: fix/phone-touch-targets
pr: none
area: apps/web
contract-impact: none
---

# Phone empty Trip buttons and the Think toggle reach 44 px

## What changed

- `apps/web/app/styles/phone-shell.css`: the empty Trip buttons' 44 px minimum is `!important`, and
  the phone Think row (`.thinking-turn`) and its toggle line are 44 px high.
- `apps/web/tests/e2e/phone-touch-targets.e2e.mjs`: measures both at 320 and 375 px and checks the
  desktop Think row stays 24 px and still toggles.

## Why

The generic button rule in `forms.css` chains about twenty `:not(.class)` selectors, so its
specificity beat the phone rule and held the buttons at 36 px. The collapsed Think row has
`contain: size` with a fixed 24 px height, so its flex child shrank back to 24 px unless the row
grew too.

## Validation

`pnpm --filter @trip/web e2e phone-touch-targets --prod`: failed before the change (36 px buttons,
24 px Think row), passes after, with screenshots in `output/playwright/phone-touch-targets/`.

## Notes for the next person

Any new phone rule that sets `min-height` on a plain `button` needs `!important` for the same
reason.
