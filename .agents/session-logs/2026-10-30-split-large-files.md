---
date: 2026-10-30
author: Claude Code (for Joey)
branch: refactor/TP-167-split-large-files
pr: pending
area: apps/web
contract-impact: none
---

# Split the three web files over 1,000 lines, with no behaviour change (TP-167)

## What changed

- `components/trajectory/TrajectoryTable.tsx` (1,555 lines) now keeps the ledger only (758);
  the details aside moved to `TrajectoryInspector.tsx`, record logic to
  `trajectory-table-records.ts`, kind label/icon/tag maps to `trajectory-kind.tsx`.
- `TrajectoryTable.module.css` (1,341) split into the ledger module (744) and
  `TrajectoryInspector.module.css` (607).
- `app/styles/agent-lab.css` (1,145) is now five ordered `@import`s (`agent-lab-shell`, `-trace`,
  `-results`, `-compare`, `-faults`); their concatenation equals the old file byte for byte.
- New note `implemented/architecture/2026-10-30-split-trajectory-ledger.md`; the Trajectory tab note's
  file-size exception now links to it. `comment-exceptions.json` lists the MIT header on the three new
  copied files and the inspector's JSDoc.

## Why

Joey asked for every file over the 1,000-line rule to be split. PR #782 already brings
`SettingsDialog.tsx` (1,027) and `Workspace.test.tsx` (1,096) under the limit, so they are left alone.

## Validation

- `pnpm --filter @trip/web typecheck`, `lint` (existing warnings only), `test` (57 files, 635 tests):
  pass. `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`,
  `verify:e2e-artifacts`, `format:check-changed origin/main`, `check-ui-copy`: pass.
- `e2e run agent-lab-single-agent`: passed. `e2e phone-navigation`: 233 ok, exit 0.
- `e2e trajectory-tab`: 59 ok, then times out reopening the chat after reload; `main` `ec70e0d`
  stops at the same step with the same 59 ok lines.
- Style parity: a temporary dump after the inspector screenshot recorded computed styles and boxes of
  all 683 ledger and inspector elements at widths 600 to 1440 on `main` and on this branch: 0 differ.

## Notes for the next person

- The `trajectory-tab` reload failure exists on `main`; it is outside the ledger.
- The cloud container's Playwright (1194) needs the preinstalled 1243 browser linked in its place.
