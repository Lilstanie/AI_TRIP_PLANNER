---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/phone-day-conflict-grey
pr: pending
area: apps/web, docs
contract-impact: none
---

# Phone Trip tab: day and stop travel-time notes are grey

## What changed

- `apps/web/app/styles/phone/finish.css`: on a phone, `.timeline-day__conflicts li` and
  `.timeline-stop__conflicts li` use the grey tag colours, so the open-items row stays the only
  orange mark, as the phone-finish Agent Note decides.
- Phone-finish note facts, `docs/workspace-ui.md` and its Chinese pair, and the failure inventory.

## Validation

- `node apps/web/tests/e2e/phone-finish.e2e.mjs` on `main` with `MOCK_PLACES=multi` (dev server):
  `FAIL en-390` and `FAIL zh-360` "the open-items count is the only orange text on the Trip tab";
  a debug run named the extra node: `LI` in `timeline-day__conflicts` ("Getting from Mock attraction
  near Rome to Mock Corner Bistro …").
- After the change: 46/46 ok (`output/playwright/phone-finish/after`).

## Notes for the next person

- The same sweep on `main` also timed out in `phone-shell` (180 s wait) and `stop-menu-state` (90 s);
  not investigated here.
