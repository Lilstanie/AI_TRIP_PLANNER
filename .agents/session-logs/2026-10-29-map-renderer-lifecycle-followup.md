---
date: 2026-10-29
author: Codex
branch: fix/TP-149-map-lifecycle
pr: 782
area: apps/web, docs
contract-impact: none
---

# Finish #789 review gates and lifecycle note

## What changed

- Added `.agents/notes/implemented/architecture/2026-10-29-map-runtime-lifecycle.md` for renderer ownership.
- Switched fixture/MapLibre class checks in `map-renderer-lifecycle.e2e.mjs` to attribute selectors so
  `pnpm verify:e2e-selectors` passes without editing the protected allowlist.

## Why

The lifecycle fix was already on `5bfac908`; the remaining gate failure was the selector verifier, and
the lasting ownership rule still needed an implemented Agent Note.

## Validation

- `BASE_URL=http://127.0.0.1:3198 LABEL=green-final-selector-fix node apps/web/tests/e2e/map-renderer-lifecycle.e2e.mjs` — 64/64.
- `pnpm --filter @trip/web exec tsc --noEmit --project tsconfig.map-lifecycle.json` — pass.
- `pnpm --filter @trip/web lint` — pass with existing ChatPanel/PhoneTrajectory warnings.
- `pnpm --filter @trip/web build` — pass.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`,
  `format:check-changed c18eeced` — pass.
- Scoped added-comment check against `c18eeced` — no violations.

## Notes for the next person

Keep red artifacts under `output/playwright/map-renderer-lifecycle/`. This branch already contains
integration tip `4be0a550` through `c18eeced`; do not push or merge into integration from here.
