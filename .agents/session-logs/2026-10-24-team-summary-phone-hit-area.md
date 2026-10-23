---
date: 2026-10-24
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/team-summary-phone-hit-area
pr: none
area: apps/web
contract-impact: none
---

# Give the phone team summary pill a 44 px hit area (#636)

## What changed

- `apps/web/app/styles/thinking.css`: `.team-summary` gets `position: relative`; a `max-width: 520px`
  rule adds a `::before` extending the hit area by 6 px above and below. The 36 px visible pill is unchanged.
- `apps/web/tests/e2e/team-summary.e2e.mjs`: at phone widths, probes points 4 px above and below the
  pill and asserts both hit the button and its border-box height plus 8 px is at least 44 px.

## Why

`docs/design/ui-guidelines.md` requires a 44 × 44 px hit area on phone layouts; the pill had none.
The extension is a pseudo-element so the look stays the same, as the guideline allows.

## Validation

- Before the CSS fix (origin/main `thinking.css`): `node tests/e2e/team-summary.e2e.mjs`, 108 ok, 2 FAIL
  (`en-390` and `zh-390` hit area, height 36, top and bottom false).
- After: `node tests/e2e/team-summary.e2e.mjs`, exit 0, 110 ok, 0 FAIL.
- `pnpm exec prettier --check` on both changed files: all matched files use Prettier code style.

## Notes for the next person

- Run from `apps/web` against a dev server on localhost:3000 (`next dev -p 3000`).
- The probe reads a 36 px high pill; if the pill's padding changes, the `inset` value must change with it.
