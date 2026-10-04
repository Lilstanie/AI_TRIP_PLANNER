---
date: 2026-10-05
author: Codex
branch: feature/display-currency-147
pr: none
area: apps/web, packages/shared, docs
contract-impact: packages/shared
---

# Split completed workspace features into three dependent PRs

## What changed

- Preserve the original `feature/workspace-currency-and-translation` branch and backup ref `refs/backup/workspace-pr-split-20261005`.
- Put #147 display currency first, #148 authored Chinese UI second and #150 original-currency budget entry last.
- Move currency regression assertions and numeric E2E checks into the display-currency foundation.
- Correct the paired workspace documentation's obsolete converted-budget hint description.

## Why

Each issue needs a reviewable diff. The Chinese UI uses the shared locale/currency context; budget entry uses that translated interface and the shared conversion helpers. No PR is merged as part of this split.

## Validation

- Display-currency branch: `pnpm typecheck` passed all six packages; shared tests passed 52; web tests passed 451.
- Display-currency browser E2E passed 50 checks at 1440 and 390 widths; screenshots and report under `output/playwright/display-currency/`.
- `pnpm lint`, `pnpm verify:docs`, `pnpm verify:protected` and `pnpm verify:pairs` passed before the final documentation correction; rerun before push.
- The original combined implementation passed 987 tests, production build and all three browser scripts; the split branches require their own checks before push.

## Notes for the next person

- Merge order: #147, then #148, then #150; retarget downstream PRs to main after their base merges.
- #149 / PR #163 remains untouched. Clerk and native iOS are not validated here.
