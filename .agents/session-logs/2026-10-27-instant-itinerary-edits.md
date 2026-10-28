---
date: 2026-10-27
author: Claude Code
branch: feature/TP-122-instant-edits
pr: none
area: apps/web, docs
contract-impact: api
---

# Itinerary edits apply at once

## What changed

- Deleted `TripDrafts.tsx`, its provider and restore entry in `WorkspaceView`, and the draft and discard use in `StopForms.tsx` and `TimelineStop.tsx`; `useDiscardChanges` stays for the Brief sheets.
- Rewrote `AddStop.tsx`: a search result, Add or Save as Idea adds at once to the viewed day; no Day or time form.
- `trip-edit.ts`: a day-only `add` is timed by the server after the day's last stop; a lone start or end time is rejected. Documented in `docs/api.md`/`.zh.md`.
- Removed the dead strings and Chinese translations, the banner CSS, the `trip-drafts` E2E and the draft scenarios of `trip-review-recovery`.
- Added `instant-edits.e2e.mjs` with its failure inventory; updated `trip-add-stop`, `itinerary`, `phone-editing`, the UI docs and a superseding Agent Note.

## Why

The server's own leg check refuses a guessed client slot after travel time, so the server picks the slot.

## Validation

- `instant-edits` failed before the change (add preview form, missing Undo) and passes at 1440px and 390px with `--prod`.
- `phone-editing`, `trip-review-recovery`, `phone-undo-hit-area`, `phone-stop-menu`, `plan-revision` pass with `--prod`.
- `trip-add-stop`, `itinerary`, `timeline`, `auto-save-places`, `narrow-time-editor`, `drawer-walkthrough`, `notice-keys`, `settle-path` fail identically on the unchanged integration branch in this sandbox; `trip-add-stop` passes all 15 checks before its pre-existing failure.
- Web typecheck, lint, Vitest (643 tests) and the UI copy check passed.

## Notes for the next person

The time of a new stop is changed afterwards from the stop; the Add to trip panel (ticket 4) replaces this form.
