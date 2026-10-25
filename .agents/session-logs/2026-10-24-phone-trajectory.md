---
date: 2026-10-24
author: Claude Sonnet 5.5
branch: feature/TP-76-phone-trajectory
pr: none
area: apps/web, docs
contract-impact: none
---

# Trajectory tab and team sheet on the phone (#672, TP-76)

## What changed

- `lib/workspace/layout.ts`, `catalog.ts`: `MobileView` gains `trajectory` (saved, and mapped to chat when widening).
- `components/workspace/PhoneTabBar.tsx`, `components/ui/icons.tsx`, `app/styles/phone-shell.css`: a fifth tab with a ledger icon.
- `components/workspace/PhoneTrajectory.tsx`, `WorkspaceView.tsx`: the panel, the phone's filter state and the focus request.
- `components/workspace/PhoneTeamButton.tsx`: cards now pass `onSelect`, close the sheet and open the filtered trajectory.
- `components/trajectory/TrajectoryTab.tsx`, `TrajectoryView.tsx`: `phone` hides the timeline overview.
- `components/trajectory/TrajectoryTable.module.css`: the inspector is full width at 520 px and below.
- E2E: `trajectory-phone` with its failure inventory; `phone-shell` now expects five tabs.
- Docs: `workspace-ui` en and zh, Agent Note `implemented/feature/2026-10-24-phone-trajectory.md`.

## Why

The phone had no place to open the trajectory, so the team sheet cards stayed disabled after #671.

## Validation

- `redgreen.mjs --base origin/feature/TP-72-trajectory trajectory-phone`: before 1/3 ok (failed), after 79/79 ok (passed).
- Also run: `phone-shell`, `phone-state`, `phone-map`, `team-panel-phone`, `trajectory-tab`, `team-thinking`.
- `pnpm typecheck`, `pnpm lint`, `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`,
  `verify:e2e-artifacts`, `check-ui-copy` and the added-comment check pass.

## Notes for the next person

- Playwright wants build 1194 and the sandbox has 1243; `PLAYWRIGHT_BROWSERS_PATH` pointed at a symlinked copy.
- `phone-shell` runs `phone-map` as a companion; that walk timed out once under load and passed alone.
- The phone and desktop filters are separate state, so crossing 520 px clears it.
