---
date: 2026-10-06
author: Claude Code
branch: refactor/workspace-layout
pr: none
area: apps/web, docs
contract-impact: none
---

# One pure layout decision owns what is open, including across the phone width (#198)

## What changed

- `apps/web/lib/workspace/layout.ts`: `layout(surface, event, {phone, narrow})` and
  `restoreLayout()`; breakpoint crossings are `resize` events. Tests in
  `apps/web/tests/lib/workspace/layout.test.ts` cover the crossings and one-open-panel rules.
- `apps/web/components/workspace/useWorkspaceLayout.ts` turns media-query changes into events and
  replaces `useIsPhone`/`useIsNarrow`, the three reconcile effects and the four "close everything
  else" blocks in `useWorkspaceController.ts`, `PhoneMine.tsx` and `WorkspaceView.tsx`.
- The phone trip facts sheet is now a layout panel (`PhoneTripTitle.tsx`); `usePhoneBack` moved
  from `usePhoneTripUpdates` to `WorkspaceView`.
- `apps/web/lib/workspace/catalog.ts` no longer stores whether the Trip drawer or preferences
  editor is open; old `open` values are dropped on read.
- `phone-mine.e2e.mjs` adds the Trip drawer/tab and Mine/Your trips crossings; `docs/workspace-ui`
  pair, the phone-shell note and a new Agent Note updated.

## Why

See the [layout Agent Note](../notes/implemented/architecture/2026-10-06-workspace-layout-reducer.md):
the owner chose to keep the traveller on the same thing across the phone width rather than close
every panel.

## Validation

- `pnpm --filter @trip/web lint`: no warnings or errors.
- `pnpm --filter @trip/web typecheck`: passed.
- `pnpm --filter @trip/web test`: 46 files, 485 tests passed.
- `node apps/web/tests/e2e/phone-shell.e2e.mjs` against `next dev` (mock tools), which also runs
  phone-mine, phone-map and phone-state: 289/289 checks passed, before and after merging
  `refactor/workspace-deepening` (48 files, 509 unit tests after the merge). One step in phone-map
  (clicking a day-2 stop at 360 px) timed out in 2 of 4 phone-shell runs; phone-map alone passed 4
  of 4, so it looks flaky under load, not caused by this change.
- `pnpm verify:docs`: valid. `pnpm verify:protected`: rules hold. Pair check: passes after `--record`.

## Notes for the next person

- Settings opened from the navigation drawer now keeps the drawer beneath it.
- Ticket #201 also edits `useWorkspaceController.ts`; expect a merge there.
