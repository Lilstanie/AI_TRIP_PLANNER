---
date: 2026-10-08
author: Claude (Projects thread, Haiku 5.5)
branch: feature/trip-drawer-no-confirmations
pr: 258
area: apps/web (trip timeline), docs, E2E
contract-impact: none
---

# Timeline edits apply at once with Undo (#235)

## What changed

- `useTimelineEdits.ts`: an edit is checked by `/api/trip/preview-edit`; an accepted plan applies at once; a refused
  edit shows its blockers as an alert. Undo replays the previous activities through the same path.
- `TripEditor.tsx`: renders the error list and the Undo step; the preview panel is no longer rendered.
- `timeline/EditPreviewPanel.tsx`: removed. "Preview time change" is now "Change time".
- `workspace-messages.ts`: removed the review-panel strings and added "Change time" (zh: 修改时间).
- E2E: `timeline`, `itinerary` and `workspace-chinese` updated; `TripEditor.test.tsx` drops the preview tests.
- Docs: `workspace-ui.md` and `.zh.md` describe the immediate apply; the pair is recorded.
- Agent Note: `.agents/notes/implemented/feature/2026-10-08-immediate-timeline-edits.md`.

## Why

Spec #233 removes confirmations. The server still checks each edit, so the client cannot apply without it.

## Validation

- `pnpm --filter @trip/web e2e timeline` (DATA_MODE=mock): 46 checks pass, 0 fail, 1 skip (route check needs a map key).
- `pnpm --filter @trip/web e2e itinerary`: 60 checks pass, 0 fail.
- `pnpm --filter @trip/web e2e workspace-chinese` (in the same run as itinerary): no failures.
- `tsc --noEmit`, `pnpm --filter @trip/web lint`, vitest `TripEditor.test.tsx`: pass.

## Notes for the next person

- The route-check assertions are skipped without a Google key; run them in an environment with one.
- The cold-start mock-data check needed a wait for the toggle to render; see `timeline.e2e.mjs`.
- Stop-level conflict markers are not built.
