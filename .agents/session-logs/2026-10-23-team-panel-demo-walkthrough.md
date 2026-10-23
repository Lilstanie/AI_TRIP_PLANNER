---
date: 2026-10-23
author: Claude
branch: feature/team-panel-635
pr: none
area: apps/web, docs
contract-impact: none
---

# Team panel demo walkthrough E2E (#635, spec #629)

## What changed

- `assistants-demo.e2e.mjs` is a nine-step Stage 2 walkthrough at 1440 and 390, English then Chinese:
  plan with working avatars on the Specialist team button, pick Stay from the `@` menu, a budget conflict
  with its revision assignment, two-Backspace mention removal, two mentions, a hand-off, an earlier
  reply's panel opening that reply's Stay row, a rename and a no-plan mention. Screenshots are numbered
  `<lang>-<width>-NN-<step>.png`, and `result.json` lists the steps with their screenshots.
- The failure inventory was rewritten before the script; `docs/demo-runbook.md` and `.zh.md` describe the
  same nine steps.

## Why

The demo runbook and its E2E still described the removed chip row and team-conversation rows.

## Validation

`CHANNEL=chromium DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e assistants-demo`
passed 132 checks; `pnpm verify:docs`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `check-ui-copy`
and the comment-policy check passed.

## Notes for the next person

- The fixture's budget conflict revises Food & dining, not Stay, so the walkthrough only requires that
  some revision assignment appears.
- The `@` menu closes on a space, so the walkthrough types only a name's first word.
