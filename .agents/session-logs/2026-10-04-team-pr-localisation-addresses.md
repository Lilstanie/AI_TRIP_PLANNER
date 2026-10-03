---
date: 2026-10-04
author: Codex
branch: feature/localisation-currency
pr: none
area: apps/web, packages/tools, docs
contract-impact: api
---

# Synchronize the team provider refactor before opening the frontend PR

## What changed

- Fetched team main at b3d71e0 and resolved conflicts in tools index/maps without restoring raw adapter exports.
- Kept the team's deep Maps port and moved shared Nominatim throttling into maps-port.
- Location lookup uses captured configuration and injected fetch; exposed the user utility through a separate location subpath, not the agent entry point.
- Updated the tools README and address Agent Note to describe the boundary.

## Why

The user asks to submit the personal frontend branch to the team using its normal PR workflow.
The team merged four provider-refactor commits after the previous personal push.

## Validation

- `corepack pnpm --filter './packages/**' --filter @trip/web -r run test`: 988 tests passed; existing jsdom canvas warnings remain.
- The same package selection's `typecheck` passed; `corepack pnpm --filter @trip/web lint` passed without warnings.
- `NEXT_DIST_DIR=.next-pr-check corepack pnpm --filter @trip/web build` passed; removed only its generated tsconfig include afterward and moved the build artifact outside the repository.
- Playwright structured-address (13 checks) and localisation-currency (16 checks) scripts passed after integration, at desktop/phone widths.
- Existing gateway boundary and provider-matrix tests passed in the package regression run.

## Notes for the next person

- PR target is Lilstanie/AI_TRIP_PLANNER main, source WhW0591 feature/localisation-currency; no automatic merge.
- New public location subpath is intentionally limited to explicit user interaction, independent of planning data mode.
- Public Nominatim still needs deployment-wide rate limiting for multiple processes; manual address entry remains available.
