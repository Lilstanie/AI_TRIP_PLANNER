---
date: 2026-10-29
author: Codex
branch: fix/TP-149-map-lifecycle
pr: 782
area: apps/web, docs
contract-impact: none
---

# Finish #789 renderer ownership and lifecycle verification

## What changed

- Added `.agents/notes/implemented/architecture/2026-10-29-map-runtime-lifecycle.md` for renderer ownership.
- Switched fixture/MapLibre class checks in `map-renderer-lifecycle.e2e.mjs` to attribute selectors so
  `pnpm verify:e2e-selectors` passes without editing the protected allowlist.
- Wait for the phone map and its owning canvas to reach the same layout box before measuring the
  rendered surface.
- Record whether each fixture map belongs to Trip Home when it is constructed, so a detached map can
  still be identified as an orphan after its ancestor leaves the DOM.
- Assert host callback release against active map owners. The phone success scenario intentionally keeps
  the background workspace map alive, so its host callback remains installed until that owner is gone.

## Why

The lifecycle fix was already on `5bfac908`; the remaining gate failure was the selector verifier, and
the lasting ownership rule still needed an implemented Agent Note. The phone success run also exposed
two separate test assumptions: it measured before the responsive canvas had settled, then treated the
background workspace map's live callback as a Trip Home orphan. The revised assertions distinguish the
owners and require exact callback delivery for every auth dispatch.

## Validation

- `LABEL=green-ownership-fixture-preintegration pnpm --filter @trip/web e2e map-renderer-lifecycle --prod` — 72/72 before integrating `e38d46be`.
- `pnpm --filter @trip/web exec tsc --noEmit --project tsconfig.map-lifecycle.json` — pass.
- `pnpm --filter @trip/web lint` — pass with existing ChatPanel/PhoneTrajectory warnings.
- `pnpm --filter @trip/web build` — pass.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`,
  `format:check-changed c18eeced` — pass.
- Scoped added-comment check against `c18eeced` — no violations.

## Notes for the next person

Keep red artifacts under `output/playwright/map-renderer-lifecycle/`. This branch already contains
integration tip `e38d46be`; do not push or merge into integration from here.
