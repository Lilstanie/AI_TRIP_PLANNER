---
date: 2026-10-21
author: Codex
branch: fix/workspace-control-overflow
pr: 489
area: apps/web, docs
contract-impact: none
---

# Integrate day-panel semantics with narrow workspace controls

## What changed

- Merged main's day-tab semantics (#473) into the control-overflow branch.
- Inspected the combined UI documentation and component diff; no production conflict required resolution.

## Validation

- Tested revision `f158c3a3d5ffe33a46194bc16f088168db0ef086`, tree `7c8c2a7adfa27f73d0520d5582545fd674a45fc7`.
- `LABEL=post-473 pnpm --filter @trip/web e2e workspace-control-overflow`: exit 0, 191 assertions in 36 seconds, EN/ZH and 375–1440 px.
- Runner `output/e2e/runner/2026-10-21T01-32-28-932Z.json`; screenshots/results `output/playwright/workspace-control-overflow/post-473/`.
- `pnpm --filter @trip/web typecheck`, `pnpm verify:docs`, `pnpm verify:pairs` (27 pairs), `pnpm verify:protected`, `git diff --check`: passed.
- Earlier web tests (642/57 files), web lint, artifact/selector guards and added-comment review are recorded in the preceding session log; this integration changes day-panel semantics and shared UI prose.

## Notes for the next person

- Visual review also noticed horizontal scrolling/clipping in the extreme narrow desktop drawer; that is being checked separately from the three bounded control fixes.
- Fixture browser evidence does not establish live-provider, authentication or physical-device behavior.
