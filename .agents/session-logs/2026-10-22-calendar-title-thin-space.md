---
date: 2026-10-22
author: Claude Code
branch: fix/calendar-title-thin-space
pr: none
area: apps/web tests
contract-impact: none
---

# Calendar date-label E2E accepts ICU's thin spaces in a date range

## What changed

- `apps/web/tests/e2e/calendar-trip-date-label.e2e.mjs`: page titles are compared after replacing
  U+2009 with a space.

## Why

This Chromium's ICU formats the cross-year English range as "31 Dec 2030 – 2 Jan 2031" with thin
spaces around the dash, so 6 title checks failed on `origin/main` while the title was correct.

## Validation

- Before: exit 1, 6 `FAIL` (expected "… 2030 – 2 Jan …", actual "… 2030 – 2 Jan …").
  After: exit 0, 181 ok, 0 `FAIL`.

## Notes for the next person

None.
