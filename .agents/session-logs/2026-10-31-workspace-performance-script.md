---
date: 2026-10-31
author: Claude Code
branch: fix/TP-201-workspace-performance
pr: none
area: apps/web
contract-impact: none
---

# The workspace performance journey runs again on main

## What changed

- `workspace-performance.e2e.mjs`: the planned-storage case waits for the opened Chat's Trip name
  in the header, then for the first typed draft in the mirror, instead of a mirror write on open.
- `run-performance.mjs` runs only `workspace-performance`; `map-animation-lifecycle` was deleted
  by TP-165, and its synthetic Maps key went with it.
- `docs/e2e-known-failures.md`, `docs/development.md` and their pairs drop both entries and the
  workaround.

## Why

Since #783, `useWorkspaceStorage` skips the save when the opened Chat's snapshot is unchanged, so
opening a Chat writes nothing. The script still waited for that write and timed out.

## Validation

- `DATA_MODE=mock pnpm --filter @trip/web e2e workspace-performance --prod`: passed.
- `DATA_MODE=mock pnpm --filter @trip/web e2e trip-workspace-layout --prod`: passed with Chrome.
- `node apps/web/tests/e2e/run-performance.mjs`: built and started the workspace journey; the
  cloud container's Playwright then had no browser build (`fixtureEnv` drops `PLAYWRIGHT`).

## Notes for the next person

`trajectory-tab` is still listed as failing on main.
