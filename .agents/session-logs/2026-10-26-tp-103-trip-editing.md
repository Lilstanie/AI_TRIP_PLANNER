---
date: 2026-10-26
author: Codex
branch: feature/TP-103-trip-editing
pr: none
area: apps/web, docs
contract-impact: api
---

# Add Stops and Ideas through the revision API; gate AI replacement after direct edits

## What changed

- Added the `add` operation to `apps/web/lib/trip/trip-edit.ts`; additions use a stable caller ID, require a complete confirmed schedule for Stops, leave Ideas unscheduled, reject overlap, preserve existing Stop times, and keep unknown place/cost data absent.
- Extended `useTimelineEdits` with add/Undo and created controlled `AddStop` and `TripChatShortcut` components.
- Added transport consent for direct Plan changes before submit/send/answer/retry. Cancel exits before dispatch or attachment clearing; Plan remains in place until a successful response.
- Updated EN/ZH API docs and ZH messages; added `trip-add-stop.e2e.mjs` with API behavior and workspace UI coverage.

## Why

- `AddStop` takes `draft: AddStopDraft` and `onDraftChange` so the shared draft controller can persist unfinished input under a stable per-trip add identity. It takes selected-day suggestions through `suggestedTimesForDay`, visibly labels them editable, and delegates Cancel through `onRequestCancel` for the shared discard gate.
- The final workspace mount belongs to TP-102; this branch does not edit `WorkspaceView.tsx`, `TripEditor.tsx`, or `StopForms.tsx`.

## Validation

- `pnpm --filter @trip/web typecheck` — passed.
- Direct Prettier check on all ticket files — passed.
- `pnpm verify:pairs`, `pnpm verify:docs`, `git diff --check` — passed.
- `BASE_URL=http://localhost:3113 node apps/web/tests/e2e/trip-add-stop.e2e.mjs` — six API assertions passed; UI mount assertion failed because parent-owned composition has not wired `AddStop` yet.

## Notes for the next person

- Mount `AddStop` with the shared trip draft controller using `AddStopDraft`/`emptyAddStopDraft(day, suggestedTimes)`, pass `suggestedTimesForDay`, and implement `onRequestCancel` with the shared discard gate. Send `TripChatShortcut` messages through the existing transport `send` callback. E2E reads the real catalog and reopens the saved Trip; after mounting, complete the UI/replan path assertions.
- `pnpm format:check-changed` still reports the already-committed TP-102 proposal markdown as unformatted; ticket files pass direct Prettier check.
