---
date: 2026-11-04
author: Claude (refinement sweep)
branch: refactor/workspace-history-model
pr: pending
area: apps/web
contract-impact: none
---

# Sidebar history lists move out of useWorkspace

## What changed

- `apps/web/lib/workspace/history.ts`: `historyLists()` builds the sidebar's chat and trip rows
  (titles, subtitles, active and untouched flags) from the catalog and search query; it renders
  nothing and holds no React state.
- `apps/web/components/workspace/useWorkspace.ts` calls it instead of deriving the rows inline
  (999 → 981 lines; the file sat one line under the 1000-line limit).
- `apps/web/tests/e2e/trip-rename-delete.e2e.mjs`: waits for the composer to turn `readOnly` and back
  after sending. It waited on `disabled`, which the textarea never sets, so the replan check relied on
  a 1.5 s settle and failed when the dev server was compiling.

## Validation

- `pnpm --filter @trip/web exec vitest run`: 68 files, 683 tests passed; web `tsc` and eslint clean.
- `trip-rename-delete.e2e.mjs`: `main` 3/3 runs pass; before the wait fix the branch failed 2 of 5
  (both right after a recompile, `budgetBefore === budgetAfter`); after it, 2/2 pass with 18 checks.
- `sidebar-entries.e2e.mjs`: one run with `FAIL zh expanded: 新聊天 entry present with accessible
  name`, the next run clean; not investigated.

## Notes for the next person

- `long-term-memory.e2e.mjs:156` waits on `.composer__input` `disabled` the same way; its responses
  are routed, so a `readOnly` wait needs checking there before it is copied.
