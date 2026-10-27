---
date: 2026-10-27
author: Claude Code
branch: feature/TP-115-open-items-badge
pr: none
area: apps/web, docs
contract-impact: none
---

# TP-115 Open-items badge replaces the Trip issues block

## What changed

- Removed `TripIssues.tsx` and its block from `TripPanel.tsx`; dropped the budget-item focus plumbing it used.
- Added `OpenItemsBadge.tsx` and `lib/trip/open-items.ts`; the badge renders next to the desktop top bar title and the phone trip title in `WorkspaceView.tsx`.
- Popover uses `glass-float glass-float--raised` with opaque rows; styles in `app/styles/trip.css`.
- Rewrote `tests/e2e/trip-budget-issues.e2e.mjs` and its failures file for the badge and popover.
- Added the glossary term **Open item**, the superseding Agent Note `2026-10-27-open-items-badge.md`, and updated `docs/workspace-ui.md` and its `.zh.md` pair.

## Why

Unpriced items stay out of the count because the budget's "Not included" note already reports them.
Badge sits in the top bar so the count is visible on every view.

## Validation

See the final report of the ticket for the commands run and their results.

## Notes for the next person

Selecting a row from a view that does not show the timeline selects the stop without switching view.
The fixture shows 7 open items: 3 conflicts, 3 unlocated, 1 failed lookup.
