---
date: 2026-10-29
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: none
area: apps/web, docs
contract-impact: none
---

# Keep Trip Chats and five actions in Trip home

## What changed

- Added Home-local Chat selection, the right action rail and five drawers in `WorkspaceView` and
  `TripHome*` components.
- Connected Itinerary, Calendar and map day focus; reused scheduling, preference persistence and
  linked Trip Chat creation for Ideas and suggestions.
- Added responsive, bilingual and accessible drawer presentation with desktop split resizing.
- Recorded the decision in `2026-10-29-trip-home-actions.md` and updated the workspace documentation.

## Why

One Trip can contain several planning conversations. Keeping actions beside the selected Chat and
map preserves that context instead of sending the traveller to unrelated workspace pages.

## Validation

- Production fixture E2E used Chrome 156.0.8078.49, Node 25.9.0 and pnpm 9.15.0, with Maps,
  model and Clerk credentials blanked; `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true`.
- `LABEL=integration-final-9 pnpm --filter @trip/web e2e trip-home-action-rail --prod` passed
  70 assertions: 375/390/520/521/1000/1001/1024/1440px, EN/ZH, keyboard, 125%/150% zoom.
- `LABEL=integration-final-8 pnpm --filter @trip/web e2e trip-home-action-rail trip-home-calendar trip-home-ideas-bookings trip-home-preferences trip-home-walkthrough trip-home-older-chat --prod`
  passed the other five journeys (22/15/14/96/10 assertions). Its action-rail failure was a
  restoration-save race in the test; final-9 waits for the persisted blank Chat before navigation.
- Earlier review runs retained red evidence for stale Plan data, drawer geometry and Idea feedback;
  final evidence is under `output/playwright/trip-home-*/integration-final-{8,9}`.
- `pnpm --filter @trip/web typecheck`, `lint` and `test` passed; 57 test files / 635 tests.
  Lint has existing ChatPanel and PhoneTrajectory hook warnings.
- Docs, translation pairs, protected files, E2E selectors/artifacts, UI copy, changed-file formatting
  and the scoped added-comment check passed.

## Notes for the next person

`trip-workspace-layout` fails three checks identically on main `8089967b` and this branch: two Team
avatar assertions and a missing topbar-title timeout. Baseline evidence is in `/tmp/trip-home-layout-baseline-vlqjs3z4-artifacts`;
existing issue #781 tracks it. An earlier run inherited an expired Google browser key; credential-free
MapLibre fixture runs pass. Browser fixtures do not certify live providers or physical devices.
Trip home is not restored after a full page reload. Jira TP-144–TP-148 are assigned; merge is pending.
