---
date: 2026-11-01
author: Claude Code for Joey
branch: refactor/TP-245-workspace-folders
pr: none
area: apps/web, docs
contract-impact: none
---

# Group Trip home and phone files under components/workspace (TP-245)

## What changed

- `apps/web/components/workspace/trip-home/`: the 11 `TripHome*` components and `useTripHomeActionPanel.ts`.
- `apps/web/components/workspace/phone/`: the six `Phone*` components and `usePhoneBack`, `usePhoneKeyboard`, `usePhoneTripUpdates`.
- Imports rewritten to the new paths; no code changed. `docs/development.md` (+ `.zh.md`) names the two folders; `docs/workspace-ui.md` (+ `.zh.md`) file paths updated.

## Why

`components/workspace` held 43 files in one folder. Joey picked this move and the lib move (TP-246) as the low-risk part of the structure review on 2026-11-01; CSS folders and `packages/orchestrator` wait until after Stage 2.

## Validation

- `pnpm --filter @trip/web typecheck` passed.
- `pnpm --filter @trip/web test`: 60 files, 662 tests passed.
- `pnpm --filter @trip/web lint`: only the existing PhoneTrajectory hook warning.

## Notes for the next person

Dated session logs keep the old paths; they are frozen history.
