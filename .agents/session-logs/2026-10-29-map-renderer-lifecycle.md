---
date: 2026-10-29
author: Codex
branch: fix/TP-149-map-lifecycle
pr: 782
area: apps/web, docs
contract-impact: none
---

# Recover map renderer failures and safe unmounts

## What changed

- Added renderer-owned DOM, tracked listeners and idempotent disposal in `TripMap`, `map-renderer` and
  the Google host callback subscription.
- Removed stale failed renderer layers, made phone Trip-home map height definite and covered desktop,
  phone, language and 520/521 breakpoint transitions in the isolated browser fixture.
- Added the failure inventory, English/Chinese lifecycle documentation and a credential-free local
  Google SDK boundary; MapLibre remains real with an empty local style.

## Why

The previous lifecycle mixed Google and MapLibre handles, kept stale error layers after fallback and
restored a mutable host callback that synchronous disposal could clear. Renderer ownership now follows
the matching subscribe and destroy contract. A fresh mount probes its configured provider again.

## Validation

- Retained red controls before the fix under `output/playwright/map-renderer-lifecycle/`, including
  `green-final-premerge4/summary.json` for the three phone failures and
  `host-callback-red-control/summary.json` for the lost previous host callback.
- `pnpm --filter @trip/web exec tsc --noEmit -p tsconfig.map-lifecycle.json` passed.
- `pnpm --filter @trip/web lint` passed with existing hook warnings.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`,
  `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts` and changed-file formatting passed.
- The full isolated production `map-renderer-lifecycle` suite passed under the final commit label;
  exact assertions, evidence and commit are reported in the T1 handoff.

## Notes for the next person

The browser fixture uses a controlled Google SDK, intercepted external HTTP, mock data and an empty
MapLibre style. It does not establish live Google behavior, production auth, route accuracy or
physical-device rendering. Red and green summaries remain under their labels for comparison.
