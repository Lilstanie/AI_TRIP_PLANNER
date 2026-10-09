---
date: 2026-10-08
author: Claude (Haiku 5.5)
branch: fix/trip-drawer-review-233
pr: none
area: apps/web, packages/orchestrator, docs
contract-impact: none
---

# Fix review findings on the trip drawer (spec #233)

## What changed

- Timeline check "a time edit that changes the day routes its legs again" now reads the server's per-leg routes in the
  time answer and asserts no second verify (`apps/web/tests/e2e/timeline.e2e.mjs`). Commit 3f107f1 recorded the day as
  routed after an applied edit, so the old wait for a verify request never came.
- Findings 1-6, 8 and 11: `components/trip/useLegRoutes.ts`, `useAutoSavePlaces.ts`, `timeline/useTimelineEdits.ts`,
  `timeline/TimelineStop.tsx`, `lib/trip/trip-edit.ts`, `lib/trip/conflicts.ts`, `lib/trip/item-actions.ts`,
  `lib/i18n/notice.ts`, `lib/i18n/workspace-messages.ts`.
- Settle moved to `apps/web/lib/trip/settle.ts`. The browser reaches `rollUpCost` and `detectConflicts` through the new
  `@trip/orchestrator/plan-totals` subpath (`packages/orchestrator/src/plan-totals.ts`), so item actions settle as the
  server does. `packages/shared` is not touched.
- Stored plan notices: `editIssues[].message` holds a keyed notice (`storeNotice` / `readStoredNotice`); `conflictsWith`
  stays English because the orchestrator chat reads it.
- E2E: auto-save-places (scenario 4), workspace-chinese (stored notice in Chinese), drawer-walkthrough (buffer sentence
  matched per language), timeline (Undo with an Idea in the plan).
- Docs: `docs/workspace-ui.md` and `.zh.md`; dated lines in four implemented notes (immediate-timeline-edits,
  leg-travel-times, keyed-notices-everywhere, itinerary-item-actions). No decision was rewritten.

## Why

- Keyed notices let a stored notice show in the traveller's language. The chat still needs the English sentence, so both
  copies are kept and the UI skips the English one when the keyed issue is shown.
- Settle is shared through a browser-safe subpath export rather than a new shared contract.
- Finding paths: `useLegRoutes.ts` and `useAutoSavePlaces.ts` live in `components/trip/`, not `timeline/` or `workspace/`.

## Validation

- `cd apps/web && npx tsc --noEmit`: exit 0
- `pnpm --filter @trip/web lint`: exit 0
- `pnpm --filter @trip/web test`: 50 files, 581 tests passed
- `node scripts/verify-docs.mjs`: passed
- `node scripts/verify-protected-files.mjs origin/main`: passed
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: 24 pairs match
- Prettier `--check` on the changed files: passed
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline itinerary auto-save-places workspace-chinese drawer-walkthrough choose-fare-and-stay`:
  exit 0, all six suites ok, 517 ok lines and no FAIL. drawer-walkthrough: 194 checks, 0 failed, 2 known exceptions.
- Not run: the new E2E checks against 3f107f1, to confirm they fail on the old head.

## Notes for the next person

- Open decision: leg-travel-times failure mode 6 says a provider outage refuses the edit. `trip-edit.ts` keeps non-move
  edits with a notice on the destination stop and refuses only moves. `docs/workspace-ui.md` describes the code.
- Known exception (drawer-walkthrough, zh): an English travel-buffer sentence still appears under the day title. It is
  the `conflictsWith` copy from `trip-edit.ts`. The skip in `conflicts.ts` did not match it in this walk; cause not traced.
- No E2E for finding 8 (a move's verify overwriting a stale value) or for `useLegRoutes` problems keyed by day signature.
- Mock mode cannot produce an unroutable leg, so finding 5 is covered with a timing blocker.
