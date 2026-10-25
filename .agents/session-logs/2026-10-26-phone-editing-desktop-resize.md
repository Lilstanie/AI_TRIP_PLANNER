---
date: 2026-10-26
author: OpenAI Codex with DeepSeek review
branch: feature/TP-101-phone-editing
pr: none
area: apps/web
contract-impact: none
---

# Keep hidden phone Brief drafts hidden across the desktop breakpoint

## What changed

- Updated `TripFactChips.tsx` so view ownership, rather than phone layout, controls whether a retained Brief dialog is hidden.
- Extended `phone-editing.e2e.mjs` to hide a dirty Budget dialog on Map, widen to 521px, and return to Chat without losing the draft.

## Why

A dirty Brief dialog opened on Chat and hidden by switching to Map reappeared as a desktop modal when the viewport widened. The layout flag described where the dialog originated, while the view mismatch described whether its anchor was currently available.

## Validation

- `pnpm --filter @trip/web e2e phone-editing` passed, 41/41 assertions; report:
  `output/playwright/phone-editing/after/report.json`.
- `pnpm --filter @trip/web e2e itinerary` passed for 1280×800, 390×844 and 360×800.
- `pnpm --filter @trip/web test` passed, 57 files and 642 tests.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` exited 0; lint retained existing warnings in `ChatPanel.tsx`, `PhoneTrajectory.tsx` and `WorkspaceView.tsx`.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors` and `pnpm verify:e2e-artifacts` passed.
- `pnpm format:check-changed origin/main`, the UI copy check, the scoped added-comment check and `git diff --check` passed.

## Notes for the next person

Browser fixtures do not prove physical keyboard behavior, installed-device safe areas or live place
providers. The integrated PR must rerun all four phone flows after merging their branches.
