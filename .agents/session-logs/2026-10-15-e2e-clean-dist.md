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
  directory, its `.next-e2e-<random>.lock` owner file and its temporary config. Passed, failed and
  interrupted runs behave the same.
- `apps/web/tests/e2e/legacy-stale-dist.mjs`: new. Each start sweeps a directory whose owner pid has
  exited, or that has no owner and is over a day old. Names outside `.next-e2e-<6 characters>`,
  symlinks and `.next-e2e-local-*` are never touched.
- `apps/web/tests/cli-e2e/legacy-runner.e2e.mjs`: four checks for the sweep and the exit removal.
- `apps/web/vitest.config.ts`: `execArgv: ["--no-experimental-webstorage"]`, so a direct `vitest run`
  no longer fails every test that touches `localStorage`.
- `docs/development.md` and its pair, and the testing Agent Note, state the new retention rule.

## Why

42 retained directories held 6.6 GB; nothing read them. The owner file sits beside the directory, not
inside it, because `next build` empties its `distDir`. A direct `pnpm exec vitest run` skipped the
`NODE_OPTIONS` that `pnpm test` sets and failed 43 of 43 tests.

## Validation

- `node apps/web/tests/cli-e2e/legacy-runner.e2e.mjs`: 8 existing checks passed; the 4 new ones failed
  before the sweep existed and passed after (12 of 12). With `alive()` forced to false, the
  keep-live-owner check and the final no-leftovers check fail.
- `pnpm exec vitest run tests/lib/trip tests/lib/planning` without `NODE_OPTIONS`: 50 passed.
- `pnpm --filter @trip/web e2e trip-day-count` (keys emptied, mock data), run before the sweep was
  added: passed with no `.next-e2e-*` left.
- `verify:docs`, `verify:protected`, the translation-pair check and prettier: see the commit.

## Notes for the next person

- The owner pid is trusted only while that process is alive; a reused pid keeps a directory until it
  is over a day old and unowned, never deletes a live one.
- `local-cli.mjs` (`.next-e2e-local-*`) has its own ownership and cleanup and is unchanged.
