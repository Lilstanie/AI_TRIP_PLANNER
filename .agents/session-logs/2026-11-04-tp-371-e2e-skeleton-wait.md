---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/TP-371-e2e-skeleton-wait
pr: pending
area: apps/web/tests/e2e
contract-impact: none
---

# TP-371: E2E scripts wait for the real workspace, not its loading skeleton

## What changed

- 41 scripts under `apps/web/tests/e2e/` wait on `.workspace-app:not([aria-busy])` instead of
  `.workspace-app` (both `locator(...).waitFor()` and `waitForSelector(...)`).

## Why

`WorkspaceSkeleton` renders `.workspace-app` with `aria-busy="true"` and no sidebar; the real
workspace never sets `aria-busy` on that element. On a slow load the wait matched the skeleton, so
`sidebar-entries` counted zero sidebar buttons and failed "zh expanded: 新聊天 entry present with
accessible name" in about 1 of 8 runs, while later checks in the same run passed.

## Validation

- Six fresh zh loads in a probe listed the real sidebar each time; the failing run's timing matched
  the skeleton window.
- `pnpm verify:e2e-selectors` passes; repeated `sidebar-entries`, `phone-finish` and
  `trip-rename-delete` runs are recorded in the PR.

## Notes for the next person

none
