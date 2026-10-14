---
date: 2026-10-14
author: Codex
branch: fix/issues-323-330
pr: none
area: packages/services, packages/tools
contract-impact: none
---

# Close issue 326 and 327 acceptance evidence gaps

## What changed

- Added a local Redis REST-compatible HTTP service acceptance test for large Unicode plan and chat
  persistence, verifying POST JSON, compact URL, bearer auth, and exact round-trip content.
- Added weather offset-zero coverage, exact requested-date evidence checks across offsets 0, 9, 10,
  13, 14 and 15, and a superseding note correcting the provider calendar boundaries.

## Why

Failure inventory before edits: Redis can put payload data in the URL, send an unsupported command/body shape, omit JSON/auth headers, corrupt large Unicode data, mishandle Redis result envelopes, or hide provider errors. Weather can select a provider with too few entries at offsets 0, 9, 10, 13 or 14; return evidence for a different date; miscount destination-local days around UTC midnight; or present offset 15+ climate as a forecast.

## Validation

- `pnpm --filter @trip/services exec vitest run tests/durable.test.ts` — passed (5 tests).
- `pnpm --filter @trip/tools exec vitest run tests/weather.test.ts` — passed (13 tests).
- `pnpm --filter @trip/services test` — passed (6 tests); `pnpm --filter @trip/tools test` — passed
  (140 tests).
- Both affected package typechecks, `pnpm verify:docs`, `pnpm verify:protected`, and
  `pnpm format:check-changed origin/main` — passed.
- Added-comment check for both changed test files and `git diff --check` — passed.

## Notes for the next person

- Existing unrelated worktree changes and untracked artifacts were present before this task and are being left untouched.
- The branch-wide spec review also found acceptance-evidence gaps for #323, #328, #329 and #330;
  those issues were outside this #326/#327 review-fix scope.
