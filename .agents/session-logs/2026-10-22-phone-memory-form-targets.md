---
date: 2026-10-22
author: Claude Code
branch: fix/phone-memory-form-targets
pr: none
area: apps/web, docs
contract-impact: none
---

# Controls inside an opened Personalization editor reach 44 px on phones

## What changed

- `apps/web/app/styles/settings.css` (520 px and below): inline-form input, select and Save, the
  editor's pill buttons, Pace choices and chips get a 44 px minimum (#556).
- `apps/web/tests/e2e/phone-sheet-targets.e2e.mjs`: opens every Personalization row and measures
  each visible control in its editor (a wrapped checkbox is measured through its label).
- `docs/workspace-ui.md` and its Chinese pair.

## Why

The global `button:not(...)` rule in `forms.css` and `.segmented > button` (`min-height: 30px
!important`) outrank a plain class selector, so chips and Pace choices follow the existing
`!important` override for the Settings close button instead of joining the `:not()` lists, which
would also change desktop sizes.

## Validation

- `DATA_MODE=mock EVIDENCE_LABEL=before pnpm --filter @trip/web e2e phone-sheet-targets` on main
  CSS: exit 1, 2 failures (input 36, Save 32, Pace 30, chips and select 36 px in both locales). The
  edit-row check from #555 passed, confirming #527 is fixed on main.
- Same script with the change: exit 0, 34/34.
- Other checks are listed in the pull request's Evidence section.

## Notes for the next person

none
