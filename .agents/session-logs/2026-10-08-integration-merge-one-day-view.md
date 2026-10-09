---
date: 2026-10-08
author: Claude (Haiku 5.5, Projects thread)
branch: feature/trip-drawer-no-confirmations
pr: 258
area: trip drawer, timeline, docs, agent notes
contract-impact: none
---

# Integrate the one day view (#238) with auto-saved places (#236)

## What changed

- Merged `feature/one-day-trip-view-238` into the integration branch. The #238 branch already held
  the #236 merge (`fabb24a`), so the integration branch takes the same tree.
- Conflicts were resolved in the one-day view's stop row and place card (`TimelineStop.tsx`,
  `TripEditor.tsx`, `WorkspaceView.tsx`), the timeline and auto-save E2E scripts, and the workspace
  docs. The auto-save save states now sit in the stop row's meta block; the "Use this place" box is gone.
- `Workspace.test.tsx` expects "Not found on the map", the label #236 introduced.
- `auto-save-places.e2e.mjs` opens the trip through the "Trip timeline" region and searches through the
  stop's "Replace place" action, since the Timeline tab and the stop's "Use this place" box are gone.
- The #236 Agent Note moved from `proposed/` to `implemented/`: its Proposal became the Decision, its
  Acceptance criteria became Consequences, and its Supersession section points at the one-day note.

## Why

Spec #233 asks for one Trip drawer with no confirmations. The one-day view and the automatic place save
both change the stop editor, so they had to land on the same integration branch.

## Validation

Run on the integration branch after the merge:

- `pnpm --filter @trip/web test`: 52 files, 594 tests passed.
- `cd apps/web && npx tsc --noEmit`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0.
- `node scripts/verify-docs.mjs`: passed.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: 24 pairs checked.
- `node scripts/verify-protected-files.mjs origin/main`: passed.
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline itinerary auto-save-places workspace-chinese`: see
  the PR description for the final result.

## Known limitations

- The real Google Places save path is not exercised; the repository's E2E has no map key and stubs the
  Places and preview endpoints at the browser boundary.
- The timeline route-check section is skipped without a map key.
- The auto-save "a newer plan from chat cancels pending saves" rule is not covered by E2E.
- Older session logs still mention the proposed note path; they are frozen history and were not edited.

## Notes for the next person

- Agent Note status: `implemented` for #235, #236 and #238. #237, #239, #240 and #241 are still to do.
