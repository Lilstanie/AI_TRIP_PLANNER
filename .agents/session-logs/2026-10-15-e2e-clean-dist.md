---
date: 2026-10-15
author: Claude Sonnet 5.5
branch: chore/e2e-clean-dist
pr: none
area: apps/web, docs
contract-impact: none
---

# The raw E2E runner removes its build directory on exit

## What changed

- `apps/web/tests/e2e/legacy-runner.mjs`: the exit handler removes the run's `.next-e2e-<random>`
  directory unless `E2E_KEEP_DIST=1`. The name must match the runner's own pattern first.
- `apps/web/vitest.config.ts`: `execArgv: ["--no-experimental-webstorage"]`, so a direct `vitest run`
  no longer fails every test that touches `localStorage`.
- `docs/development.md` and its pair, and the testing Agent Note, state the new retention rule.

## Why

42 retained directories held 6.6 GB. A direct `pnpm exec vitest run` skipped the `NODE_OPTIONS` that
`pnpm test` sets and failed 43 of 43 tests.

## Validation

Run in the `fix/trip-day-count` checkout before the patch was moved here:

- `pnpm exec vitest run tests/lib/trip tests/lib/planning` without `NODE_OPTIONS`: 50 passed.
- `pnpm --filter @trip/web e2e trip-day-count` (keys emptied, mock data): passed, and no `.next-e2e-*`
  directory remained afterwards.
- `verify:docs`, `verify:e2e-selectors`, the added-comment check and prettier on the changed files: pass.

## Notes for the next person

- Only the success path was observed; the interrupted and failed paths rely on the same exit handler.
- `local-cli.mjs` (`.next-e2e-local-*`) has its own ownership and cleanup and is unchanged.
- A SIGKILL can still leave a directory behind.
