---
date: 2026-10-21
author: Claude Code for Joey
branch: fix/phone-sheet-targets
pr: none
area: apps/web
contract-impact: none
---

# Phone fact sheets reach 44 px and Answer buttons get their own names

## What changed

- `apps/web/app/styles/trip-facts.css`: on phone widths the fact sheets' close button is 44 × 44 px
  and the primary action (Update trip, Save, Done) is 44 px high, both `!important`.
- `apps/web/components/account/SettingsControls.tsx`: each memory row's Answer button is named
  "Answer {label}" ("填写{label}" in Chinese), keeping the visible word first.
- `apps/web/tests/e2e/phone-sheet-targets.e2e.mjs`: measures Trip details and the Where, When,
  Who, Budget and Preferences sheets, and the Answer names, in English and Chinese at 390 × 844.

## Why

`glass.css` sets the close button to 32 px with `!important`, and the generic button rule in
`forms.css` held the primary action at 36 px min-height, so the existing phone rules lost.

## Validation

`pnpm --filter @trip/web e2e phone-sheet-targets --prod`: failed before (close 32 × 44, primary
39 px high, eight buttons named "Answer"), 28 checks pass after.

## Notes for the next person

none
