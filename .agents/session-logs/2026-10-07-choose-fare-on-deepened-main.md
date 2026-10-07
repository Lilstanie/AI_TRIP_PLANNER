---
date: 2026-10-07
author: Claude
branch: feature/choose-fare-and-stay
pr: 212
area: apps/web, docs
contract-impact: api
---

# Bring #212 onto the deepened workspace, and keep a swapped fare's return date

## What changed

- Merged `main` (with #207's keyed notices and `useWorkspace` actions) into this branch.
- `apps/web/components/trip/useChooseCandidate.ts`: the swap request moved out of `WorkspaceView`.
  It applies through `session.applyEdit`, holds planning with `session.trackEdit`, aborts when the
  plan changes and shows failures as keyed notices in the Trip panel.
- `apps/web/lib/trip/trip-edit.ts`: `choose` refusals are `NoticeError`s with Chinese entries; a
  swapped `flight-0` fare names the return date as the transport agent's sentence does.
- `apps/web/tests/e2e/choose-fare-and-stay.e2e.mjs`: new browser E2E at 1440 and 390 px.
- `docs/api.md` and its Chinese pair describe the `choose` operation.

## Why

The branch predated #207: `WorkspaceView` no longer owns plan or notice state, and a plain string
notice would show English in the Chinese interface. Its swap also ignored a late response after the
traveller opened another trip.

## Validation

- `pnpm typecheck`, `pnpm --filter @trip/web lint`: clean. `pnpm test`: all packages pass (web 592).
- `DATA_MODE=mock pnpm --filter @trip/web e2e choose-fare-and-stay`: 18/18. With the return-date
  line removed, both widths fail "the swapped outbound fare keeps its return date".

## Notes for the next person

The late-response guard is covered by reading the code, not by the E2E.
