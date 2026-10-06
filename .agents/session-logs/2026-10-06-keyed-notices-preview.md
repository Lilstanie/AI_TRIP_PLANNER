---
date: 2026-10-06
author: Claude Code
branch: refactor/keyed-notices-preview
pr: none
area: apps/web, docs
contract-impact: api
---

# Edit preview blockers and refusals arrive as Notices (#204)

## What changed

- `lib/trip/trip-edit.ts` and `lib/trip/item-actions.ts` throw `NoticeError`; `previewEdit` builds
  blockers as Notices and returns `blockerNotices` beside the English `blockers`.
- `app/api/trip/preview-edit/route.ts` answers a refusal with `{ error, notice }`; a non-Notice
  error is `{ raw }`.
- `useTimelineEdits`, `EditPreviewPanel` and `TripPlaceList` show the Notices; the four trip-edit
  patterns left `NOTICE_PATTERNS`. Eleven refusal keys gained Chinese entries.
- Tests: `tests/lib/trip/trip-edit.test.ts` (new notice cases), `tests/lib/trip/item-actions.test.ts`,
  `tests/app/api/trip/preview-edit/route.test.ts`; E2E `workspace-chinese` now feeds keyed blockers
  and a keyed refusal, `timeline` sets `blockerNotices`.
- Docs: `docs/api.md`, `docs/workspace-ui.md` and pairs, `better-writing` skill, Agent Note
  [edit-preview-notices](../notes/implemented/architecture/2026-10-06-edit-preview-notices.md).

## Why

English fields stay beside the Notices so an older client keeps working (spec #196).

## Validation

- `pnpm --filter @trip/web lint`, `typecheck`, `test` (48 files, 478 tests): pass.
- `pnpm verify:docs`, `pnpm verify:protected`, translate-docs `check-pairs.mjs`: pass.
- E2E against `DATA_MODE=mock next dev -p 3104`: `workspace-chinese` all ok; `timeline` all ok, one
  skip (route check needs a map key).

## Notes for the next person

- "needs at least N minutes" is only reachable through verify, time and undo, which keep it on the
  plan in English, not as a preview blocker.
- Route provider errors (`lib/integrations/google.ts`) and place search errors are still English;
  `useTimelineEdits().error` is `Notice | string` until search is keyed (#205).
