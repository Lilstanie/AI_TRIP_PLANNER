---
date: 2026-09-24
author: Claude Code (Opus 5.5)
branch: refactor/remove-saved-trips
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Retire the Save trip button and the Saved trips dialog

## What changed

- Removed the Save trip button (`TripPanel`, and its now-unused `busy` prop), the Saved trips
  dialog (`WorkspaceDialogs`, `DialogKind "saved"`), the sidebar's Saved trips entry and
  `BookmarkIcon`, and `save`/`loadSaved`/`restore` from `useWorkspaceStorage` and
  `useWorkspaceController`.
- Removed `SAVED_KEY`, `parseSaved`, `RestoredWorkspace.saved` and the `legacySaved` path of
  `parseCatalog`; `restoreWorkspace` no longer reads `trip-saved-v1` and never deletes it.
- Rewrote the Workspace abort test to open a trip from Trips history. Its fetch mock now holds only
  `/api/chat` open; the old one let place requests replace the pending resolver, so it passed even
  with the controller reset removed from `resetTransient`.
- Updated `docs/workspace-ui.md`, `docs/roadmap.md`, `docs/design/class-diagram.md`, three skills and
  the Redis note; added the
  [catalog storage note](../notes/implemented/architecture/2026-09-24-workspace-catalog-trip-storage.md)
  and archived the browser-local trip storage note.

## Why

Every planned trip already autosaves to the catalog and appears under Trips, and the only way into
the dialog was the removed sidebar entry. A peer session relayed the user's wider scope: stop reading
`trip-saved-v1` instead of keeping it as migration input.

## Validation

- `pnpm --filter @trip/web typecheck`: passed.
- `pnpm --filter @trip/web test`: 37 files, 363 tests passed.
- `pnpm --filter @trip/web lint`: no warnings or errors.
- Mutation check: removing `active.current?.abort(); active.current = null;` from `resetTransient`
  makes the rewritten abort test fail.

## Notes for the next person

- The uncommitted `feature/trips-page-chat-flyout` work in the main checkout also edits
  `WorkspaceSidebar.tsx`, `WorkspaceView.tsx` and `useWorkspaceController.ts`; expect conflicts.
- No browser check was run; the change only removes UI.
