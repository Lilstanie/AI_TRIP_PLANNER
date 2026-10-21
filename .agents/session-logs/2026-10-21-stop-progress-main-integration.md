---
date: 2026-10-21
author: Codex
branch: fix/stop-progress-merge-audit
pr: 457
area: packages/shared, apps/web, docs
contract-impact: packages/shared
---

# Integrate stop progress with latest main and strengthen browser evidence

## What changed

- Merged `origin/main` at `577202a719af91d98abe2cfeeac23ab10e7c8e52` into the stop-progress branch.
- Extended `apps/web/tests/e2e/stop-progress.e2e.mjs` to assert Planned default, keyboard activation and Undo, and no automatic next-stop selection with a second stop.
- Kept the existing #454 shared Agent Note and English/Chinese workspace documentation.

## Why

The PR needed current-main integration and explicit browser evidence for the contract's default, keyboard, and no-auto-next behavior. The shared `ProposalItem.progress` contract remains documented by the feature Agent Note.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e stop-progress`: passed (172s); runner `output/e2e/runner/2026-10-21T00-41-56-013Z.json`; results `output/playwright/stop-progress/after/results.json`.
- `pnpm typecheck`: 6 tasks successful (5 cached).
- `pnpm --filter @trip/shared test`: 4 files / 58 tests passed.
- `pnpm --filter @trip/web test`: 57 files / 642 tests passed.
- `pnpm --filter @trip/web lint`: passed.

## Notes for the next person

Browser evidence uses mock data and local saved trips; it does not verify authenticated Clerk sync or physical-device behavior. Chat replanning may replace stop progress with a newly generated itinerary.
