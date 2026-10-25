---
date: 2026-10-25
author: Claude Opus 5.5 (project thread)
branch: fix/TP-79-budget-unpriced-counts
pr: none
area: apps/web
contract-impact: none
---

# Budget card unpriced counts match the notes

## What changed

- `apps/web/components/trip/TripPanel.tsx`: the per-category unpriced count skips restaurant picks, the
  same items the "Not included" note already skips.
- `apps/web/tests/e2e/budget-unpriced-counts.e2e.mjs`: runs the "Sydney · 4 days" example in English and
  Chinese at 390 px and compares the row counts with the notes.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`: one sentence on restaurant ideas.

## Why

Issue #681 (Jira TP-79): Meals said "1 unpriced" for a restaurant idea that no note explained.

## Validation

- `node scripts/redgreen.mjs budget-unpriced-counts -- apps/web/components/trip/TripPanel.tsx`: before
  exit 1, 6/10 ok; after exit 0, 10/10 ok.
- Typecheck, lint and web unit tests: see the PR body.

## Docs and Agent Notes

`docs/workspace-ui.md` and its zh pair. No Agent Note: no contract or lasting decision changed.
