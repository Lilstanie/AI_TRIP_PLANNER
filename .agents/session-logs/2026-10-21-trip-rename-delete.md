---
date: 2026-10-21
author: Claude
branch: feature/trip-rename-delete
pr: none
area: apps/web, docs
contract-impact: none
---

# Rename and delete trips

## What changed

- `TripRecord.renamed` keeps a traveller's trip name through replans (`upsertCurrent`), reloads (`parseTrip`) and account sync.
- `tripName` in `trip-identity.ts` gives every surface the same name: Trips list, Trips page cards, calendar bars and the top title (desktop and phone).
- Trip rows and trip cards reuse the chat row's Rename/Delete menu (#483). Delete keeps the trip's chats without their plan; `TripUndo` offers Undo, which restores the trip and its chat links.
- Anchored two older E2E selectors that now also matched the trip Actions button, and rounded sub-pixel sizes in the phone-mine 44 px check.
- Updated the English and Chinese UI documentation.

## Validation

- Failure inventory written first: `apps/web/tests/e2e/trip-rename-delete.failures.md`.
- `LABEL=before pnpm -s e2e trip-rename-delete --prod` on main: failed at "trip row has an Actions menu". After: 16/16 checks passed (desktop 1440 and phone 390).
- `phone-mine`, `calendar-trip-identity-search`, `workspace-control-overflow`: pass.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed; `Workspace.test.tsx` now expects the trip menu instead of its absence. Web typecheck and lint passed.

## Notes for the next person

- Rename uses `window.prompt`, like chat rename.
- Account sync is covered by the record format only; not run against a real database.
