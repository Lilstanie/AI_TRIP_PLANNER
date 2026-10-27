---
date: 2026-10-26
author: OpenAI Codex
branch: feature/TP-101-phone-editing
pr: none
area: apps/web
contract-impact: none
---

# Preserve desktop editing and cover phone failure paths

## What changed

- Keep desktop Stop, time, note and place forms inline while phone forms use the sheet surface.
- Ask before discarding only phone edits that changed the active details, note, schedule, time or place query.
- Track an unchanged Day 2 Stop without a false dirty state, and retain a failed place application.
- Cover outside dismissal, unchanged Day 2, failed place application and phone-only Escape in browser E2E.
- Allow `StopForms.tsx` to keep the `End must be after start.` validation hint.

## Why

The first phone editing implementation wrapped desktop forms in sheets and made every close a
discard, so desktop behaviour and focus flow changed. The dirty checks also mixed unrelated form
mode state and assumed every Stop was on Day 1.

## Validation

- `pnpm --filter @trip/web e2e phone-editing` passed, 40/40 assertions; report:
  `output/playwright/phone-editing/after/report.json`.
- `pnpm --filter @trip/web e2e itinerary` passed for 1280×800, 390×844 and 360×800.
- `pnpm --filter @trip/web test` passed, 57 files and 642 tests.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` exited 0; lint retained
  existing warnings in `ChatPanel.tsx`, `PhoneTrajectory.tsx` and `WorkspaceView.tsx`.
- Prettier check, `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`,
  `pnpm verify:e2e-artifacts`, `pnpm format:check-changed origin/main`, the UI copy check, the
  added-comment check and `git diff --check` passed.

## Notes for the next person

Browser fixtures do not prove physical keyboard behavior, installed-device safe areas or live place
providers. The integrated PR must rerun the four phone flows after merging their branches.
