---
date: 2026-10-17
author: Codex
branch: fix/review-triage-oct17
pr: 438
area: apps/web
contract-impact: none
---

# Announce fact-sheet validation errors

## What changed

- `FactFields.tsx` announces invalid dates, links the error to calendar day buttons, and avoids describing a rejected single-day range as a valid trip.
- `TripCalendar.tsx` forwards the validation description and invalid state to day buttons.
- `PreferenceList.tsx` announces duplicate-preference errors.
- `workspace-messages.ts` adds the Chinese text for the end-date prompt.

## Why

The calendar uses buttons rather than a date input, so the error description must be attached to the selectable date controls.

## Validation

- `pnpm --filter @trip/web typecheck` — passed.
- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= pnpm --filter @trip/web e2e settings` — passed, 35 checks across desktop and phone.
- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= pnpm --filter @trip/web e2e fact-errors` — passed, 6/6 checks; runner record: `output/e2e/runner/2026-10-17T12-59-31-597Z.json`, screenshots and summary under `output/playwright/fact-errors/`.
- `pnpm format:check-changed origin/main` — passed, including the focused E2E file.
- `pnpm verify:e2e-selectors` and `pnpm verify:e2e-artifacts` — passed.
- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= pnpm --filter @trip/web e2e liquid-glass` — failed in the unrelated map phase because the Satellite view control was disabled; desktop checks before that phase passed.
- `pnpm exec eslint` on the four changed TypeScript files — reported two existing issues in those files: `no-empty` in `FactFields.tsx` and `no-unused-vars` in `PreferenceList.tsx`.
- `git diff --check` — passed.

## Notes for the next person

The dedicated `fact-errors` E2E covers the live-region and calendar error associations. The `liquid-glass` run's map checks require an enabled map provider.
