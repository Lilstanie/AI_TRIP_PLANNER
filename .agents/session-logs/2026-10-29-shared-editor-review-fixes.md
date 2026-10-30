---
date: 2026-10-29
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: apps/web, docs
contract-impact: none
---

# Keep shared Trip editor drafts and home map selection

## What changed

- Added `useFormDrafts` and restored unsubmitted time, detail, comment, day and
  place-search values across home Itinerary and conversation Trip remounts.
- Home map now uses the session selected activity and owned routes; background
  place saves and route checks run only while the active Chat owns the Trip.
- Extended `trip-home-shared-editor` assertions and failure inventory for drafts
  and map selection; updated the Trip home decision and UI docs.

## Why

Independent review of #794 found that home background work could write into the
wrong Chat, unsubmitted form values were local to each entry, and the home map
kept a separate selected-activity owner.

## Validation

- `pnpm --filter @trip/web e2e trip-home-shared-editor --prod` with blank
  provider/Clerk credentials, mock data and label `review-c2-c3-green-c18eeced`
  — passed, including the new draft and map-selection assertions.

## Notes for the next person

Null itinerary drawer ownership and obsolete action-rail selectors remain open.
Map #789 and generation #790 are ready to merge after this fix lands.
