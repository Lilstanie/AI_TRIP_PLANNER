---
date: 2026-10-22
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/phone-undo-hit-area
pr: none
area: apps/web
contract-impact: none
---

# Phone Undo button meets the 44 px hit area (#531)

## What changed

- `apps/web/app/styles/trip.css`: at phone widths (max-width 520 px) `.item-undo button` gets `min-height: 44px !important`.
- `apps/web/tests/e2e/phone-undo-hit-area.e2e.mjs`: new E2E test. It plans the suggested trip at 375 px, marks a stop visited, and asserts the Undo button is at least 44 px high with no horizontal scroll.

## Why

The generic `button:not(...)` rule in `forms.css` sets `min-height: 36px` with enough specificity to beat `.item-undo button`. A plain `min-height` fix did not apply, so the rule uses `!important`, matching the existing phone rules in the same file.

## Validation

- Before the fix: `pnpm --filter @trip/web e2e phone-undo-hit-area` failed with "Undo button is at least 44 px high (was 36)".
- After the fix: the same command passed with `undoWidth: 61, undoHeight: 44`. Evidence: `apps/web/output/playwright/phone-undo-hit-area/results.json` and `undo.png`.
- `pnpm --filter @trip/web typecheck`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0, no ESLint warnings or errors.
- `pnpm verify:e2e-selectors`: exit 0.
- `pnpm verify:e2e-artifacts`: exit 0.

## Notes for the next person

- Other `.item-undo` notices (`TripUndo.tsx`, the deleted-trip notice) pick up the same rule. They were not measured separately.
- The Trip tab's `.timeline-undo` notice in `TripEditor.tsx:370` has its own styles and was not changed.
