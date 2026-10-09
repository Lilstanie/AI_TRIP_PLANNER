---
date: 2026-10-09
author: Claude Code (ticket #262 refactor run)
branch: refactor/check-entry-point
pr: 258
area: apps/web (trip edit check, timeline, notices read-back), docs, .agents
contract-impact: none
---

# One check entry point for plan edits, undo ignores Ideas (#262, spec #259)

## What changed

- `apps/web/lib/trip/trip-edit.ts`: remove, Ideas, scheduling and the arrow moves are server operations; refusals name
  their stop; a swap keeps the times it trades.
- `apps/web/lib/trip/undo-step.ts` (new): the undo snapshot takes only timed stops, so an Idea never blocks Undo.
- `apps/web/components/trip/plan-revision.ts`, `timeline/useTimelineEdits.ts`, `useChooseCandidate.ts`: a stale answer
  says to try again; the chat replan says when it replaced a timeline change (`replacedChange`, WorkspaceView).
- `apps/web/lib/i18n/notice.ts` / `locale.ts`: `AUTHORED_KEYS` excludes keys that start with a placeholder. The
  refusal key "{stop}: {reason}" matched any sentence with a colon, which hid the overlap marks (regression found by the
  batch, timeline "overlapping Day 1 stops").
- Tests: `check-entry-point.e2e.mjs` (new, 31 checks, red at 5372ede). `auto-save-places.e2e.mjs` holds the server's
  swap instead of a verify and asserts the timeline lock. `workspace-chinese.e2e.mjs` stub and expected text use the
  new blocker keys. `trip-edit.test.ts` expectations moved to the new wording.

## Why

Spec #259, ticket #262: one check entry point with undo that ignores Ideas. The regression batch showed the overlap
marks and the Chinese blocker text depended on the authored-sentence read-back.

## Validation

Run on the final branch:

- `npx tsc --noEmit` in apps/web: exit 0.
- `pnpm --filter @trip/web lint`: exit 0.
- `pnpm --filter @trip/web test`: 50 files, 581 tests passed.
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline itinerary auto-save-places choose-fare-and-stay plan-revision notice-keys drawer-walkthrough workspace-chinese check-entry-point`: see the commit message and the PR for the final exit code.

## Known limitations

- A stored "confirm the place" notice written before this change keeps its English sentence in the Chinese interface.
- The timeline locks while a checked edit is pending. A second edit has to wait for the answer.
- The live (Google) path is not exercised; the E2E environment has no map key.

## Notes for the next person

- Agent Note status: `implemented` for #262 (`implemented/feature/2026-10-09-check-entry-point.md`).
