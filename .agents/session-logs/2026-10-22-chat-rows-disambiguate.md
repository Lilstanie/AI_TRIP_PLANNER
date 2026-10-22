---
date: 2026-10-22
author: Claude Code
branch: fix/chat-rows-disambiguate
pr: none
area: apps/web, docs
contract-impact: none
---

# Chat rows name their trip with the Trips list's disambiguated title

## What changed

- `apps/web/components/workspace/useWorkspace.ts`: `distinctTripTitles()` runs once over every
  trip, and both the chat rows' subtitle and the Trips list read that map (#526).
- `apps/web/tests/e2e/chat-rows-same-trip.e2e.mjs`: plans "Sydney · 4 days" twice at 390 px and
  compares the Chats rows with the Trips cards.
- `docs/workspace-ui.md` and its Chinese pair.

## Why

Numbering over every trip, not only the search results, keeps a trip's ordinal the same in both
lists and while searching.

## Validation

- `DATA_MODE=mock pnpm --filter @trip/web e2e chat-rows-same-trip` with the component change
  stashed: exit 1, 2/4 (both chat rows read "Trip to Sydney"). With it: exit 0, 4/4.
- Other checks are listed in the pull request's Evidence section.

## Notes for the next person

none
