---
date: 2026-10-28
author: Claude
branch: feature/TP-131-one-line-budget
pr: none
area: apps/web, docs
contract-impact: none
---

# Trip budget as one line with an expandable category list

## What changed

- `TripPanel` shows the known total over the limit, the unpriced count, one status and the bar; tapping lists one row per category.
- Removed the duplicate total, second status badge, delta sentence, "Not included" notes and per-item provider lines, with their CSS, strings and `budgetGap`.
- Added `one-line-budget.e2e.mjs` and its failures inventory; updated the older budget E2E scripts and both workspace UI pages.

## Why

A saved plan cannot have a zero limit (the shared schema needs at least 0.01), so the no-limit case is covered by the inventory and the panel guard, not by a fixture.

## Validation

- `pnpm --filter @trip/web e2e one-line-budget --prod`: 378 of 378 checks passed (desktop, phone, English, Chinese, yen, over budget, every item unpriced).
- Updated scripts passing: budget-category-breakdown, budget-unpriced-counts, trip-budget-issues, on-trip-day, workspace-walkthrough, settle-path, trip-panel-motion, phone-map.
- activities-not-costed, trip-ui-triage, budget-source-replacement, trip-display-currency, display-currency, reply-cost-line, workspace-control-overflow and workspace-chinese also fail on the unmodified base and fail at the same later steps.
- Typecheck, lint, docs, pairs, E2E selector and artifact checks passed.

## Notes for the next person

Those eight scripts need their own repair; they stop before or after the budget checks.
