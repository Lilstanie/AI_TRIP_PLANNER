---
date: 2026-10-26
author: Codex
branch: feature/TP-104-trip-budget
pr: none
area: apps/web, docs
contract-impact: none
---

# Compact Trip budget breakdown and actionable issues

## What changed

- Added derived category/item budget rows and a typed `TripPanel` issue-navigation prop contract.
- Added Trip issue groups for overlap, unlocated, unpriced and failed place lookup; expanded budget detail keeps zero distinct from unknown.
- Added EN/ZH browser fixture journey and paired workspace UI documentation.

## Why

- Keep the known estimate and budget visible in a compact Trip surface while retaining item-level cost context and routes to affected stops.
- Avoid showing restaurant suggestions as unpriced meal costs and keep selected stay/flight cost semantics.

## Validation

- `pnpm --filter @trip/web typecheck` — passed.
- `git diff --check` — passed.
- `BASE_URL=http://localhost:3114 LABEL=after7 node apps/web/tests/e2e/trip-budget-issues.e2e.mjs` — EN and ZH budget/JPY/zero/unknown assertions passed; selected stay/flight totals and alternative exclusion passed. Issue-region assertions failed because `WorkspaceView` does not yet pass the new `TripPanel` navigation props. No runtime errors.

## Notes for the next person

- Wire `tripPlaces`, `onSelectStop={session.selectStop}`, and `onSelectDay={layout.pickMapDay}` at the parent-owned `TripPanel` call. Then rerun this E2E; it asserts selected Stop navigation for overlap, unlocated and unpriced issue rows in both locales.
