---
date: 2026-10-27
author: Claude Code
branch: feature/TP-125-add-panel
pr: none
area: apps/web, docs
contract-impact: api
---

# One Add to trip panel replaces Add place

## What changed

- Added `AddToTripPanel.tsx` (Search, Ideas, Saved, Custom, filters, Keep open) and removed `AddStop.tsx`.
- `TripEditor.tsx`: Add button at the end of the day and in Ideas, which is always shown.
- `/api/places/search` takes an optional `kind`; `lib/trip/add-filters.ts` narrows results by type.
- `lib/trip/saved-places.ts` lists `savedPlace` entries of the account's other trips from the catalog.
- New zh strings, panel styles in `timeline.css`, docs (`workspace-ui`, `api`, en and zh), Agent Note.
- `instant-edits` E2E and its failures file moved to the new Add controls.

## Why

Saved has no account-level store, so it reads other trips' saved places; no shared type was added.

## Validation

- `add-to-trip-panel` and `instant-edits` E2E with `--prod`: all checks pass (139 and 80).
- `leg-distances` passes. `trip-add-stop`, `auto-save-places`, `timeline` and `drawer-walkthrough` fail the same way on the unmodified integration branch.
- typecheck, lint, check-ui-copy, verify:docs, verify:protected, verify:pairs and prettier pass.

## Notes for the next person

The search route contract gained `kind`; Undo stays single-step, so Keep open undoes only the last add.
