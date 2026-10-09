---
date: 2026-10-10
author: Codex for Joey
branch: feature/complete-map-fallback
pr: 278
area: apps/web, packages/shared, docs
contract-impact: packages/shared
---

# Complete free maps and protect same-browser trip edits

## What changed

- Completed Photon/Nominatim search/details, licensed Commons photos, MapLibre/OpenFreeMap and Transitous.
- Added optional saved-place coordinates and Undo support for mixed Google/OSM trips.
- Serialized same-browser edits; cancelled jobs and stale tabs cannot publish or autosave an old plan.
- Handled skipped view-transition promises and scoped the phone walkthrough's day selector.
- Synchronized four documentation pairs, provider configuration, glossary and decision notes.

## Why

Continue PR #278 from its existing provider seam and OSRM implementation, preserving PR #258's edits.
The new [decision](../notes/implemented/architecture/2026-10-10-complete-map-fallback.md) resolves the
leg-outage discrepancy in favor of existing non-move behavior and records concurrency boundaries.

## Validation

- `pnpm typecheck`, `pnpm lint`, `pnpm build`: passed.
- `pnpm test`: 101 files, 1,161 tests passed; JSDOM lacks WebGL and emits canvas diagnostics.
- `pnpm test:scripts`: 26 passed.
- `pnpm verify:docs`, `pnpm verify:pairs`: passed (24 pairs).
- Changed-file Prettier and `git diff --check`: passed.
- Mock E2E: map-fallback, map-provider-http, map-provider-healthy, plan-revision, notice-keys passed.
- Regression E2E: auto-save-places, timeline, check-entry-point, leg-mode-choice, display-currency passed.
- Drawer walkthrough: 194 checks passed; trip-display-currency passed after animation error handling.
- Live free-service browser check: places, real tiles and OSRM walking passed at 1440x1000 / 390x844.
- Artifacts: `output/playwright/{map-fallback,map-fallback-live,plan-revision}/after`,
  `output/e2e/{map-provider-http,map-provider-healthy}` and runner summaries.
- Existing E2E scripts used installed Chrome through the local `output/e2e/chrome-runtime.cjs` adapter.

## Notes for the next person

- PR #278 remains stacked on #258; this session does not merge either PR.
- Browser-local locks do not provide server-owned revisions or cross-device concurrency control.
- Public providers have no SLA; multi-instance Nominatim requires a shared limiter or self-hosting.
- Live Kyoto coverage does not establish positive Transitous coverage everywhere; schema/no-route
  behavior is checked with local upstream fixtures. Physical-device issues #173/#182 remain open.
- Original checkout and its pre-existing untracked session log are untouched.
