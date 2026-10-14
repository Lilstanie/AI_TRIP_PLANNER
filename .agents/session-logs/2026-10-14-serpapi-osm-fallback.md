---
date: 2026-10-14
author: Codex
branch: fix/serpapi-osm-fallback
pr: none
area: packages/tools, packages/orchestrator, .agents/notes
contract-impact: none
---

# Close the SerpApi OSM hotel-failure evidence gap

## What changed

- Added ToolGateway evidence for OSM without Google Maps credentials, retaining the typed SerpApi failure and recording no Google request.
- Added gateway-to-planner E2E cases for OSM failure handling and configured Google Places estimate provenance.
- Added an Agent Note linking the planner outcome to the existing provider decision.

## Why

The integration tip already implements and documents capability-aware fallback. This issue adds repeatable evidence through the traveller-facing planning failure and configured-estimate paths without changing production behavior or shared contracts.

## Validation

- `pnpm --filter @trip/tools test` — 11 files, 141 tests passed.
- `pnpm --filter @trip/orchestrator test` — 22 files, 246 tests passed.
- `pnpm turbo run typecheck --filter=...@trip/tools --filter=...@trip/orchestrator` — passed on rerun. The first run found a zero-argument fetch mock in the new test; its input type was added before rerunning.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs` — passed; 26 documentation pairs checked.
- `pnpm exec prettier --write ...` — all changed files formatted.
- `git diff --check` — passed.

Repeatable artifacts: `output/e2e/tool-gateway-provider-matrix/summary.json` and `output/e2e/booking-provider-planning/serpapi-osm-fallback/{osm-no-google,google-configured}.json`.

## Notes for the next person

No production behavior or docs page needed changes; architecture documentation already states the capability boundary. No remaining blockers.
