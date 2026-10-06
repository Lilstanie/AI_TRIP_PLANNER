---
date: 2026-10-06
author: Claude Code
branch: fix/188-installability-e2e
pr: none
area: apps/web, docs
contract-impact: none
---

# Installable-app E2E: installability probe can now pass and fail for real (#188)

## What changed

- `apps/web/tests/e2e/installable-app.e2e.mjs`: Chrome's installability probe moved out of the
  `newContext()` loop into `installabilityErrors()`, which uses `launchPersistentContext` on a
  throwaway profile in full Chromium (`CHANNEL` or `chromium`). Added a probe self-check that removes
  the manifest link at runtime and expects `no-manifest`. The main browser now honours `CHANNEL`.
- A missing manifest no longer crashes the run on `.json()`; the manifest checks fail and the run
  reaches the installability check.
- `docs/development.md` and `.zh.md`: why the probe needs full Chromium and a persistent profile.

## Why

Probed every combination against the same production build:

| Browser / context | normal page | manifest link removed |
| --- | --- | --- |
| headless shell, `newContext` (old harness) | `[]` | `[]` (probe was blind) |
| full Chromium, `newContext` | `in-incognito` | `in-incognito, no-manifest` |
| full Chromium, persistent | `[]` | `no-manifest` |

So the old check passed vacuously by default and was always red with `CHANNEL=chrome`.

## Validation

- Production build on port 3105 (`NEXT_DIST_DIR=.next-3105`, `DATA_MODE=mock`):
  `node apps/web/tests/e2e/installable-app.e2e.mjs` 24/24 passed.
- Same script against a build with `apps/web/app/manifest.ts` temporarily removed (port 3106):
  13/21, including `FAIL desktop: Chrome reports no installability errors (no-manifest)`. The file
  was restored before committing.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`, `pnpm verify:docs` passed.
- `check-pairs.mjs --record docs/development.md` recorded the pair; the full pairing check still
  fails on `docs/workspace-ui.md`, which was already stale on the base branch and is not touched here.

## Notes for the next person

- Only Playwright's bundled Chromium was available here; `CHANNEL=chrome` was not run.
- `next build` with a custom `NEXT_DIST_DIR` rewrites `apps/web/tsconfig.json`; revert it.
