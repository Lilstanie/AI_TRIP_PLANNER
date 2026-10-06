---
date: 2026-10-06
author: Claude Code
branch: refactor/workspace-actions
pr: none
area: apps/web, docs
contract-impact: none
---

# useWorkspace hands views session, layout, itinerary and history actions (#206)

## What changed

- `components/workspace/useWorkspaceController.ts` became `useWorkspace.ts`. It returns `session`,
  `layout`, `itinerary` and `history`; no raw setter leaves it (`sessionField` is gone).
- `lib/workspace/session.ts`: new events `edited` (records the previous total), `opened` (replaces
  `left`; resets to what the opened chat or trip saved), `typed`, `drafted`, `selected`, `routed`,
  `dismissed`. Cases written first in `tests/lib/workspace/session.test.ts`.
- `applyEdit(next)` replaces the two hand-written `setPreviousTotal`/`setPlan` copies in
  `WorkspaceView`. The phone map day and focus counter moved into the hook (`layout.mapDay`,
  `showMapDay`, `pickMapDay`, `session.showStop`); `PhoneMapSheet` now takes only `model`.
- `PhoneMine`, `PhoneMapSheet`, `PhoneTripTitle`, `usePhoneTripUpdates`, `WorkspaceDialogs` call
  actions. The unused `tripFacts` helper was deleted from `workspace-helpers.ts`.
- `docs/architecture.md` gains "Workspace state"; `docs/workspace-ui.md` Requests bullets; both
  Chinese pairs updated and re-recorded.

## Why

Cross-group links (opening a trip decides the surface, picking a phone map day drops a selection
on another day, adjusting a stop opens the timeline) are now written once in the hook. `retry` is
an action plus `canRetry`, so views no longer pass the stored task back to `run`.

## Validation

- `pnpm --filter @trip/web lint`, `typecheck`: pass. `test`: 52 files, 564 tests pass.
- `pnpm verify:docs`, `pnpm verify:protected`: pass.
- E2E against `next dev` (mock tools): phone-shell 289/289 (includes phone-mine, phone-map,
  phone-state walks), itinerary pass, timeline pass. conversation-scope (`DATA_MODE=mock`) 8/15:
  the same 7 pre-existing brief-learning failures as the integration branch.

## Notes for the next person

- `docs/design/class-diagram*.md` (Stage 1 model) still names `WorkspaceController`; left as is.
- `notice` is still a string that nothing sets except dismiss (left for #205).
